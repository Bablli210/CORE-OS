-- GymOS M7 automation tests: delivery claims are idempotent by notification id (lease, close once, never resent through
-- a provider that can't dedupe), delivery status only moves forward, reminders and "time to renew" are once per
-- recipient, digests are queued once per period and read as the recipient, the freeze loop ends in the nightly job at
-- 03:30 Cairo, refunds and transfers go through approvals, the cron schedules exist.
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

create or replace function login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p::text,''), false),
         set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, false) $$;
create or replace function ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond then raise notice 'PASS %', msg; else raise exception 'FAIL %', msg; end if; end $$;

\set CEO '''00000000-0000-0000-0000-000000000001'''
\set KARIM '''00000000-0000-0000-0000-000000000010'''
\set MONA '''00000000-0000-0000-0000-000000000011'''
\set AHMED '''00000000-0000-0000-0000-000000000020'''
\set MAHMOUD '''00000000-0000-0000-0000-000000000022'''
\set HASSAN_P '''00000000-0000-0000-0001-000000000001'''
\set HASSAN '''00000000-0000-0000-0002-000000000001'''
\set KHALED '''00000000-0000-0000-0002-000000000005'''
\set MAHMOUD_M '''a0000000-0000-0000-0000-000000000022'''
\set BRANCH_A '''b0000000-0000-0000-0000-00000000000a'''
\set F1 '''00000000-0000-0000-0009-0000000000f1'''

-- the local cron jobs would deliver or queue rows underneath the test: pause them, resume at the end
select cron.alter_job(jobid, active := false) from cron.job where jobname in ('gymos-notify', 'gymos-hourly-notifications', 'gymos-nightly');
update notifications set status = 'sent' where channel <> 'in_app' and status = 'pending';   -- a clean outbox
-- a client of Mahmoud and Mona with exactly 2 sessions left, whatever the other suites did before
insert into clients(id, home_branch_id, full_name, phone, coach_membership_id, rep_membership_id, status)
values (:F1, :BRANCH_A, 'Fixture Renewal', '+201099900050', :MAHMOUD_M, 'a0000000-0000-0000-0000-000000000011', 'active');
insert into credit_lots(client_id, coach_membership_id, qty_issued, qty_remaining, per_session_value_piastres, tax_pct, net_per_session_value_piastres, expires_at)
values (:F1, :MAHMOUD_M, 10, 2, 40000, 14, 34400, now() + interval '60 days');

-- ---------------------------------------------------------------- the schedules
select ok((select count(*) = 4 from cron.job where jobname in ('gymos-refresh-5min', 'gymos-hourly-notifications', 'gymos-nightly', 'gymos-notify')),
          'A1 pg_cron has the three 0002 schedules plus notify');
select ok((select schedule = '30 0,1 * * *' and command like '%fn_nightly_if_due%' from cron.job where jobname = 'gymos-nightly')
          and (select schedule = '*/5 * * * *' from cron.job where jobname = 'gymos-notify'), 'A2 nightly at 00:30/01:30 UTC behind the Cairo guard; notify every 5 minutes');

-- ---------------------------------------------------------------- claims: idempotent by notification id
reset role;
select fn_notify_client(:HASSAN, 'session.added', 'T1 whatsapp', 'body', '{}', 'whatsapp') as n_wa \gset
select fn_notify(:KARIM, 'digest.test', 'T1 email', 'body', '{}', 'email') as n_mail \gset
select fn_notify(:HASSAN_P, 'program.activated', 'T1 push', 'body', '{}', 'push') as n_push \gset
select fn_notify(:HASSAN_P, 'lead.created', 'T1 in app', 'body', '{}', 'in_app') as n_inapp \gset

do $$ begin
  set local role authenticated;
  perform login('00000000-0000-0000-0000-000000000001');
  perform fn_notify_claim();
  raise exception 'FAIL A3 a signed-in user claimed notifications';
exception when insufficient_privilege then raise notice 'PASS A3 only the service role can claim deliveries'; end $$;

