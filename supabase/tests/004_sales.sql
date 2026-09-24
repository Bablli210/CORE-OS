-- GymOS M2 sales tests: read shapes are scoped like RLS; touches/follow-ups through RPCs; wizard resume for anon;
-- anon can call nothing but the wizard functions.
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

create or replace function login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p::text,''), false),
         set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, false) $$;
create or replace function ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond then raise notice 'PASS %', msg; else raise exception 'FAIL %', msg; end if; end $$;

\set MONA '''00000000-0000-0000-0000-000000000011'''
\set MONA_M '''a0000000-0000-0000-0000-000000000011'''
\set YOUSSEF '''00000000-0000-0000-0000-000000000012'''
\set HANA '''00000000-0000-0000-0000-000000000013'''
\set SM '''00000000-0000-0000-0000-000000000010'''
\set BRANCH_A '''b0000000-0000-0000-0000-00000000000a'''

-- fresh leads for this file (earlier test files leave their own data behind)
set role authenticated;
select login(:MONA);
select (fn_create_lead(:BRANCH_A, 'Sales Test Mona', '01055550001', 'instagram', null, '{pt}'))->>'lead_id' as mona_lead \gset
select login(:YOUSSEF);
select (fn_create_lead(:BRANCH_A, 'Sales Test Youssef', '01055550002', 'walk_in'))->>'lead_id' as youssef_lead \gset
select set_config('test.youssef_lead', :'youssef_lead', false);

-- ---------------------------------------------------------------- read shapes follow the leads RLS scope
select login(:MONA);
select ok((select bool_and(owner_membership_id = :MONA_M::uuid) and count(*) > 0 from fn_sales_leads(:BRANCH_A)), 'B1 a rep lists only her own leads');
select ok(not exists (select 1 from fn_sales_leads(:BRANCH_A) where id = :'youssef_lead'), 'B2 another rep''s lead is not listed');
select ok((select owner_name = 'Mona Samir' and source_code = 'instagram' and sla_state = 'due' from fn_sales_leads(:BRANCH_A) where id = :'mona_lead'), 'B3 owner name, source and SLA state come from the server');
select ok((fn_sales_lead(:'mona_lead'))->>'full_name' = 'Sales Test Mona', 'B4 lead detail for own lead');
do $$ begin
  perform fn_sales_lead(current_setting('test.youssef_lead')::uuid);
  raise exception 'FAIL B5 rep opened another rep''s lead';
exception when no_data_found then raise notice 'PASS B5 lead detail hides other reps'' leads'; end $$;

select ok((fn_find_by_phone('010 5555 0001'))->>'visible' = 'true' and (fn_find_by_phone('01055550001'))->>'name' = 'Sales Test Mona', 'B6 duplicate check finds own lead by any phone format');
select ok((fn_find_by_phone('01055550002'))->>'visible' = 'false' and (fn_find_by_phone('01055550002'))->>'name' is null
          and (fn_find_by_phone('01055550002'))->>'owner_name' = 'Youssef', 'B7 another rep''s lead: exists, owner first name, no details');
select ok((fn_find_by_phone('01110000001'))->>'kind' = 'client', 'B8 duplicate check finds clients too');
select ok((fn_find_by_phone('0109999'))->>'found' = 'false', 'B9 short input finds nothing');

-- ---------------------------------------------------------------- touches and follow-ups through RPCs
select fn_log_touch(:'mona_lead', null, 'call', 'outbound', 'intro call');
select ok((select status = 'contacted' and first_contact_at is not null from leads where id = :'mona_lead'), 'B10 first outbound touch contacts the lead');
reset role;
select ok(exists (select 1 from events where type = 'touch.logged' and subject_id = :'mona_lead'), 'B11 touch emits an event');
set role authenticated;
do $$ begin
  perform fn_log_touch(current_setting('test.youssef_lead')::uuid, null, 'call');
  raise exception 'FAIL B12 touch on another rep''s lead';
exception when insufficient_privilege then raise notice 'PASS B12 cannot touch another rep''s lead'; end $$;

