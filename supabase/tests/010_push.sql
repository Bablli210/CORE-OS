-- GymOS M8 push tests: the phone registers its Expo token for the signed-in person, a shared phone moves to the next
-- person, sign-out and DeviceNotRegistered revoke it, only the service role revokes for Expo, and the notify claim
-- carries the recipient's active tokens on push rows.
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

create or replace function login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p::text,''), false),
         set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, false) $$;
create or replace function ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond then raise notice 'PASS %', msg; else raise exception 'FAIL %', msg; end if; end $$;

\set HASSAN_P '''00000000-0000-0000-0001-000000000001'''
\set FARIDA_P '''00000000-0000-0000-0001-000000000008'''

select cron.alter_job(jobid, active := false) from cron.job where jobname = 'gymos-notify';

set role authenticated; select login(:HASSAN_P);
select fn_register_push_token('ExponentPushToken[hassan-phone]', 'android', 'Pixel') as t1 \gset
select ok((select count(*) = 1 from push_tokens where token = 'ExponentPushToken[hassan-phone]' and revoked_at is null), 'P1 the member registers their phone');
select ok(fn_register_push_token('ExponentPushToken[hassan-phone]', 'android', 'Pixel') = :'t1', 'P2 registering again refreshes the same row');
do $$ begin
  perform fn_register_push_token('not-a-token', 'android', null);
  raise exception 'FAIL P3 a malformed token was accepted';
exception when check_violation then raise notice 'PASS P3 only Expo push tokens are accepted'; end $$;
select ok((select count(*) = 1 from push_tokens), 'P4 a member sees only their own tokens (RLS)');

select login(:FARIDA_P);
select ok((select count(*) = 0 from push_tokens), 'P5 another member sees none of them');
select fn_register_push_token('ExponentPushToken[hassan-phone]', 'android', 'Pixel');
reset role;
select ok((select profile_id = :FARIDA_P from push_tokens where token = 'ExponentPushToken[hassan-phone]'), 'P6 a shared phone moves to the person who signs in next');

set role authenticated; select login(:HASSAN_P);
select ok(not fn_unregister_push_token('ExponentPushToken[hassan-phone]'), 'P7 a member cannot unregister someone else''s phone');
select login(:FARIDA_P);
select ok(fn_unregister_push_token('ExponentPushToken[hassan-phone]'), 'P8 sign-out unregisters the phone');
select fn_register_push_token('ExponentPushToken[hassan-phone]', 'android', 'Pixel');
do $$ begin
  perform fn_revoke_push_token('ExponentPushToken[hassan-phone]', 'DeviceNotRegistered');
  raise exception 'FAIL P9 a member revoked a token as the service';
exception when insufficient_privilege then raise notice 'PASS P9 only the notify function revokes dead devices'; end $$;

reset role;
update notifications set status = 'sent' where channel = 'push' and status = 'pending';
select fn_notify(:FARIDA_P, 'session.completed', 'P10 push', '7 sessions left', '{}', 'push') as n_push \gset
set role service_role;
select fn_notify_claim(50, 300, '{}', '{push}') as c \gset
select ok((select x->'recipient'->'push_tokens' = '["ExponentPushToken[hassan-phone]"]'::jsonb from jsonb_array_elements(:'c'::jsonb) x where x->>'id' = :'n_push'),
          'P10 a push row is claimed with the recipient''s active devices');
select ok(fn_revoke_push_token('ExponentPushToken[hassan-phone]', 'DeviceNotRegistered'), 'P11 Expo''s DeviceNotRegistered revokes the token');
reset role;
select ok(exists (select 1 from events where type = 'push.revoked') and exists (select 1 from events where type = 'push.registered'), 'P12 registrations and revocations are events');

select cron.alter_job(jobid, active := true) from cron.job where jobname = 'gymos-notify';
drop function login(uuid); drop function ok(boolean, text);
select 'ALL PUSH TESTS PASSED' as result;