set role service_role;
select fn_notify_claim(50, 300, '{}', '{whatsapp,email}') as c1 \gset
select ok((select count(*) = 2 from jsonb_array_elements(:'c1'::jsonb) x where x->>'id' in (:'n_wa', :'n_mail'))
          and not exists (select 1 from jsonb_array_elements(:'c1'::jsonb) x where x->>'id' in (:'n_push', :'n_inapp')),
          'A4 a claim hands out its channels only: never in-app, and push stays pending without a push provider');
select ok((select x->'recipient'->>'phone' = '+201110000001' and x->'recipient'->>'name' like 'Hassan%' from jsonb_array_elements(:'c1'::jsonb) x where x->>'id' = :'n_wa'),
          'A5 the claim carries the recipient''s phone and name');
select fn_notify_claim(50, 300, '{whatsapp,email}', '{whatsapp,email}') as c2 \gset
select ok(not exists (select 1 from jsonb_array_elements(:'c2'::jsonb) x where x->>'id' in (:'n_wa', :'n_mail')), 'A6 a leased notification is not handed out twice');

select ok(fn_notify_result(:'n_wa', 'sent', 'sandbox', 'sandbox-' || :'n_wa', null, '+201110000001'), 'A7 the first result closes the delivery');
select ok(not fn_notify_result(:'n_wa', 'sent', 'sandbox', 'other-id', null, '+201110000001')
          and (select provider_message_id = 'sandbox-' || :'n_wa' from notification_deliveries where notification_id = :'n_wa'), 'A8 a second result for the same notification changes nothing');
reset role;
select ok((select status = 'sent' and sent_at is not null from notifications where id = :'n_wa')
          and exists (select 1 from events where type = 'notification.sent' and subject_id = :'n_wa'), 'A9 sent: the notification is marked and an event written');

-- expired lease: not idempotent → closed as failed, never handed out again; idempotent → handed out again
update notification_deliveries set lease_until = now() - interval '1 minute' where notification_id = :'n_mail';
set role service_role;
select fn_notify_claim(50, 300, '{}', '{whatsapp,email}') as c3 \gset
reset role;
select ok(not exists (select 1 from jsonb_array_elements(:'c3'::jsonb) x where x->>'id' = :'n_mail')
          and (select status = 'failed' and error like '%not resent%' from notifications where id = :'n_mail'),
          'A10 a lost result through a provider without idempotency is closed as failed, never resent');
select fn_notify(:KARIM, 'digest.test', 'T2 email', 'body', '{}', 'email') as n_mail2 \gset
set role service_role;
select fn_notify_claim(50, 300, '{email}', '{email}') as c4 \gset
reset role;
update notification_deliveries set lease_until = now() - interval '1 minute' where notification_id = :'n_mail2';
set role service_role;
select fn_notify_claim(50, 300, '{email}', '{email}') as c5 \gset
reset role;
select ok(exists (select 1 from jsonb_array_elements(:'c5'::jsonb) x where x->>'id' = :'n_mail2' and (x->>'attempt')::int = 2),
          'A11 through an idempotent provider it is handed out again, attempt 2, same notification id');

-- retry: backs off, then fails after notify.max_attempts
set role service_role;
select fn_notify_result(:'n_mail2', 'retry', 'resend', null, '429', 'sales.manager@gymos.local');
select fn_notify_claim(50, 300, '{email}', '{email}') as c6 \gset
reset role;
select ok(not exists (select 1 from jsonb_array_elements(:'c6'::jsonb) x where x->>'id' = :'n_mail2')
          and (select state = 'retry' and next_attempt_at > now() from notification_deliveries where notification_id = :'n_mail2'), 'A12 a retry waits for its backoff');
update notification_deliveries set next_attempt_at = now() - interval '1 second' where notification_id = :'n_mail2';
set role service_role;
select fn_notify_claim(50, 300, '{email}', '{email}') as c7 \gset
select fn_notify_result(:'n_mail2', 'retry', 'resend', null, '503', 'sales.manager@gymos.local');
reset role;
select ok((select attempts = 3 and state = 'failed' from notification_deliveries where notification_id = :'n_mail2')
          and (select status = 'failed' and error = '503' from notifications where id = :'n_mail2'), 'A13 after max attempts it is failed with the provider''s error');

