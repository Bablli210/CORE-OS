-- GymOS M4 coaching tests: week and day read shapes and their scopes, weekly slots (all or nothing, reasons named),
-- live adherence, late edits through the head coach, Team, programs from a template, working hours, the kiosk.
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

create or replace function login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p::text,''), false),
         set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, false) $$;
create or replace function ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond then raise notice 'PASS %', msg; else raise exception 'FAIL %', msg; end if; end $$;

\set MONA '''00000000-0000-0000-0000-000000000011'''
\set SARA '''00000000-0000-0000-0000-000000000023'''
\set MAHMOUD '''00000000-0000-0000-0000-000000000022'''
\set AHMED '''00000000-0000-0000-0000-000000000020'''
\set TAMER '''00000000-0000-0000-0000-000000000024'''
\set DESK_A '''00000000-0000-0000-0000-000000000030'''
\set DESK_B '''00000000-0000-0000-0000-000000000031'''
\set SARA_M '''a0000000-0000-0000-0000-000000000023'''
\set MAHMOUD_M '''a0000000-0000-0000-0000-000000000022'''
\set BRANCH_A '''b0000000-0000-0000-0000-00000000000a'''
\set BRANCH_B '''b0000000-0000-0000-0000-00000000000b'''
\set HASSAN '''00000000-0000-0000-0002-000000000001'''
\set AYA '''00000000-0000-0000-0002-000000000020'''
\set HEBA '''00000000-0000-0000-0002-000000000014'''

-- a new client sold by Mona with an 8-session pack under Sara (the M3 path)
reset role;
insert into leads(branch_id, full_name, phone, owner_membership_id, status, onboarding_responses, first_contact_due_at)
values (:BRANCH_A, 'Coaching Test Client', '+201055570001', 'a0000000-0000-0000-0000-000000000011', 'onboarded', '{"pt_prefs":{"days":["sat","mon","wed"],"time":"morning"}}', now())
returning id as lead \gset
select id as pt8 from products where code = 'PT8' and branch_id is null \gset
set role authenticated;
select login(:MONA);
select fn_create_deal(:'lead') as deal \gset
select fn_save_deal_draft(:'deal', ('[{"product_id":"' || :'pt8' || '","provider_membership_id":"a0000000-0000-0000-0000-000000000023"}]')::jsonb);
select fn_submit_deal(:'deal');
select (fn_record_payment(:'deal', (select total_piastres from deals where id = :'deal'), 'cash'))->>'client_id' as client \gset
select set_config('test.client', :'client', false);

-- ---------------------------------------------------------------- the week: scopes
select login(:SARA);
select ok((select count(*) = 1 and bool_and(is_primary) from fn_schedulable_clients(:SARA_M) where client_id = :'client' and credits_left = 8), 'K1 a new client with a pack under Sara is schedulable, 8 sessions left');
select ok(((fn_coach_week(:SARA_M, cairo_date(now())))->>'can_edit')::boolean and jsonb_array_length((fn_coach_week(:SARA_M, cairo_date(now())))->'availability') = 6, 'K2 Sara reads and may edit her week (6 working days)');
select login(:MAHMOUD);
do $$ begin
  perform fn_coach_week('a0000000-0000-0000-0000-000000000023', cairo_date(now()));
  raise exception 'FAIL K3 another coach read Sara''s week';
exception when insufficient_privilege then raise notice 'PASS K3 a coach sees only their own week'; end $$;
select login(:AHMED);
select ok(((fn_coach_week(:SARA_M, cairo_date(now())))->>'can_edit')::boolean, 'K4 the head coach opens and may edit any coach''s week in the branch');
select login(:TAMER);
do $$ begin
  perform fn_coach_today('a0000000-0000-0000-0000-000000000023');
  raise exception 'FAIL K5 a branch-B coach read Sara''s day';
exception when insufficient_privilege then raise notice 'PASS K5 the day is scoped like the week'; end $$;

