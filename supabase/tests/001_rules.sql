-- GymOS rule tests. Run against a FRESH local database (migrations + seed):
--   scripts/test-db.sh            (wraps: supabase db reset, then psql -f this file)
-- Every assertion raises on failure; the last line prints ALL RULE TESTS PASSED.
-- Simulates users by setting request.jwt.claim.sub and `set role authenticated`, exactly as PostgREST does.
-- Helpers (login, ok, nc, q1, qn) live in public for the test run only and are dropped at the end.
--
-- Covered: lead capture + dedupe, inbound queue, round robin, reassignment reason, anonymous onboarding wizard,
-- coach suggestion for a lead, deal with PT recorded under a coach, auto-approval vs discount approval, item freezing,
-- payment gates (min first payment, overpayment), lead conversion, pro-rata credits bound to the coach, entitlements,
-- automatic coach assignment + welcome call, weekly schedule slots (overlap, credits required), materialization,
-- attendance (completed burns with that coach only, no-show recorded without deduction, cancel restores, waiver),
-- unpaid session → instant sales flag → settled by the next pack, late-edit approval routed to head coach,
-- head-coach reassignment moves packs and closes slots, RLS isolation for 6 roles, PR trigger, check-in rules
-- (membership at both branches, PT only at the coach's branch), freeze, expiry job, expiry extension via approval,
-- lapse, commission tiers, audit trail, and column-level write protection.
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

create or replace function login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p::text,''), false),
         set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, false) $$;
create or replace function nc(r uuid, t text) returns bigint language sql security definer as $$ select count(*) from notifications where recipient_profile_id = r and type = t $$;
create or replace function q1(sql text) returns uuid language plpgsql security definer as $$ declare r uuid; begin execute sql into r; return r; end $$;
create or replace function qn(sql text) returns bigint language plpgsql security definer as $$ declare r bigint; begin execute sql into r; return r; end $$;
create or replace function ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond then raise notice 'PASS %', msg; else raise exception 'FAIL %', msg; end if; end $$;

-- fixed ids from seed
\set MONA '''00000000-0000-0000-0000-000000000011'''
\set MONA_M '''a0000000-0000-0000-0000-000000000011'''
\set YOUSSEF_M '''a0000000-0000-0000-0000-000000000012'''
\set SM '''00000000-0000-0000-0000-000000000010'''
\set DESK_A '''00000000-0000-0000-0000-000000000030'''
\set HC_A '''00000000-0000-0000-0000-000000000020'''
\set COACH_MAHMOUD '''00000000-0000-0000-0000-000000000022'''
\set COACH_MAHMOUD_M '''a0000000-0000-0000-0000-000000000022'''
\set COACH_SARA '''00000000-0000-0000-0000-000000000023'''
\set COACH_SARA_M '''a0000000-0000-0000-0000-000000000023'''
\set COACH_TAMER '''00000000-0000-0000-0000-000000000024'''
\set CEO '''00000000-0000-0000-0000-000000000001'''
\set BRANCH_A '''b0000000-0000-0000-0000-00000000000a'''
\set BRANCH_B '''b0000000-0000-0000-0000-00000000000b'''

set role authenticated;

-- ---------------------------------------------------------------- 1. rep creates a lead, owns it
select login(:MONA);
select ok((fn_create_lead(:BRANCH_A, 'Test Lead', '01011112222', 'instagram', null, '{pt}'))->>'duplicate' = 'false', '1a rep creates lead');
select ok((select owner_membership_id = :MONA_M::uuid and phone = '+201011112222' and status = 'new' from leads where phone = '+201011112222'), '1b lead owned by rep, phone normalized to +20');
select ok((fn_create_lead(:BRANCH_A, 'Dup', '+20 10 1111 2222', 'walk_in'))->>'duplicate' = 'true', '1c duplicate detected');
select ok((select count(*) = 1 from leads where phone = '+201011112222'), '1d no duplicate inserted');
select ok((select first_contact_due_at > created_at from leads where phone = '+201011112222'), '1e SLA deadline set');
select ok(fn_within_opening_hours(:BRANCH_A, '2026-09-24 02:00+03'::timestamptz) = '2026-09-24 06:00+03'::timestamptz, '1f a deadline at 02:00 moves to opening time 06:00');
select ok(fn_within_opening_hours(:BRANCH_A, '2026-09-24 23:30+03'::timestamptz) = '2026-09-24 23:30+03'::timestamptz, '1g 23:30 is inside opening hours (open until midnight)');
select ok(fn_within_opening_hours(:BRANCH_A, '2026-09-24 12:00+03'::timestamptz) = '2026-09-24 12:00+03'::timestamptz, '1h noon is untouched');

-- ---------------------------------------------------------------- 2. front desk creates inbound lead
select login(:DESK_A);
select ok((fn_create_lead(:BRANCH_A, 'Inbound One', '01022223333', 'website'))->>'duplicate' = 'false', '2a front desk creates inbound');
select ok((select owner_membership_id is null from leads where phone = '+201022223333'), '2b inbound has no owner');
select ok(nc(:SM::uuid, 'lead.created') > 0, '2c sales manager notified');
select ok((fn_create_lead(:BRANCH_A, 'Inbound Two', '01022224444', 'website'))->>'duplicate' = 'false', '2d second inbound');
select login(:MONA);
do $$ begin
  perform fn_assign_lead(q1('select id from leads where phone = ''+201022223333'''), null);
  raise exception 'FAIL 2e rep was able to assign';