-- delivery status: forward only, repeats and unknown ids are no-ops
set role service_role;
select ok(fn_whatsapp_status('sandbox-' || :'n_wa', 'delivered'), 'A14 delivered moves the delivery forward');
select ok(not fn_whatsapp_status('sandbox-' || :'n_wa', 'delivered') and not fn_whatsapp_status('sandbox-' || :'n_wa', 'sent'), 'A15 a repeated or older status changes nothing');
select ok(fn_whatsapp_status('sandbox-' || :'n_wa', 'read') and not fn_whatsapp_status('sandbox-' || :'n_wa', 'failed'), 'A16 read after delivered; failed can''t follow read');
select ok(not fn_whatsapp_status('wamid.unknown', 'delivered'), 'A17 an unknown message id is ignored');
reset role;
select ok((select state = 'read' and delivered_at is not null and read_at is not null from notification_deliveries where notification_id = :'n_wa'), 'A18 the delivery keeps delivered and read times');

-- ---------------------------------------------------------------- reminders and "time to renew"
-- a session for Hassan with Mahmoud 24 hours from now, one reminder however often the job runs
insert into sessions(client_id, coach_membership_id, branch_id, scheduled_at, status)
values (:HASSAN, :MAHMOUD_M, :BRANCH_A, date_trunc('minute', now() + interval '24 hours'), 'booked') returning id as s_tomorrow \gset
select fn_hourly_notifications();
select fn_hourly_notifications();
select ok((select count(*) = 1 from notifications where type = 'session.reminder_24h' and data->>'session_id' = :'s_tomorrow' and channel = 'whatsapp'),
          'A19 booking a session for tomorrow produces one −24h WhatsApp reminder, not one per run');
-- the fixture has 2 sessions left with Mahmoud: one "time to renew" to the client per week, one notice each to coach and rep
select ok(fn_credit_balance(:F1) = 2, 'A20 (fixture) a client with 2 sessions left');
select ok((select count(*) = 1 from notifications where type = 'credits.low' and channel = 'whatsapp' and data->>'client_id' = :F1 and created_at > now() - interval '7 days'),
          'A21 a client with 2 credits gets one "time to renew" message per week, not one per hour');
select ok((select count(*) <= 1 from notifications where type = 'credits.low' and recipient_profile_id = :MAHMOUD and data->>'client_id' = :F1 and created_at > now() - interval '7 days'),
          'A22 the coach''s renewal notice is capped the same way');
-- a client without an account still gets the reminder, by phone
update clients set profile_id = null where id = :KHALED;
insert into sessions(client_id, coach_membership_id, branch_id, scheduled_at, status)
select :KHALED, coach_membership_id, home_branch_id, date_trunc('minute', now() + interval '2 hours'), 'booked' from clients where id = :KHALED returning id as s_khaled \gset
select fn_hourly_notifications();
select ok((select recipient_profile_id is null and client_id = :KHALED from notifications where type = 'session.reminder_2h' and data->>'session_id' = :'s_khaled'),
          'A23 a client without an account is reminded on their phone (queued on the client)');
update clients set profile_id = '00000000-0000-0000-0001-000000000005' where id = :KHALED;

-- ---------------------------------------------------------------- digests
select ok(fn_queue_digests(((cairo_date(now()))::text || ' 14:10')::timestamp at time zone 'Africa/Cairo') = 0, 'A24 no digest outside its hour');
-- judged on the result, not on this call's count: between 20:00 and 21:00 Cairo the real hourly job may already have
-- queued today's digests, and then this call rightly adds none
select fn_queue_digests(((cairo_date(now()))::text || ' 20:10')::timestamp at time zone 'Africa/Cairo') as d1 \gset
select ok((select count(distinct (recipient_profile_id, data->>'branch_id', data->>'role')) from notifications
            where type = 'digest.daily' and data->>'period' = cairo_date(now())::text)
          = (select count(*) from (select distinct m.profile_id, m.role, m.branch_id from memberships m join profiles p on p.id = m.profile_id
                  where m.is_active and m.role in ('head_coach', 'sales_manager') and p.email is not null) x)
          and (select count(*) = count(distinct (recipient_profile_id, data->>'branch_id', data->>'role', channel)) from notifications
                where type = 'digest.daily' and data->>'period' = cairo_date(now())::text)
          and fn_queue_digests(((cairo_date(now()))::text || ' 20:40')::timestamp at time zone 'Africa/Cairo') = 0,
          'A25 20:00 Cairo: one daily digest per head coach and sales manager (per branch), once');
