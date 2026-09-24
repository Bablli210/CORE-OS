-- GymOS M3 money tests: deal builder RPCs, approval preview, the acceptance path (discount → approval → 50% → pro-rata
-- credits with the coach → overpayment refused → void by approval refunds credits), expiry extension, catalog, scopes.
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

create or replace function login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p::text,''), false),
         set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, false) $$;
create or replace function ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond then raise notice 'PASS %', msg; else raise exception 'FAIL %', msg; end if; end $$;

\set MONA '''00000000-0000-0000-0000-000000000011'''
\set HANA '''00000000-0000-0000-0000-000000000013'''
\set SM '''00000000-0000-0000-0000-000000000010'''
\set CEO '''00000000-0000-0000-0000-000000000001'''
\set SARA_M '''a0000000-0000-0000-0000-000000000023'''
\set BRANCH_A '''b0000000-0000-0000-0000-00000000000a'''
\set BRANCH_B '''b0000000-0000-0000-0000-00000000000b'''

-- a fresh lead like Layla (female, morning, back) owned by Mona
reset role;
insert into leads(branch_id, full_name, phone, owner_membership_id, status, onboarding_responses, first_contact_due_at)
values (:BRANCH_A, 'Money Test Lead', '+201055560001', 'a0000000-0000-0000-0000-000000000011', 'onboarded',
        '{"pt_prefs":{"time":"morning","trainer_gender":"female","days":["sat","mon","wed"]},"health":{"conditions":["back"]},"identity":{"gender":"female"}}', now())
returning id as lead \gset
select id as pt12 from products where code = 'PT12' and branch_id is null \gset
select id as mem1 from products where code = 'MEM1' and branch_id is null \gset
select set_config('test.lead', :'lead', false), set_config('test.pt12', :'pt12', false), set_config('test.mem1', :'mem1', false);

set role authenticated;
select login(:MONA);
select ok((select count(*) = 9 from fn_deal_catalog(:BRANCH_A)), 'C1 catalog lists the branch''s sellable products');
select ok((select net_per_session_piastres = round(per_session_piastres * 0.86) from fn_deal_catalog(:BRANCH_A) where code = 'PT12'), 'C2 catalog shows per-session gross and net (tax 14%)');
select ok((select coach_membership_id = :SARA_M::uuid from fn_rank_coaches(p_lead_id => :'lead') limit 1), 'C3 Sara ranks first for a female morning lead');

select fn_create_deal(:'lead') as deal \gset
select set_config('test.deal', :'deal', false);
select ok(fn_create_deal(:'lead') = :'deal'::uuid, 'C4 an open draft is reused, not duplicated');

-- PT pack without a coach: saved, not priced, cannot be submitted
select ok((fn_save_deal_draft(:'deal', ('[{"product_id":"' || :'mem1' || '"},{"product_id":"' || :'pt12' || '"}]')::jsonb))->'issues' = '["pt_needs_coach"]', 'C5 a PT pack without a coach is flagged');
do $$ begin
  perform fn_submit_deal(current_setting('test.deal')::uuid);
  raise exception 'FAIL C6 submitted a PT pack without a coach';
exception when check_violation then raise notice 'PASS C6 a PT pack cannot be submitted without a coach'; end $$;