exception when insufficient_privilege then raise notice 'PASS 2e rep cannot assign'; end $$;

-- ---------------------------------------------------------------- 3. sales manager round robin
select login(:SM);
select fn_assign_lead(q1('select id from leads where phone = ''+201022223333'''), null) as rr1 \gset
select fn_assign_lead(q1('select id from leads where phone = ''+201022224444'''), null) as rr2 \gset
select ok(:'rr1'::uuid <> :'rr2'::uuid, '3a round robin rotates between reps');
select ok((select owner_membership_id is not null from leads where phone = '+201022223333'), '3b lead now owned');
do $$ begin
  perform fn_assign_lead(q1('select id from leads where phone = ''+201022223333'''), 'a0000000-0000-0000-0000-000000000012');
  raise exception 'FAIL 3c reassignment without reason allowed';
exception when check_violation then raise notice 'PASS 3c reassignment requires reason'; end $$;
select fn_assign_lead(q1('select id from leads where phone = ''+201022223333'''), :YOUSSEF_M, 'workload');
select ok((select owner_membership_id = :YOUSSEF_M::uuid from leads where phone = '+201022223333'), '3d reassigned with reason');
select fn_set_rotation_paused(:YOUSSEF_M, true);
select ok((select rotation_paused from memberships where id = :YOUSSEF_M::uuid), '3e sales manager paused Youssef');
select ok((fn_create_lead(:BRANCH_A, 'Inbound Three', '01022225555', 'website'))->>'duplicate' = 'false', '3f third inbound');
select ok(fn_assign_lead(q1('select id from leads where phone = ''+201022225555'''), null) = :MONA_M::uuid, '3g round robin skips the paused rep');
select fn_set_rotation_paused(:YOUSSEF_M, false);
select login(:MONA);
do $$ begin
  perform fn_set_rotation_paused('a0000000-0000-0000-0000-000000000012', true);
  raise exception 'FAIL 3h rep paused a colleague';
exception when insufficient_privilege then raise notice 'PASS 3h reps cannot change rotation'; end $$;

-- ---------------------------------------------------------------- 4. onboarding wizard via anon
select login(:MONA);
select fn_issue_onboarding_token(q1('select id from leads where phone = ''+201011112222''')) as tok \gset
reset role; set role anon; select login(null);
select ok((fn_submit_onboarding(:'tok', 'identity', '{"full_name":"Test Lead Full","gender":"female","date_of_birth":"1995-05-05"}'))->>'ok' = 'true', '4a anon step saved');
select ok((fn_submit_onboarding(:'tok', 'pt_prefs', '{"time":"morning","trainer_gender":"female","days":["sat","mon","wed"]}'))->>'ok' = 'true', '4b second step');
select ok((fn_submit_onboarding(:'tok', 'social', '{"instagram_handle":"@testlead","consent_marketing":true,"consent_content":false}', true))->>'ok' = 'true', '4c completed');
select ok((fn_submit_onboarding('bogus', 'x', '{}'))->>'ok' = 'false', '4d bogus token rejected');
do $$ begin
  perform count(*) from leads;
  raise exception 'FAIL 4e anon can read leads';