select ok(fn_queue_digests(((cairo_date(now()) + (6 - extract(dow from cairo_date(now()))::int + 7) % 7)::text || ' 09:10')::timestamp at time zone 'Africa/Cairo') >= 2,
          'A26 Saturday 09:00 Cairo: the weekly digest for top management');
select fn_refresh_views(false);
set role service_role;
select fn_digest((select id from notifications where type = 'digest.daily' and recipient_profile_id = :KARIM and data->>'branch_id' = :BRANCH_A order by created_at desc limit 1)) as dg_sales \gset
select fn_digest((select id from notifications where type = 'digest.daily' and recipient_profile_id = :AHMED order by created_at desc limit 1)) as dg_coach \gset
select fn_digest((select id from notifications where type = 'digest.weekly' and recipient_profile_id = :CEO order by created_at desc limit 1)) as dg_week \gset
reset role;
select ok(jsonb_array_length((:'dg_sales'::jsonb)->'tiles') = 8 and jsonb_array_length((:'dg_sales'::jsonb)->'reps') > 0 and (:'dg_sales'::jsonb)->'today' ? 'visits',
          'A27 the sales manager''s daily digest: today, the sales tiles, the reps');
select ok(jsonb_array_length((:'dg_coach'::jsonb)->'coaches') = (select count(*) from memberships where role = 'coach' and branch_id = :BRANCH_A and is_active),
          'A28 the head coach''s daily digest lists his branch''s coaches only (read as him)');
select ok(jsonb_array_length((:'dg_week'::jsonb)->'tiles') = 15 and jsonb_array_length((:'dg_week'::jsonb)->'weeks') > 0, 'A29 the weekly digest: the admin tiles and two weeks per branch');
select ok(current_setting('request.jwt.claim.sub', true) is distinct from :AHMED, 'A30 the digest does not leave the caller signed in as the recipient');

-- ---------------------------------------------------------------- the freeze loop
update freezes set status = 'rejected' where client_id = :HASSAN and status in ('pending', 'active');
update clients set status = 'active' where id = :HASSAN;
update settings set value = '10' where key = 'freeze.max_count';   -- other suites may have used Hassan's two freezes
set role authenticated; select login(:HASSAN_P);
select fn_request_freeze(:HASSAN, now() + interval '1 minute', now() + interval '10 days', 'Travelling') as fr \gset
select login(:KARIM);
select fn_decide_approval((select approval_id from freezes where id = :'fr'), true, 'ok');
reset role;
select ok((select status = 'frozen' from clients where id = :HASSAN) and (select status = 'active' from freezes where id = :'fr'), 'A31 request → approve → the client is frozen');
select max(expires_at) as exp_before from credit_lots where client_id = :HASSAN and status = 'active' \gset
update freezes set starts_at = now() - interval '10 days 1 minute', ends_at = now() - interval '1 minute' where id = :'fr';
select fn_nightly() as nightly \gset
select ok((select status = 'ended' from freezes where id = :'fr') and (select status = 'active' from clients where id = :HASSAN)
          and (select max(expires_at) = :'exp_before'::timestamptz + interval '10 days' from credit_lots where client_id = :HASSAN and status = 'active'),
          'A32 the nightly job ends the freeze at its date and extends expiry by the frozen days');
select ok(((:'nightly'::jsonb)->>'freezes_ended')::int >= 1 and exists (select 1 from events where type = 'job.nightly' and (payload->>'freezes_ended')::int >= 1 and payload ? 'expired'),
          'A33 the job.nightly event shows its counts');
select ok(exists (select 1 from notifications where type = 'freeze.ended' and data->>'freeze_id' = :'fr' and channel = 'whatsapp'), 'A34 the client is told the freeze ended');

update settings set value = '2' where key = 'freeze.max_count';

