-- GymOS security tests for 0005: internal helpers are not callable over the API; manual freeze end is checked.
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

create or replace function login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p::text,''), false),
         set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, false) $$;
create or replace function ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond then raise notice 'PASS %', msg; else raise exception 'FAIL %', msg; end if; end $$;

-- every internal helper: no EXECUTE for API roles
select ok(not bool_or(has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute')),
          'S1 internal helpers are not executable by anon or authenticated')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('fn_emit_event','fn_notify','fn_notify_client','fn_notify_role','fn_round_robin_next','fn_convert_lead',
  'fn_issue_credits','fn_set_primary_coach','fn_settle_unpaid_sessions','fn_consume_credit','fn_restore_credit','fn_apply_attendance',
  'fn_flag_for_sales_internal','fn_apply_expiry_extension','fn_expire_credits','fn_compute_risk_scores','fn_mark_lapsed');

-- a signed-in client cannot mint credits for themselves
set role authenticated;
select login('00000000-0000-0000-0001-000000000001');
do $$ begin
  perform fn_issue_credits('00000000-0000-0000-0002-000000000001', null, 100, 0, null, 'a0000000-0000-0000-0000-000000000022');
  raise exception 'FAIL S2 client minted credits';
exception when insufficient_privilege then raise notice 'PASS S2 a client cannot call fn_issue_credits'; end $$;
do $$ begin
  perform fn_notify('00000000-0000-0000-0000-000000000001', 'spam', 'hi');
  raise exception 'FAIL S3 client sent a notification';
exception when insufficient_privilege then raise notice 'PASS S3 a client cannot call fn_notify'; end $$;

-- entry points still work end to end (they call the helpers as the owner): Mona flags a client for sales
select login('00000000-0000-0000-0000-000000000011');
select ok(fn_flag_for_sales('00000000-0000-0000-0002-000000000001', 'security test flag', 'manual') is not null, 'S4 entry points still reach the internal helpers');

-- manual freeze end: sales manager yes, rep no
reset role;
insert into freezes(client_id, starts_at, ends_at, status, reason) values ('00000000-0000-0000-0002-000000000003', now() - interval '2 days', now() + interval '5 days', 'active', 'security test') ;
select id as fz from freezes where reason = 'security test' \gset
select set_config('test.fz', :'fz', false);
set role authenticated;
select login('00000000-0000-0000-0000-000000000011');
do $$ begin
  perform fn_end_freeze(current_setting('test.fz')::uuid);
  raise exception 'FAIL S5 rep ended a freeze';
exception when insufficient_privilege then raise notice 'PASS S5 a rep cannot end a freeze'; end $$;
select login('00000000-0000-0000-0000-000000000010');
select fn_end_freeze(:'fz');
select ok((select status = 'ended' from freezes where id = :'fz'), 'S6 the sales manager ends a freeze');

reset role;
drop function login(uuid); drop function ok(boolean, text);
select 'ALL SECURITY TESTS PASSED' as result;