select fn_add_follow_up(:'mona_lead', null, 'Overdue check-in', now() - interval '3 hours') as fu_overdue \gset
select set_config('test.fu_overdue', :'fu_overdue', false);
select fn_add_follow_up(:'mona_lead', null, 'Later today', now() + interval '1 minute') as fu_today \gset
select ok((select assigned_to_membership_id = :MONA_M::uuid from follow_ups where id = :'fu_overdue'), 'B13 follow-up defaults to the lead owner');
select ok((select (x->>'id')::uuid = :'fu_overdue'::uuid and (x->>'overdue')::boolean
           from jsonb_array_elements((fn_sales_today(:BRANCH_A))->'follow_ups') x limit 1), 'B14 Today lists overdue follow-ups first');

select login(:HANA);
do $$ begin
  perform fn_complete_follow_up(current_setting('test.fu_overdue')::uuid);
  raise exception 'FAIL B15 branch-B rep completed a branch-A follow-up';
exception when insufficient_privilege then raise notice 'PASS B15 others cannot complete my follow-up'; end $$;
select login(:MONA);
select fn_complete_follow_up(:'fu_overdue');
select ok((select status = 'done' and completed_at is not null from follow_ups where id = :'fu_overdue'), 'B16 one call completes a follow-up');

-- ---------------------------------------------------------------- manager views
do $$ begin
  perform fn_sales_queue('b0000000-0000-0000-0000-00000000000a');
  raise exception 'FAIL B17 rep read the queue';
exception when insufficient_privilege then raise notice 'PASS B17 the queue is the sales manager''s'; end $$;
select ok((select count(*) = 0 from fn_sales_team(:BRANCH_A, to_char(now(), 'YYYY-MM'))), 'B18 a rep gets no team table');
select login(:SM);
select ok(exists (select 1 from jsonb_array_elements((fn_sales_queue(:BRANCH_A))->'unassigned') x where x->>'full_name' = 'Inbound Lead A'), 'B19 unassigned inbound leads are in the queue');
select ok((select count(*) = 2 and bool_and(full_name is not null) from fn_sales_team(:BRANCH_A, to_char(now(), 'YYYY-MM'))), 'B20 team table lists both branch-A reps');
select ok(exists (select 1 from fn_sales_leads(:BRANCH_A) where id = :'youssef_lead'), 'B21 the manager lists every lead in the branch');

-- ---------------------------------------------------------------- wizard resume (anon)
select login(:MONA);
select fn_issue_onboarding_token(:'mona_lead') as tok \gset
reset role; set role anon; select login(null);
select ok((fn_onboarding_state(:'tok'))->>'ok' = 'true' and (fn_onboarding_state(:'tok'))->>'advisor' = 'Mona', 'B22 anon reads the wizard state by token');
select fn_submit_onboarding(:'tok', 'identity', '{"full_name":"Sales Test Mona","gender":"female"}');
select ok((fn_onboarding_state(:'tok'))#>>'{responses,identity,gender}' = 'female', 'B23 saved steps come back (resume after refresh)');
select ok((fn_onboarding_state('bogus'))->>'ok' = 'false', 'B24 bad token rejected');
select ok(((fn_onboarding_state(:'tok')) - 'responses' - 'full_name' - 'advisor' - 'contact_by' - 'branch_name' - 'branch_phone' - 'heard_from' - 'instagram_handle' - 'ok' - 'completed') = '{}'::jsonb,
          'B25 wizard state exposes no other lead fields');
do $$ begin
  perform * from fn_sales_leads();
  raise exception 'FAIL B26 anon listed leads';
exception when insufficient_privilege then raise notice 'PASS B26 anon cannot call sales functions'; end $$;

reset role;
select ok(coalesce(array_agg(p.proname order by p.proname), '{}') = array['fn_normalize_phone','fn_onboarding_state','fn_submit_onboarding']::name[],
          'B27 anon can execute exactly the wizard functions')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') and p.proname not in ('login', 'ok', 'nc', 'q1', 'qn');

drop function login(uuid); drop function ok(boolean, text);
select 'ALL SALES TESTS PASSED' as result;