exception when insufficient_privilege then raise notice 'PASS 4e anon has no access to leads at all'; end $$;
reset role; set role authenticated; select login(:MONA);
select ok((select status = 'onboarded' and instagram_handle = '@testlead' and consent_marketing and full_name = 'Test Lead Full' and onboarding_responses #>> '{pt_prefs,time}' = 'morning' from leads where phone = '+201011112222'), '4f lead onboarded, fields copied');
select ok(nc(:MONA::uuid, 'lead.onboarded') = 1, '4g rep notified');

-- ---------------------------------------------------------------- 5. coach suggestion for the lead; deal with PT recorded under a coach
select id as lead_id from leads where phone = '+201011112222' \gset
select ok((select coach_name = 'Sara Fathy' from fn_rank_coaches(null, :'lead_id') limit 1), '5a rep sees Sara (female, mornings) suggested first for the lead');
select ok((select count(*) = 0 from fn_rank_coaches(null, :'lead_id') where coach_name in ('Mahmoud Gamal','Ahmed Salah')), '5b male coaches filtered by the lead''s preference');
insert into deals(branch_id, lead_id, rep_membership_id, created_by) values (:BRANCH_A, :'lead_id', :MONA_M, :MONA) returning id as deal1 \gset
insert into deal_items(deal_id, product_id, qty) values (:'deal1', 'c0000000-0000-0000-0000-000000000012', 1), (:'deal1', 'c0000000-0000-0000-0000-000000000002', 1);
do $$ begin
  perform fn_submit_deal(q1('select id from deals where lead_id = (select id from leads where phone = ''+201011112222'') and status = ''draft'' order by created_at limit 1'));
  raise exception 'FAIL 5c PT pack submitted without a coach';
exception when check_violation then raise notice 'PASS 5c PT pack must be recorded under a coach'; end $$;
update deal_items set provider_membership_id = :COACH_SARA_M where deal_id = :'deal1' and product_id = 'c0000000-0000-0000-0000-000000000012';
select ok((select status = 'approved' and total_piastres = 940000 from fn_submit_deal(:'deal1')), '5d list price deal auto-approved, total 9400 EGP');
select ok((select count(*) = 2 from deal_items where deal_id = :'deal1' and product_type is not null and unit_price_piastres > 0), '5e items snapshotted');
with u as (update deal_items set qty = 5 where deal_id = :'deal1' returning 1) select ok((select count(*) = 0 from u), '5f items frozen after submit');

insert into deals(branch_id, lead_id, rep_membership_id, created_by, discount_pct) values (:BRANCH_A, :'lead_id', :MONA_M, :MONA, 20) returning id as deal2 \gset
insert into deal_items(deal_id, product_id, qty, provider_membership_id) values (:'deal2', 'c0000000-0000-0000-0000-000000000011', 1, :COACH_SARA_M);
select ok((select status = 'pending_approval' from fn_submit_deal(:'deal2')), '5g 20% discount (allowance 10%) needs approval');
select ok((select count(*) = 1 from approvals where subject_id = :'deal2' and status = 'pending' and type = 'discount'), '5h approval row created');
do $$ begin
  perform fn_record_payment(q1('select id from deals where discount_pct = 20 limit 1'), 100000, 'cash');
  raise exception 'FAIL 5i payment on unapproved deal allowed';
exception when check_violation then raise notice 'PASS 5i payment blocked until approved'; end $$;

-- ---------------------------------------------------------------- 6. manager approves
select login(:SM);
select fn_decide_approval(q1('select id from approvals where subject_id = ''' || :'deal2' || ''''), true, 'ok this once');
select ok((select status = 'approved' and total_piastres = 320000 from deals where id = :'deal2'), '6a approved after decision, total 3200');
select ok(nc(:MONA::uuid, 'approval.decided') = 1, '6b requester notified');

-- ---------------------------------------------------------------- 7. payments: partial then full; conversion; pro-rata credits under Sara; auto coach
select login(:MONA);
do $$ begin
  perform fn_record_payment(q1('select id from deals where total_piastres = 940000 and lead_id is not null order by created_at desc limit 1'), 100000, 'cash');
  raise exception 'FAIL 7a tiny first payment allowed';
exception when check_violation then raise notice 'PASS 7a first payment below 30 pct rejected'; end $$;
select fn_record_payment(:'deal1', 470000, 'instapay', 'REF-1') as pay1 \gset
select ok((:'pay1'::jsonb)->>'deal_status' = 'partially_paid', '7b partially paid');
select ((:'pay1'::jsonb)->>'client_id')::uuid as client1 \gset
select ok((select status = 'won' and converted_client_id = :'client1' from leads where id = :'lead_id'), '7c lead won and converted');
select ok((select full_name = 'Test Lead Full' and gender = 'female' and rep_membership_id = :MONA_M::uuid from clients where id = :'client1'), '7d client created from lead');
select ok(fn_credit_balance(:'client1') = 6 and fn_credit_balance(:'client1', :COACH_SARA_M) = 6 and fn_credit_balance(:'client1', :COACH_MAHMOUD_M) = 0, '7e 50% paid -> 6 of 12 credits, all bound to Sara');
select ok((select coach_membership_id = :COACH_SARA_M::uuid from clients where id = :'client1'), '7f Sara is the client''s coach automatically (no separate assignment step)');
select ok(qn('select count(*) from coach_assignments where client_id = ''' || :'client1' || ''' and ended_at is null and coach_membership_id = ''a0000000-0000-0000-0000-000000000023''') = 1, '7g one open assignment');
select ok(qn('select count(*) from follow_ups where client_id = ''' || :'client1' || ''' and title like ''Welcome call%'' and status = ''open'' and assigned_to_membership_id = ''a0000000-0000-0000-0000-000000000023''') = 1, '7h welcome-call task for Sara');
select ok(nc(:COACH_SARA::uuid, 'coach.assigned') = 1 and nc(:HC_A::uuid, 'client.pt_purchased') >= 1, '7i coach and head coach notified');
select ok((select count(*) = 1 from entitlements where client_id = :'client1' and type = 'membership' and status = 'active'), '7j membership entitlement created');
select ok(qn('select count(*) from notifications where client_id = ''' || :'client1' || ''' and recipient_profile_id is null and type in (''payment.recorded'',''coach.assigned'')') = 2, '7j2 client messages queued on the client row until provisioning (no profile yet)');
select ok((select first_paid_at is not null and paid_at is null from deals where id = :'deal1'), '7j3 first_paid_at set on partial payment, paid_at not yet');
select ok((select per_session_value_piastres = 45000 and tax_pct = 14 and net_per_session_value_piastres = 38700 from credit_lots where client_id = :'client1' limit 1), '7k gross 450/session, net 387 after 14% tax');
do $$ begin
  perform fn_record_payment(q1('select id from deals where paid_piastres = 470000'), 500000, 'cash');
  raise exception 'FAIL 7l overpayment allowed';
exception when check_violation then raise notice 'PASS 7l overpayment rejected'; end $$;
select fn_record_payment(:'deal1', 470000, 'cash', 'REF-2') as pay2 \gset
select ok((:'pay2'::jsonb)->>'deal_status' = 'paid' and fn_credit_balance(:'client1') = 12, '7m fully paid -> 12 credits, 2 lots');
select ok(qn('select count(*) from events where type = ''deal.paid'' and subject_id = ''' || :'deal1' || '''') = 1, '7n deal.paid event');

-- ---------------------------------------------------------------- 8. weekly schedule
select login(:COACH_MAHMOUD);
do $$ begin
  perform fn_upsert_schedule_slot('a0000000-0000-0000-0000-000000000022', 6, '15:00', 'client', q1('select id from clients where full_name = ''Test Lead Full'''));
  raise exception 'FAIL 8a Mahmoud scheduled a client whose pack is with Sara';
exception when sqlstate 'GY001' then raise notice 'PASS 8a a coach cannot schedule a client whose pack is with another coach'; end $$;
select login(:COACH_SARA);
select fn_upsert_schedule_slot(:COACH_SARA_M, 6, '08:00', 'client', :'client1') as slot_sat \gset
select fn_upsert_schedule_slot(:COACH_SARA_M, 1, '08:00', 'client', :'client1') as slot_mon \gset
select ok((select count(*) = 2 from schedule_slots where client_id = :'client1' and is_active), '8b two weekly slots created');
do $$ begin
  perform fn_upsert_schedule_slot('a0000000-0000-0000-0000-000000000023', 6, '08:30', 'class', null, 'Mobility class');
  raise exception 'FAIL 8c overlapping slot allowed';
exception when check_violation then raise notice 'PASS 8c overlapping slot rejected'; end $$;
select fn_upsert_schedule_slot(:COACH_SARA_M, 6, '13:00', 'class', null, 'Mobility class') as slot_class \gset
-- next Saturday, materialized
select (current_date + ((6 - extract(dow from current_date)::int + 7) % 7 + 7)) as next_sat \gset
select fn_materialize_sessions(:'next_sat'::date, :COACH_SARA_M) as mat1 \gset
select ok((select count(*) >= 1 from sessions where slot_id = :'slot_sat' and status = 'booked'), '8d session materialized from the slot');
select fn_materialize_sessions(:'next_sat'::date, :COACH_SARA_M) as mat2 \gset
select ok((select count(*) = 1 from sessions where slot_id = :'slot_sat'), '8e materialization is idempotent');
select ok((select count(*) = 1 from fn_coach_day(:COACH_SARA_M, :'next_sat'::date) where kind = 'class'), '8f class shows on the coach''s day');
select ok((select count(*) >= 1 from fn_coach_day(:COACH_SARA_M, :'next_sat'::date) where kind = 'session' and client_name = 'Test Lead Full'), '8g client session shows on the coach''s day');
select id as s1 from sessions where slot_id = :'slot_sat' \gset
-- skip a date cancels that day's session only
select fn_skip_slot(:'slot_mon', (:'next_sat'::date + 2), 'public holiday');
select fn_materialize_sessions(:'next_sat'::date + 2, :COACH_SARA_M);
select ok((select count(*) = 0 from sessions where slot_id = :'slot_mon' and status = 'booked' and (scheduled_at at time zone 'Africa/Cairo')::date = :'next_sat'::date + 2), '8h skipped date produces no session');

-- ---------------------------------------------------------------- 9. attendance
select ok((fn_record_attendance(:'s1', 'completed'))->>'credit_balance' = '11', '9a completed -> 11 credits');
select ok((select credit_consumed and lot_id is not null from sessions where id = :'s1'), '9b session references the lot');
select ok((select count(*) = 1 from visits where client_id = :'client1'), '9c visit auto-created');
select ok((select lot_id = (select id from credit_lots where client_id = :'client1' order by expires_at, issued_at limit 1) from sessions where id = :'s1'), '9d FIFO by expiry');
select ok((fn_record_attendance(:'s1', 'cancelled'))->>'credit_balance' = '12', '9e outcome change to cancelled restores the credit');
select ok((fn_record_attendance(:'s1', 'no_show'))->>'credit_balance' = '12', '9f no-show is recorded but does NOT deduct');
select ok((select status = 'no_show' from sessions where id = :'s1'), '9g no-show stored for adherence analytics');
select ok((fn_record_attendance(:'s1', 'completed', true, 'make-up session on the house'))->>'credit_balance' = '12', '9h waiver: completed without deduction');
select ok(nc(:HC_A::uuid, 'session.waived') >= 1, '9i head coach sees the waiver');
do $$ begin
  perform fn_record_attendance(q1('select id from sessions where client_id = (select id from clients where full_name = ''Test Lead Full'') limit 1'), 'completed', true, '');
  raise exception 'FAIL 9j waiver without reason';
exception when check_violation then raise notice 'PASS 9j waiver needs a reason'; end $$;
select ok((fn_record_attendance(:'s1', 'completed'))->>'credit_balance' = '11', '9k back to completed burns again');
select login(:COACH_MAHMOUD);
do $$ begin
  perform fn_record_attendance(q1('select id from sessions where client_id = (select id from clients where full_name = ''Test Lead Full'') limit 1'), 'completed');
  raise exception 'FAIL 9l other coach recorded attendance';
exception when insufficient_privilege then raise notice 'PASS 9l other coach denied'; end $$;
select login(:COACH_SARA);
select fn_start_walkin_session(:'client1') as w1 \gset
select ok((select status = 'completed' and is_walk_in and credit_consumed from sessions where id = :'w1') and fn_credit_balance(:'client1') = 10, '9m walk-in completes and burns');

-- ---------------------------------------------------------------- 10. late edit -> approval -> head coach applies
select ((current_date - ((extract(dow from current_date)::int + 1) % 7 + 7))::text || ' 09:00')::timestamp at time zone 'Africa/Cairo' as past_slot \gset
select fn_add_session(:'client1', :COACH_SARA_M, :'past_slot') as s_old \gset
select fn_record_attendance(:'s_old', 'completed') as late \gset
select ok((:'late'::jsonb)->>'ok' = 'false' and (:'late'::jsonb)->>'pending_approval' is not null, '10a late edit becomes an approval request');
select ok((select status = 'booked' from sessions where id = :'s_old'), '10b outcome not applied yet');
select login(:SM);
do $$ begin
  perform fn_decide_approval(q1('select id from approvals where type = ''attendance_edit'' and status = ''pending'' limit 1'), true);
  raise exception 'FAIL 10c sales manager decided attendance edit';
exception when insufficient_privilege then raise notice 'PASS 10c sales manager cannot decide attendance edits'; end $$;
select login(:HC_A);
select fn_decide_approval(q1('select id from approvals where type = ''attendance_edit'' and status = ''pending'' limit 1'), true, 'verified with client');
select ok((select status = 'completed' and credit_consumed from sessions where id = :'s_old') and fn_credit_balance(:'client1') = 9, '10d head coach approval applies outcome and burns credit');

-- ---------------------------------------------------------------- 11. head coach reassigns: packs move, old slots close
select login(:COACH_SARA);
do $$ begin
  perform fn_assign_coach(q1('select id from clients where full_name = ''Test Lead Full'''), 'a0000000-0000-0000-0000-000000000022');
  raise exception 'FAIL 11a coach reassigned a client';
exception when insufficient_privilege then raise notice 'PASS 11a only the head coach reassigns'; end $$;
select login(:HC_A);
do $$ begin
  perform fn_assign_coach(q1('select id from clients where full_name = ''Test Lead Full'''), 'a0000000-0000-0000-0000-000000000022');
  raise exception 'FAIL 11b reassignment without reason';
exception when check_violation then raise notice 'PASS 11b reassignment requires a reason'; end $$;
select fn_assign_coach(:'client1', :COACH_MAHMOUD_M, 'client asked for evenings');
select ok(fn_credit_balance(:'client1', :COACH_MAHMOUD_M) = 9 and fn_credit_balance(:'client1', :COACH_SARA_M) = 0, '11c remaining credits moved to Mahmoud');
select ok((select count(*) = 0 from schedule_slots where client_id = :'client1' and is_active), '11d Sara''s slots for the client closed');
select ok((select coach_membership_id = :COACH_MAHMOUD_M::uuid from clients where id = :'client1'), '11e client now with Mahmoud');
select ok(nc(:COACH_SARA::uuid, 'client.reassigned') = 1, '11f old coach notified');
select fn_assign_coach(:'client1', :COACH_SARA_M, 'schedule resolved, back to Sara');
select ok(fn_credit_balance(:'client1', :COACH_SARA_M) = 9, '11g moved back');

-- ---------------------------------------------------------------- 12. RLS visibility
select login(:COACH_MAHMOUD);
select ok((select count(*) > 0 and bool_and(coach_membership_id = :COACH_MAHMOUD_M::uuid) from clients), '12a coach sees only own clients');
select ok((select count(*) = 0 from leads), '12b coach sees no leads');
select ok((select count(*) = 0 from payments), '12c coach sees no payments');
select ok((select count(*) > 0 and bool_and(coach_membership_id = :COACH_MAHMOUD_M::uuid) from schedule_slots), '12d coach sees only own schedule');
select login(:MONA);
select ok((select count(*) > 0 and bool_and(owner_membership_id = :MONA_M::uuid) from leads), '12e rep sees only own leads');
select ok((select count(*) > 0 and bool_and(rep_membership_id = :MONA_M::uuid) from clients), '12f rep sees only own clients');
select ok((select count(*) = 0 from workout_logs), '12g rep sees no workout logs');
select login(:SM);
select ok((select count(distinct branch_id) = 2 from leads), '12h sales manager sees both branches');
select login(:HC_A);
select ok((select count(*) > 0 and bool_and(home_branch_id = :BRANCH_A::uuid) from clients), '12i head coach sees whole branch, only own branch');
select ok((select count(distinct coach_membership_id) > 1 and bool_and(branch_id = :BRANCH_A::uuid) from schedule_slots), '12j head coach sees every coach''s schedule in the branch');
select login(:COACH_TAMER);
select ok((select count(*) = 0 from clients where home_branch_id = :BRANCH_A::uuid), '12k branch B coach sees nothing from A');
select login('00000000-0000-0000-0001-000000000001');  -- Hassan Ibrahim, client 1
select ok((select count(*) = 1 from clients), '12l client sees only self');
select ok((select count(*) > 0 and bool_and(client_id = '00000000-0000-0000-0002-000000000001') from sessions), '12m client sees own sessions');
select ok((select count(*) > 0 and bool_and(client_id = '00000000-0000-0000-0002-000000000001') from schedule_slots), '12n client sees own weekly slots');
select ok((select count(*) = 0 from events), '12o client sees no events');
select ok((select count(*) = 1 from programs), '12p client sees own program');
insert into workout_logs(client_id, program_day_id) values ('00000000-0000-0000-0002-000000000001', (select id from program_days where name like 'Day 1%' limit 1)) returning id as wl \gset
insert into set_logs(workout_log_id, exercise_id, set_index, weight_kg, reps) values (:'wl', (select id from exercises where name = 'Back squat'), 1, 80, 8), (:'wl', (select id from exercises where name = 'Back squat'), 2, 85, 6), (:'wl', (select id from exercises where name = 'Back squat'), 3, 82.5, 6);
select ok((select bool_and(is_pr = (set_index = 1) or (set_index = 2 and is_pr)) and sum(is_pr::int) = 2 from set_logs where workout_log_id = :'wl'), '12q PR trigger: set 1 PR, set 2 PR (85x6 > 80x8 by Epley), set 3 not');
do $$ begin
  insert into workout_logs(client_id) values ('00000000-0000-0000-0002-000000000002');
  raise exception 'FAIL 12r client wrote another client''s log';
exception when others then raise notice 'PASS 12r client cannot write another client''s log'; end $$;

-- ---------------------------------------------------------------- 13. check-in
select login(:DESK_A);
select ok((fn_check_in('00000000-0000-0000-0002-000000000008', :BRANCH_A, 'phone'))->>'ok' = 'true', '13a member with active membership checks in');
select ok((fn_check_in('00000000-0000-0000-0002-000000000008', :BRANCH_A, 'phone'))->>'duplicate' = 'true', '13b duplicate within 3h ignored');
select ok((fn_check_in(q1('select id from clients where status = ''lapsed'' limit 1'), :BRANCH_A, 'phone'))->>'reason' = 'no_active_entitlement', '13c lapsed client refused');
select login('00000000-0000-0000-0000-000000000031'); -- desk B
select ok((fn_check_in('00000000-0000-0000-0002-000000000008', :BRANCH_B, 'phone'))->>'ok' = 'true', '13d membership admits the client at the other branch');
reset role; update entitlements set status = 'expired' where client_id = '00000000-0000-0000-0002-000000000001'; set role authenticated;
select login('00000000-0000-0000-0000-000000000031');
select ok((fn_check_in('00000000-0000-0000-0002-000000000001', :BRANCH_B, 'phone'))->>'ok' = 'false', '13e PT credits alone do not admit the client at the other branch');
select login(:DESK_A);
select ok((fn_check_in('00000000-0000-0000-0002-000000000001', :BRANCH_A, 'phone'))->>'ok' = 'true', '13f PT credits admit the client at the coach''s branch');

-- ---------------------------------------------------------------- 14. freeze
reset role;
insert into auth.users(id, phone) values ('00000000-0000-0000-0009-000000000001', '+201011112222');
insert into profiles(id, full_name, phone, gender) values ('00000000-0000-0000-0009-000000000001', 'Test Lead Full', '+201011112222', 'female');
insert into memberships(profile_id, branch_id, role) values ('00000000-0000-0000-0009-000000000001', :BRANCH_A, 'client');
update clients set profile_id = '00000000-0000-0000-0009-000000000001' where id = :'client1';
update notifications set recipient_profile_id = '00000000-0000-0000-0009-000000000001' where client_id = :'client1' and recipient_profile_id is null;  -- what provision-client does
set role authenticated;
select login('00000000-0000-0000-0009-000000000001');
select ok((select count(*) = 1 from clients) and (select fn_credit_balance(id) = 9 from clients), '14a provisioned client sees self and balance');
select ok((select count(*) >= 2 from notifications where type in ('payment.recorded','coach.assigned')), '14a2 client now sees the messages queued before provisioning');
select ok(fn_flag_for_sales(:'client1', 'I want to renew', 'renewal_request') is not null, '14a3 client can request a renewal');
select ok(nc(:COACH_SARA::uuid, 'client.flagged') = 1 and nc(:MONA::uuid, 'client.flagged') >= 1, '14a4 renewal request reaches the coach and the rep');
do $$ begin
  perform fn_flag_for_sales('00000000-0000-0000-0002-000000000002', 'x', 'manual');
  raise exception 'FAIL 14a5 client flagged another client';
exception when insufficient_privilege then raise notice 'PASS 14a5 a client can only flag themself'; end $$;
select ok((select count(*) = 1 and bool_and(coach_name = 'Sara Fathy' and balance = 9) from fn_credit_balances(:'client1')), '14b balance per coach');
select fn_request_freeze(:'client1', now() + interval '1 day', now() + interval '11 days', 'travel') as fz \gset
select ok((select status = 'pending' and days = 10 from freezes where id = :'fz'), '14c client requested a 10-day freeze');
do $$ begin
  perform fn_request_freeze(q1('select id from clients where full_name = ''Test Lead Full'''), now(), now() + interval '45 days', 'too long');
  raise exception 'FAIL 14d 45-day freeze allowed';
exception when check_violation then raise notice 'PASS 14d freeze over max days rejected'; end $$;
select login(:SM);
select expires_at as exp_before from credit_lots where client_id = :'client1' order by expires_at limit 1 \gset
select fn_decide_approval((select approval_id from freezes where id = :'fz'), true);
select ok((select status = 'frozen' from clients where id = :'client1'), '14e client frozen');
select fn_end_freeze(:'fz');
select ok((select status = 'active' from clients where id = :'client1') and (select expires_at = :'exp_before'::timestamptz + interval '10 days' from credit_lots where client_id = :'client1' order by expires_at limit 1), '14f unfreeze extends expiry by 10 days');

-- ---------------------------------------------------------------- 15. expiry job, unpaid session -> flag -> settled by the next pack, expiry extension
reset role; -- jobs run as the database owner
update credit_lots set expires_at = now() - interval '1 day' where client_id = :'client1';
select ok(fn_expire_credits() = 2 and fn_credit_balance(:'client1') = 0, '15a expiry job expires both lots');
select ok((select count(*) = 2 from credit_ledger where client_id = :'client1' and entry_type = 'expire'), '15b expire ledger rows');
set role authenticated; select login(:COACH_SARA);
select fn_start_walkin_session(:'client1') as unpaid1 \gset
select ok((select status = 'completed' and unpaid and not credit_consumed from sessions where id = :'unpaid1'), '15c session delivered on zero credits is kept as unpaid');
select ok(nc(:MONA::uuid, 'client.flagged') >= 1 and nc(:SM::uuid, 'client.flagged') >= 1, '15d rep and sales manager flagged the same second');
select ok((select count(*) = 1 from follow_ups where client_id = :'client1' and title like 'FLAG:%' and status = 'open'), '15e one open flag task for the rep');
select fn_start_walkin_session(:'client1') as unpaid2 \gset
select ok((select count(*) = 1 from follow_ups where client_id = :'client1' and title like 'FLAG:%' and status = 'open'), '15f a second unpaid session does not create a second flag');
select login(:SM);
with u as (update follow_ups set status = 'done', completed_at = now() where client_id = :'client1' and title like 'FLAG:%' and status = 'open' returning 1) select ok((select count(*) = 1 from u), '15f2 sales manager can close a rep''s flag task');
select login(:COACH_SARA);
-- sales rep extends expiry -> needs manager approval; manager extends directly
select login(:MONA);
select lot_id from credit_ledger where client_id = :'client1' and entry_type = 'expire' order by id limit 1 \gset
select fn_extend_expiry(:'lot_id', now() + interval '30 days', 'client was travelling') as ext \gset
select ok((:'ext'::jsonb)->>'ok' = 'false' and (:'ext'::jsonb)->>'pending_approval' is not null, '15g rep''s extension goes to the sales manager');
select login(:COACH_SARA);
do $$ begin
  perform fn_extend_expiry(q1('select lot_id from credit_ledger where entry_type = ''expire'' order by id limit 1'), now() + interval '30 days', 'please');
  raise exception 'FAIL 15h coach extended expiry';
exception when insufficient_privilege then raise notice 'PASS 15h coaches cannot extend expiry'; end $$;
select login(:SM);
select fn_decide_approval(q1('select id from approvals where type = ''expiry_extension'' and status = ''pending'' limit 1'), true, 'approved');
select ok((select status = 'active' and qty_remaining = 3 and expires_at > now() + interval '29 days' from credit_lots where id = :'lot_id'), '15i approved extension revives the expired lot with its 3 unused credits');
-- revived credits do not retroactively pay the unpaid sessions: settlement happens on the next PAID pack. Balance 3, sessions stay unpaid.
select ok(fn_credit_balance(:'client1') = 3 and (select count(*) = 2 from sessions where client_id = :'client1' and unpaid), '15j unpaid sessions wait for a new pack');
-- new PT8 pack under Sara, paid in full -> settles the 2 unpaid sessions, 6 left on the new lot
select login(:MONA);
insert into deals(branch_id, client_id, rep_membership_id, created_by, is_renewal) values (:BRANCH_A, :'client1', :MONA_M, :MONA, true) returning id as deal3 \gset
insert into deal_items(deal_id, product_id, qty, provider_membership_id) values (:'deal3', 'c0000000-0000-0000-0000-000000000011', 1, :COACH_SARA_M);
select fn_submit_deal(:'deal3');
select fn_record_payment(:'deal3', 400000, 'cash', 'REF-3') as pay3 \gset
select ok((:'pay3'::jsonb)->>'settled_sessions' = '2', '15k payment settled the 2 unpaid sessions');
select ok((select count(*) = 0 from sessions where client_id = :'client1' and unpaid) and (select count(*) = 2 from sessions where client_id = :'client1' and settled_at is not null and credit_consumed), '15l sessions now paid and linked to the new lot');
select ok(fn_credit_balance(:'client1') = 3 + 8 - 2, '15m balance = 3 revived + 8 new − 2 settled');
select ok(fn_credit_balance(:'client1', :COACH_SARA_M) = 9, '15n all with Sara');
reset role;
update entitlements set ends_at = now() - interval '1 day' where client_id = :'client1';
update credit_lots set expires_at = now() - interval '1 day' where client_id = :'client1';
select fn_expire_credits();
select fn_mark_lapsed() as lapsed_n \gset
select ok(:lapsed_n >= 1 and (select status = 'lapsed' from clients where id = :'client1'), '15o client lapses with no credits and no membership');
select ok(fn_compute_risk_scores() > 0, '15p risk job runs');

-- ---------------------------------------------------------------- 16. commission tiers and the coach view
select ok(fn_pt_commission_pct(0) = 30 and fn_pt_commission_pct(160) = 30 and fn_pt_commission_pct(161) = 40 and fn_pt_commission_pct(200) = 40 and fn_pt_commission_pct(201) = 50, '16a tiers 0–160 → 30%, 161–200 → 40%, 201+ → 50%');
select fn_refresh_views(true);
select ok((select bool_and(commission_piastres = round(revenue_delivered_net * commission_pct / 100.0)) from mv_coach_month where credits_burned > 0), '16b commission = net delivered × tier rate');
select ok((select count(*) > 0 from mv_client_adherence where no_shows_30d > 0), '16c adherence view shows who is slacking');
select ok((select bool_and(pt_collected >= 0 and membership_collected >= 0) from mv_rep_month), '16d rep view splits collected money by item type');
select ok((select sum(revenue_booked) >= sum(revenue_collected) from mv_daily_branch), '16e booked (partial + paid, at first payment) ≥ collected');
select ok((select count(*) > 0 from mv_coach_month where clients_ended > 0), '16f coach retention counts clients whose pack ran out');

-- ---------------------------------------------------------------- 17. audit trail and column-level write protection
select ok((select count(*) > 0 from audit_log where table_name = 'sessions' and action = 'UPDATE'), '17a sessions audited');
select ok((select count(*) > 0 from audit_log where table_name = 'payments' and action = 'INSERT'), '17b payments audited');
select ok((select count(*) > 0 from audit_log where table_name = 'schedule_slots'), '17c schedule changes audited');
select ok((select count(*) >= 10 from events where actor_profile_id is not null), '17d events carry actor');
set role authenticated;
select login(:COACH_MAHMOUD);
do $$ begin
  update sessions set status = 'completed', credit_consumed = true where coach_membership_id = 'a0000000-0000-0000-0000-000000000022' and status = 'booked';
  raise exception 'FAIL 17e coach could set session status directly';
exception when insufficient_privilege then raise notice 'PASS 17e session status not directly writable'; end $$;
do $$ begin
  update sessions set notes = 'felt strong today' where coach_membership_id = 'a0000000-0000-0000-0000-000000000022' and status = 'booked';
  raise notice 'PASS 17f coach can edit session notes';
end $$;
do $$ begin
  update clients set coach_membership_id = 'a0000000-0000-0000-0000-000000000022' where id = '00000000-0000-0000-0002-000000000002';
  raise exception 'FAIL 17g coach could steal a client';
exception when insufficient_privilege then raise notice 'PASS 17g clients.coach_membership_id not directly writable'; end $$;
do $$ begin
  insert into schedule_slots(coach_membership_id, branch_id, weekday, start_time, kind, label) values ('a0000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-00000000000a', 2, '10:00', 'blocked', 'x');
  raise exception 'FAIL 17h schedule inserted directly';
exception when insufficient_privilege then raise notice 'PASS 17h schedule only changes through fn_upsert_schedule_slot'; end $$;
select login(:MONA);
do $$ begin
  update leads set status = 'won' where owner_membership_id = 'a0000000-0000-0000-0000-000000000011';
  raise exception 'FAIL 17i rep could set lead status directly';
exception when insufficient_privilege then raise notice 'PASS 17i lead status not directly writable'; end $$;
do $$ begin
  update deals set total_piastres = 1, paid_piastres = 1 where rep_membership_id = 'a0000000-0000-0000-0000-000000000011';
  raise exception 'FAIL 17j rep could edit deal money';
exception when insufficient_privilege then raise notice 'PASS 17j deal money not directly writable'; end $$;
select login(:DESK_A);
select ok(fn_flag_for_sales('00000000-0000-0000-0002-000000000015', 'wants to renew, membership expired') is not null, '17k front desk flags a client for sales');
select login(:HC_A);
select ok((select count(*) > 0 and bool_and(branch_id = 'b0000000-0000-0000-0000-00000000000a') from audit_log where branch_id is not null), '17l head coach sees only own-branch audit rows');

reset role;
drop function login(uuid); drop function ok(boolean, text); drop function nc(uuid, text); drop function q1(text); drop function qn(text);
select 'ALL RULE TESTS PASSED' as result;