-- ---------------------------------------------------------------- weekly slots: several days at once, all or nothing, reasons named
select login(:SARA);
select ok(cardinality(fn_add_weekly_slots(:SARA_M, array[6,1,3], '08:00', 'client', :'client', null, 60, cairo_date(now()))) = 3, 'K6 Sat/Mon/Wed at 08:00 in one call');
select ok((select count(*) = 3 from schedule_slots where client_id = :'client' and coach_membership_id = :SARA_M::uuid and is_active), 'K7 three weekly slots exist');
do $$ begin
  perform fn_add_weekly_slots('a0000000-0000-0000-0000-000000000023', array[5,0], '08:00', 'client', current_setting('test.client')::uuid, null, 60, cairo_date(now()));
  raise exception 'FAIL K8 overlapping slot accepted';
exception when check_violation then
  if sqlerrm like 'Sun: overlaps%' then raise notice 'PASS K8 Sunday 08:00 overlaps Nour — refused with the day named'; else raise exception 'FAIL K8 wrong message: %', sqlerrm; end if;
end $$;
select ok(not exists (select 1 from schedule_slots where client_id = :'client' and weekday = 5), 'K9 all or nothing: the Friday slot of the refused call was not kept');
do $$ begin
  perform fn_add_weekly_slots('a0000000-0000-0000-0000-000000000023', array[5], '13:00', 'client', '00000000-0000-0000-0002-000000000001', null, 60, cairo_date(now()));
  raise exception 'FAIL K10 slot for a client without credits with Sara accepted';
exception when sqlstate 'GY001' then raise notice 'PASS K10 a client with no sessions left with Sara cannot be put on her week (%)', sqlerrm; end $$;

-- ---------------------------------------------------------------- the day: materialized on open, one tap per outcome
select ok(cardinality(fn_add_weekly_slots(:SARA_M, array[extract(dow from cairo_date(now()))::int], '13:00', 'client', :'client', null, 60, cairo_date(now()))) = 1, 'K11 a slot on today''s weekday');
select ok(exists (select 1 from jsonb_array_elements((fn_coach_today(:SARA_M))->'sessions') s where s->>'client_id' = :'client' and s->>'status' = 'booked' and (s->>'credits_left')::int = 8),
          'K12 Today materializes today''s session from the slot, with sessions left');
select (fn_coach_today(:SARA_M)) is not null as again \gset
select ok((select count(*) = 1 from sessions where client_id = :'client' and cairo_date(scheduled_at) = cairo_date(now())), 'K13 opening Today twice does not duplicate the session');
select id as today_s from sessions where client_id = :'client' and cairo_date(scheduled_at) = cairo_date(now()) \gset
select fn_record_attendance(:'today_s', 'completed');
select ok(fn_credit_balance(:'client', :SARA_M) = 7, 'K14 Completed burns one session with Sara');
select fn_record_attendance(:'today_s', 'cancelled');
select ok(fn_credit_balance(:'client', :SARA_M) = 8, 'K15 changing to Cancelled restores it');

-- live adherence: two past one-offs, recorded by the head coach (past the edit window)
select fn_add_session(:'client', :SARA_M, ((cairo_date(now()) - 1)::text || ' 22:00')::timestamp at time zone 'Africa/Cairo') as s_a \gset
select fn_add_session(:'client', :SARA_M, ((cairo_date(now()) - 1)::text || ' 23:00')::timestamp at time zone 'Africa/Cairo') as s_b \gset
select login(:AHMED);
select fn_record_attendance(:'s_a', 'completed');
select login(:SARA);
select ok((select adherence_pct = 100 from fn_coach_clients(:SARA_M) where client_id = :'client'), 'K16 adherence 100% after one completed session');
select login(:AHMED);
select fn_record_attendance(:'s_b', 'no_show');
select login(:SARA);
select ok((select adherence_pct = 50 and no_shows_30d = 1 from fn_coach_clients(:SARA_M) where client_id = :'client') and fn_credit_balance(:'client', :SARA_M) = 7,
          'K17 a no-show drops adherence to 50% at once and deducts nothing');