-- 03:30 Cairo guard, once per Cairo date
delete from events where type = 'job.nightly' and payload->>'cairo_date' = cairo_date(now())::text;
select ok(fn_nightly_if_due(((cairo_date(now()))::text || ' 02:30')::timestamp at time zone 'Africa/Cairo') is null, 'A35 the nightly guard skips 02:30 Cairo');
select ok(fn_nightly_if_due(((cairo_date(now()))::text || ' 03:30')::timestamp at time zone 'Africa/Cairo') is not null
          and fn_nightly_if_due(((cairo_date(now()))::text || ' 03:31')::timestamp at time zone 'Africa/Cairo') is null, 'A36 it runs at 03:30 Cairo, once per day');

-- ---------------------------------------------------------------- refunds and transfers
select x.id as pay from payments x join deals d on d.id = x.deal_id
 where d.rep_membership_id = 'a0000000-0000-0000-0000-000000000011' and d.client_id is not null and d.client_id <> :HASSAN and x.voided_at is null
 order by x.received_at desc limit 1 \gset
set role authenticated; select login(:MONA);
select fn_request_refund(:'pay', 'Changed her mind') as refund_a \gset
select ok((select type = 'refund' and status = 'pending' and (payload->>'amount_piastres')::bigint > 0 from approvals where id = :'refund_a'), 'A37 a rep asks for a refund; it waits for the sales manager');
do $$ begin
  perform fn_request_refund((select subject_id from approvals where type = 'refund' and status = 'pending' order by requested_at desc limit 1), 'twice');
  raise exception 'FAIL A38 a second refund request for the same payment was accepted';
exception when check_violation then raise notice 'PASS A38 one pending request per payment'; end $$;
select login(:KARIM);
select fn_decide_approval(:'refund_a', true, 'refunded in cash');
reset role;
select ok((select voided_at is not null from payments where id = :'pay') and exists (select 1 from events where type = 'payment.voided' and subject_id = :'pay'),
          'A39 approved: the payment is voided');

select l.id as lot, l.qty_remaining as lot_qty from credit_lots l where l.client_id = :F1 and l.status = 'active' and l.qty_remaining > 0 limit 1 \gset
set role authenticated; select login(:MONA);
select fn_request_transfer(:'lot', :KHALED, 'Gift to a friend') as tr \gset
select ok(jsonb_array_length((fn_client_requests(:F1))->'transfers') = 1, 'A40 the transfer shows on the client''s requests');
do $$ begin
  perform fn_request_transfer((select subject_id from approvals where type = 'transfer' order by requested_at desc limit 1), '00000000-0000-0000-0009-0000000000f1', 'to self');
  raise exception 'FAIL A41 a transfer to the same client or a duplicate was accepted';
exception when check_violation then raise notice 'PASS A41 no transfer to the same client, one pending per pack'; end $$;
select login(:KARIM);
select fn_decide_approval(:'tr', true, null);
reset role;
select ok((select client_id = :KHALED from credit_lots where id = :'lot')
          and (select count(*) = 2 from credit_ledger where lot_id = :'lot' and reason in ('transfer out', 'transfer in')), 'A42 approved: the pack moves with a ledger row on each side');
set role authenticated; select login(:MONA);
select ok((select x->>'status' = 'approved' from jsonb_array_elements((fn_client_requests(:F1))->'transfers') x), 'A43 the source client still sees the approved transfer');
do $$ begin
  perform fn_money_requests(to_char(now(), 'YYYY-MM'));
  raise exception 'FAIL A44 a rep read the money requests';
exception when insufficient_privilege then raise notice 'PASS A44 the money requests are top management''s'; end $$;
select login(:CEO);
select ok((select count(*) >= 2 from jsonb_array_elements(fn_money_requests(to_char(cairo_date(now()), 'YYYY-MM'))) x where x->>'id' in (:'refund_a', :'tr')), 'A45 /admin/money lists the refund and the transfer');
select ok((select x->>'action' = 'read' and x->'new_row'->>'provider' = 'sandbox' and x->'new_row'->>'to' = '+201110000001'
           from jsonb_array_elements((fn_audit_explorer('deliveries', null, null, null, null, 'T1 whatsapp'))->'rows') x),
          'A46 the audit explorer shows each delivery: state, provider, recipient');

reset role;
select cron.alter_job(jobid, active := true) from cron.job where jobname in ('gymos-notify', 'gymos-hourly-notifications', 'gymos-nightly');
drop function login(uuid); drop function ok(boolean, text);
select 'ALL AUTOMATION TESTS PASSED' as result;