-- with Sara and a 20% discount: priced by fn_price_deal, needs approval (Mona's allowance is 10%)
select fn_save_deal_draft(:'deal', ('[{"product_id":"' || :'mem1' || '"},{"product_id":"' || :'pt12' || '","provider_membership_id":"a0000000-0000-0000-0000-000000000023"}]')::jsonb, 20) as d \gset
select ok((:'d'::jsonb)->>'total_piastres' = '552000' and (:'d'::jsonb)->>'discount_piastres' = '138000', 'C7 totals come from fn_price_deal (6,900 − 20% = 5,520 EGP)');
select ok((:'d'::jsonb)#>>'{approval_preview,needs_approval}' = 'true' and (:'d'::jsonb)#>'{approval_preview,reasons}' ? 'discount_over_allowance', 'C8 the preview says the discount needs approval');
select ok(((:'d'::jsonb)->'items'->1->>'net_per_session_piastres')::bigint = round(((:'d'::jsonb)->'items'->1->>'per_session_piastres')::bigint * 0.86), 'C9 item per-session net = gross × 0.86');
select ok((fn_submit_deal(:'deal')).status = 'pending_approval', 'C10 submitted: pending approval');

select login(:SM);
select ok(exists (select 1 from jsonb_array_elements(fn_sales_approvals(:BRANCH_A)) a where a->>'subject_id' = :'deal' and a->'deal'->>'total_piastres' = '552000'), 'C11 the approval is in the manager''s queue with the deal total');
select fn_decide_approval((select approval_id from deals where id = :'deal'), true, 'ok');
select login(:MONA);
select ok((fn_deal(:'deal'))->>'status' = 'approved', 'C12 approved');

-- 50% cash → partially paid, client created, 6 of 12 credits with Sara, welcome call, head coach told
select (fn_record_payment(:'deal', 276000, 'cash', 'r1'))->>'client_id' as client \gset
select ok((select status = 'partially_paid' from deals where id = :'deal'), 'C13 half paid: partially_paid');
select ok(fn_credit_balance(:'client', :SARA_M) = 6, 'C14 6 of 12 sessions released with Sara (pro-rata)');
select ok(exists (select 1 from jsonb_array_elements((fn_deal(:'deal'))->'items') i where i->>'credits_issued' = '6'), 'C15 the deal shows credits issued');
reset role;
select ok(exists (select 1 from follow_ups where client_id = :'client' and assigned_to_membership_id = :SARA_M::uuid and title like 'Welcome call%'), 'C16 Sara has the welcome-call task');
select ok(exists (select 1 from notifications where recipient_profile_id = '00000000-0000-0000-0000-000000000020' and type = 'client.pt_purchased' and title like '%→ Sara Fathy'), 'C17 head coach A told "client → Sara"');
set role authenticated;
select login(:MONA);
do $$ begin
  perform fn_record_payment(current_setting('test.deal')::uuid, 300000, 'cash');
  raise exception 'FAIL C18 overpayment accepted';
exception when check_violation then raise notice 'PASS C18 paying more than the remaining amount is refused'; end $$;
select fn_record_payment(:'deal', 276000, 'card', 'r2');
select ok(fn_credit_balance(:'client', :SARA_M) = 12 and (select status = 'paid' from deals where id = :'deal'), 'C19 fully paid: 12 sessions with Sara');

-- void needs approval and refunds unconsumed credits
select id as pay2 from payments where deal_id = :'deal' and reference = 'r2' \gset
select set_config('test.pay2', :'pay2', false);
select fn_request_payment_void(:'pay2', 'card charged twice') as void_a \gset
select ok((select voided_at is null from payments where id = :'pay2'), 'C20 requesting a void changes nothing yet');
do $$ begin
  perform fn_request_payment_void(current_setting('test.pay2')::uuid, 'again');
  raise exception 'FAIL C21 duplicate void request';
exception when check_violation then raise notice 'PASS C21 one pending void per payment'; end $$;
select login(:SM);
select fn_decide_approval(:'void_a', true, 'confirmed with the bank');
select ok((select voided_at is not null from payments where id = :'pay2') and (select status = 'partially_paid' and paid_piastres = 276000 from deals where id = :'deal'), 'C22 approved void: payment voided, deal back to partially paid');
select ok(fn_credit_balance(:'client') = 0 and (select bool_and(status = 'refunded') from credit_lots where client_id = :'client'), 'C23 unconsumed credits refunded');

-- list price → approved at once
select login(:MONA);
reset role;
insert into leads(branch_id, full_name, phone, owner_membership_id) values (:BRANCH_A, 'List Price Lead', '+201055560002', 'a0000000-0000-0000-0000-000000000011') returning id as lead2 \gset
set role authenticated;
select fn_create_deal(:'lead2') as deal2 \gset
select fn_save_deal_draft(:'deal2', ('[{"product_id":"' || :'mem1' || '"}]')::jsonb);
select ok((fn_submit_deal(:'deal2')).status = 'approved', 'C24 a list-price deal is approved at once');

-- scopes
select login(:HANA);
do $$ begin
  perform fn_deal(current_setting('test.deal')::uuid);
  raise exception 'FAIL C25 branch-B rep read a branch-A deal';
exception when no_data_found then raise notice 'PASS C25 deals are scoped'; end $$;
do $$ begin
  perform fn_money_summary(to_char(now(), 'YYYY-MM'));
  raise exception 'FAIL C26 rep read the money summary';
exception when insufficient_privilege then raise notice 'PASS C26 the money summary is top management''s'; end $$;
select login(:CEO);
select ok(((fn_money_summary(to_char(now(), 'YYYY-MM')))->>'collected_piastres')::bigint >= 276000, 'C27 money summary counts collected payments (voids excluded)');
reset role; select fn_refresh_views(true); set role authenticated; select login(:CEO);
select ok(((fn_commission_report(to_char(now(), 'YYYY-MM')))->>'liability_total_piastres')::bigint
          = (select sum(qty_remaining * per_session_value_piastres) from credit_lots where status = 'active' and expires_at > now()), 'C27b liability total equals remaining credits × value');
select ok((select bool_and(abs((c->>'net_per_session_piastres')::bigint - round((c->>'per_session_piastres')::bigint * 0.86)) <= 1)
           from jsonb_array_elements((fn_commission_report(to_char(now(), 'YYYY-MM')))->'coaches') c where (c->>'sessions_burned')::int > 0), 'C27c per-session net = gross × 0.86 for every coach');

-- expiry extension: rep → approval; manager → applied; an expired pack comes back with its sessions
select login(:MONA);
select ok((fn_extend_expiry((select id from credit_lots where client_id = '00000000-0000-0000-0002-000000000002' order by issued_at limit 1), now() + interval '200 days', 'travelled'))->>'ok' = 'false',
          'C28 a rep''s extension becomes an approval');
reset role;
update credit_lots set expires_at = now() - interval '1 day' where client_id = '00000000-0000-0000-0002-000000000011' and status = 'active';
select fn_expire_credits();
select id as lot, (select -qty from credit_ledger where lot_id = l.id and entry_type = 'expire') as lost_qty from credit_lots l where client_id = '00000000-0000-0000-0002-000000000011' limit 1 \gset
set role authenticated;
select login(:SM);
select ok((fn_sales_client('00000000-0000-0000-0002-000000000011'))#>>'{lots,0,status}' = 'expired', 'C29 the client view shows the expired pack');
select ok((fn_extend_expiry(:'lot', now() + interval '30 days', 'medical note'))->>'ok' = 'true', 'C30 the sales manager extends at once');
select ok((select status = 'active' and qty_remaining = :lost_qty from credit_lots where id = :'lot'), 'C31 the expired pack is back with its unused sessions');

-- catalog editor: branch override, and only managers/top management edit
select fn_save_product(null, 'PT12', 'PT pack — 12 sessions (Zayed)', 'pt_pack', :BRANCH_B, 600000, null, 12, 90) as pt12b \gset
select ok((select price_piastres = 600000 from fn_deal_catalog(:BRANCH_B) where code = 'PT12') and (select price_piastres = 540000 from fn_deal_catalog(:BRANCH_A) where code = 'PT12'),
          'C32 a branch price overrides the all-branches price in that branch only');
select login(:MONA);
do $$ begin
  perform fn_save_product(null, 'X1', 'Nope', 'membership', null, 1, 30);
  raise exception 'FAIL C33 rep edited the catalog';
exception when insufficient_privilege then raise notice 'PASS C33 reps cannot edit the catalog'; end $$;

reset role;
drop function login(uuid); drop function ok(boolean, text);
select 'ALL MONEY TESTS PASSED' as result;