select ok(((fn_coach_client(:'client'))#>>'{adherence,adherence_pct}')::int = 50, 'K18 the client page shows the same live adherence');

-- late edit → approval → head coach decides from Team
select fn_add_session(:'client', :SARA_M, ((cairo_date(now()) - 3)::text || ' 22:00')::timestamp at time zone 'Africa/Cairo') as s_old \gset
select ok((fn_record_attendance(:'s_old', 'completed'))->>'pending_approval' is not null, 'K19 Sara recording a 3-day-old session creates an approval');
select ok(exists (select 1 from jsonb_array_elements((fn_coach_today(:SARA_M, cairo_date(now()) - 3))->'sessions') s where s->>'id' = :'s_old' and (s->>'pending_approval')::boolean and (s->>'late')::boolean),
          'K20 her day shows it as waiting for the head coach');
do $$ begin
  perform fn_coach_team('b0000000-0000-0000-0000-00000000000a', to_char(now(), 'YYYY-MM'));
  raise exception 'FAIL K21 a coach opened Team';
exception when insufficient_privilege then raise notice 'PASS K21 Team is the head coach''s'; end $$;
select login(:AHMED);
select (fn_coach_team(:BRANCH_A, to_char(now(), 'YYYY-MM'))) as team \gset
select ok(jsonb_array_length((:'team'::jsonb)->'coaches') = 3 and exists (select 1 from jsonb_array_elements((:'team'::jsonb)->'pending_edits') e where e->>'session_id' = :'s_old' and e->>'requested_outcome' = 'completed'),
          'K22 Team lists the 3 coaches and the pending edit');
select fn_decide_approval(((select e->>'approval_id' from jsonb_array_elements((:'team'::jsonb)->'pending_edits') e where e->>'session_id' = :'s_old'))::uuid, true, 'confirmed');
select ok((select status = 'completed' and credit_consumed from sessions where id = :'s_old') and fn_credit_balance(:'client', :SARA_M) = 6, 'K23 approved: outcome and credit apply');

-- ---------------------------------------------------------------- client page scope, notes
select login(:SARA);
select fn_add_client_note(:'client', 'Prefers early sessions') as note \gset
select ok(exists (select 1 from jsonb_array_elements((fn_coach_client(:'client'))->'notes') n where n->>'body' = 'Prefers early sessions' and n->>'author' = 'Sara Fathy'), 'K24 a coaching note shows on the client page');
select login(:TAMER);
do $$ begin
  perform fn_coach_client(current_setting('test.client')::uuid);
  raise exception 'FAIL K25 another branch''s coach opened the client';
exception when no_data_found then raise notice 'PASS K25 the client page is scoped'; end $$;

-- ---------------------------------------------------------------- programs from a template
select login(:SARA);
select ok((select count(*) >= 2 from jsonb_array_elements(fn_program_templates()) t where (t->>'gym_wide')::boolean)
          and (select jsonb_array_length(t->'days') = 2 and jsonb_array_length(t->'days'->0->'exercises') = 4 from jsonb_array_elements(fn_program_templates()) t where t->>'name' = 'Full body — 2 days'),
          'K26 starter templates resolve their exercises (2 days × 4)');
select fn_save_program(null, :AYA, 'Aya block 1', 'fat_loss', 4,
  (select t->'days' from jsonb_array_elements(fn_program_templates()) t where t->>'name' = 'Full body — 2 days')) as prog \gset
select ok((:'prog'::jsonb)->>'status' = 'draft' and jsonb_array_length((:'prog'::jsonb)->'days') = 2 and jsonb_array_length((:'prog'::jsonb)->'days'->1->'exercises') = 4, 'K27 a draft saved from the template: 2 days × 4 exercises');
select (fn_activate_program(((:'prog'::jsonb)->>'id')::uuid))->>'status' as st \gset
select ok(:'st' = 'active' and (select count(*) = 1 from programs where client_id = :AYA::uuid and status = 'active'), 'K28 activated; one active program');
reset role;
select ok(exists (select 1 from notifications where recipient_profile_id = '00000000-0000-0000-0001-000000000020' and type = 'program.activated' and channel = 'push'), 'K29 the client gets the push');
set role authenticated;
select login(:SARA);
do $$ begin
  perform fn_save_program((select id from programs where client_id = '00000000-0000-0000-0002-000000000020' and status = 'active'), null, 'x', null, 4, '[]');
  raise exception 'FAIL K30 an active program was rewritten';
exception when check_violation then raise notice 'PASS K30 an active program is not rewritten in place'; end $$;
select fn_new_program_version((select id from programs where client_id = :AYA::uuid and status = 'active')) as v2 \gset
select ok((select status = 'draft' from programs where id = :'v2') and jsonb_array_length((fn_program(:'v2'))->'days') = 2, 'K31 editing an active program opens a draft copy');
select fn_activate_program(:'v2');
select ok((select count(*) = 1 from programs where client_id = :AYA::uuid and status = 'active') and (select count(*) >= 1 from programs where client_id = :AYA::uuid and status = 'archived'), 'K32 activating the copy archives the old one');
select login(null);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0001-000000000020', false), set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0001-000000000020","role":"authenticated"}', false);
select ok((fn_program(:'v2'))->>'name' = 'Aya block 1', 'K33 the client reads her own program');

-- ---------------------------------------------------------------- working hours
select login(:SARA);
do $$ begin
  perform fn_set_availability('a0000000-0000-0000-0000-000000000023', '[{"weekday":6,"start_time":"06:00","end_time":"12:00"},{"weekday":6,"start_time":"11:00","end_time":"14:00"}]');
  raise exception 'FAIL K34 overlapping hours accepted';
exception when check_violation then raise notice 'PASS K34 overlapping working hours refused'; end $$;
select fn_set_availability(:SARA_M, (select jsonb_agg(jsonb_build_object('weekday', d, 'start_time', '06:00', 'end_time', '14:00')) from generate_series(0, 6) d where d <> 5));
select ok((select count(*) = 6 from coach_availability where membership_id = :SARA_M::uuid), 'K35 working hours replaced');
select login(:MAHMOUD);
do $$ begin
  perform fn_set_availability('a0000000-0000-0000-0000-000000000023', '[]');
  raise exception 'FAIL K36 another coach changed Sara''s hours';
exception when insufficient_privilege then raise notice 'PASS K36 only the coach or head coach changes working hours'; end $$;

-- ---------------------------------------------------------------- kiosk
select login(:DESK_A);
select ok((fn_kiosk_check_in('01110000008', :BRANCH_A))->>'ok' = 'true', 'K37 Farida checks in at branch A by phone');
select ok((fn_kiosk_check_in('01110000041', :BRANCH_A))->>'ok' = 'true', 'K38 Adel (PT sessions with a branch-A coach) is admitted at branch A');
select (fn_kiosk_check_in('01110000014', :BRANCH_A)) as heba \gset
select ok((:'heba'::jsonb)->>'ok' = 'false' and (:'heba'::jsonb)->>'reason' = 'no_active_entitlement' and (:'heba'::jsonb)->>'rep_name' = 'Mona', 'K39 a lapsed client is refused; the screen can name her rep');
select ok((fn_kiosk_notify_sales(:HEBA, :BRANCH_A))->>'notified' = 'Mona', 'K40 Notify sales');
reset role;
select ok(exists (select 1 from follow_ups where client_id = :HEBA::uuid and status = 'open' and title like 'FLAG:%' and assigned_to_membership_id = 'a0000000-0000-0000-0000-000000000011')
          and exists (select 1 from notifications where recipient_profile_id = :MONA::uuid and type = 'client.flagged' and data->>'kind' = 'kiosk_refused'), 'K41 Mona has the FLAG task and the live notification');
set role authenticated;
select ok((fn_kiosk_check_in('01099999999', :BRANCH_A))->>'reason' = 'not_found', 'K42 an unknown phone says so');
select login(:DESK_B);
select ok((fn_kiosk_check_in('+201110000008', :BRANCH_B))->>'ok' = 'true', 'K43 Farida checks in at branch B too (membership works at both)');
select (fn_kiosk_check_in('01110000041', :BRANCH_B)) as adel_b \gset
select ok((:'adel_b'::jsonb)->>'ok' = 'false' and (:'adel_b'::jsonb)->>'pt_branch' like 'Branch A%', 'K44 Adel is refused at branch B; his PT sessions are usable at branch A');
select login('00000000-0000-0000-0001-000000000008');
do $$ begin
  perform fn_kiosk_check_in('01110000008', 'b0000000-0000-0000-0000-00000000000a');
  raise exception 'FAIL K45 a client used the kiosk function';
exception when insufficient_privilege then raise notice 'PASS K45 the kiosk is for staff'; end $$;

reset role;
drop function login(uuid); drop function ok(boolean, text);
select 'ALL COACHING TESTS PASSED' as result;
