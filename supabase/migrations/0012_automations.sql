-- GymOS — 0012_automations.sql (M7: automations and governance)
-- 1. Delivery of WhatsApp / email / push notifications by the `notify` Edge Function, idempotent by notification id:
--    one `notification_deliveries` row per notification, claimed under a lease, closed once. A notification is never
--    handed out again after its send may have happened, unless the channel's provider dedupes by notification id.
-- 2. Delivery status from the WhatsApp provider (`whatsapp-webhook`): sent → delivered → read, or failed.
-- 3. Digests: daily (head coach, sales manager) and weekly (top management) email rows, rendered by `notify` from the
--    dashboard accessors run as the recipient (`fn_digest`).
-- 4. Jobs: the hourly job caps "time to renew" per recipient and queues digests; the nightly job ends freezes that are
--    due and runs at 03:30 Cairo all year (summer UTC+3 and winter UTC+2); `notify` is invoked every 5 minutes.
-- 5. Refund and transfer requests (checked wrappers around fn_request_approval) and the read shapes for their screens.

create extension if not exists pg_net;

insert into settings(key, value, description) values
  ('notify.enabled', 'true', 'Deliver WhatsApp, email and push notifications (in-app ones always show)'),
  ('notify.max_attempts', '3', 'Delivery attempts before a notification is marked failed'),
  ('notify.batch_size', '50', 'Notifications delivered per notify run'),
  ('digest.daily_enabled', 'true', 'Email the head coach and sales manager a daily digest'),
  ('digest.daily_hour', '20', 'Cairo hour of the daily digest'),
  ('digest.weekly_enabled', 'true', 'Email top management a weekly digest'),
  ('digest.weekly_dow', '6', 'Weekday of the weekly digest (0 = Sunday … 6 = Saturday)'),
  ('digest.weekly_hour', '9', 'Cairo hour of the weekly digest')
on conflict (key) do nothing;

-- ===================================================================== deliveries
create table notification_deliveries (
  notification_id uuid primary key references notifications(id) on delete cascade,
  channel notification_channel not null,
  state text not null default 'claimed' check (state in ('claimed', 'retry', 'sent', 'delivered', 'read', 'failed')),
  attempts int not null default 0,
  lease_until timestamptz,
  next_attempt_at timestamptz,
  provider text,
  provider_message_id text unique,
  to_address text,
  last_error text,
  claimed_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  updated_at timestamptz not null default now()
);
create index on notification_deliveries (state, lease_until);
alter table notification_deliveries enable row level security;
create policy deliveries_read on notification_deliveries for select to authenticated using (is_top_management());
revoke all on notification_deliveries from anon, authenticated;
grant select on notification_deliveries to authenticated;

-- Hands out up to p_limit undelivered notifications on p_channels (those the caller has a provider for) and leases them
-- to the caller (the notify function).
-- Candidates: never claimed; or waiting for a retry that is due; or claimed with an expired lease — reclaimed only for
-- channels in p_reclaim (their provider dedupes by notification id), otherwise closed as failed: the send may have
-- gone out, and sending again could send it twice.
create or replace function fn_notify_claim(p_limit int default 50, p_lease_seconds int default 300, p_reclaim notification_channel[] default '{}',
  p_channels notification_channel[] default '{whatsapp,email,push}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_max int := fn_setting_int('notify.max_attempts', 3); v_out jsonb := '[]'; r record;
begin
  -- expired leases the provider cannot dedupe: close them, never resend
  with lost as (
    update notification_deliveries d set state = 'failed', last_error = 'no result after the lease; not resent (the provider has no idempotency key)', updated_at = now()
     where d.state = 'claimed' and d.lease_until < now() and not (d.channel = any(p_reclaim))
    returning d.notification_id)
  update notifications n set status = 'failed', error = 'delivery outcome unknown; not resent' from lost where n.id = lost.notification_id;

  if not coalesce((fn_setting('notify.enabled'))::boolean, true) then return '[]'; end if;

  for r in
    select n.*, d.state as d_state, d.attempts as d_attempts
    from notifications n left join notification_deliveries d on d.notification_id = n.id
    where n.channel <> 'in_app' and n.channel = any(p_channels) and n.status = 'pending'
      and (d.notification_id is null
           or (d.state = 'retry' and d.next_attempt_at <= now())
           or (d.state = 'claimed' and d.lease_until < now() and d.channel = any(p_reclaim) and d.attempts < v_max))
    order by n.created_at
    limit greatest(1, least(p_limit, 500))
    for update of n skip locked
  loop
    insert into notification_deliveries(notification_id, channel, state, attempts, lease_until, claimed_at)
    values (r.id, r.channel, 'claimed', 1, now() + make_interval(secs => p_lease_seconds), now())
    on conflict (notification_id) do update set state = 'claimed', attempts = notification_deliveries.attempts + 1,
      lease_until = excluded.lease_until, claimed_at = now(), next_attempt_at = null, updated_at = now();
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'id', r.id, 'type', r.type, 'title', r.title, 'body', r.body, 'data', r.data, 'channel', r.channel, 'created_at', r.created_at,
      'attempt', coalesce(r.d_attempts, 0) + 1,
      'recipient', (select jsonb_build_object('profile_id', r.recipient_profile_id, 'client_id', r.client_id,
                      'name', coalesce(p.full_name, c.full_name), 'phone', coalesce(p.phone, c.phone), 'email', coalesce(p.email, c.email),
                      'language', coalesce(p.preferred_language, 'en'))
                    from (select 1) one left join profiles p on p.id = r.recipient_profile_id left join clients c on c.id = r.client_id)));
  end loop;
  return v_out;
end $$;

-- The outcome of one send. 'sent' closes it; 'retry' (the provider said it did not send) backs off 2^attempt minutes
-- until notify.max_attempts; 'failed' closes it. A result for a delivery that is already closed changes nothing.
create or replace function fn_notify_result(p_id uuid, p_outcome text, p_provider text default null, p_provider_message_id text default null,
  p_error text default null, p_to text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare d notification_deliveries; v_max int := fn_setting_int('notify.max_attempts', 3); n notifications;
begin
  select * into d from notification_deliveries where notification_id = p_id for update;
  if not found or d.state <> 'claimed' then return false; end if;
  select * into n from notifications where id = p_id;
  if p_outcome = 'sent' then
    update notification_deliveries set state = 'sent', provider = p_provider, provider_message_id = p_provider_message_id, to_address = p_to,
      sent_at = now(), lease_until = null, last_error = null, updated_at = now() where notification_id = p_id;
    update notifications set status = 'sent', sent_at = now(), error = null where id = p_id and status = 'pending';
    perform fn_emit_event('notification.sent', 'notifications', p_id, null, jsonb_build_object('type', n.type, 'channel', n.channel, 'provider', p_provider));
  elsif p_outcome = 'retry' and d.attempts < v_max then
    update notification_deliveries set state = 'retry', provider = p_provider, to_address = p_to, last_error = p_error, lease_until = null,
      next_attempt_at = now() + make_interval(mins => power(2, d.attempts)::int), updated_at = now() where notification_id = p_id;
  elsif p_outcome in ('retry', 'failed') then
    update notification_deliveries set state = 'failed', provider = p_provider, to_address = p_to, last_error = p_error, lease_until = null, updated_at = now()
     where notification_id = p_id;
    update notifications set status = 'failed', error = p_error where id = p_id and status = 'pending';
    perform fn_emit_event('notification.failed', 'notifications', p_id, null, jsonb_build_object('type', n.type, 'channel', n.channel, 'provider', p_provider, 'error', p_error));
  else
    raise exception 'unknown outcome %', p_outcome using errcode = 'check_violation';
  end if;
  return true;
end $$;

-- Delivery status from the WhatsApp provider, by its message id. Only forward moves (sent → delivered → read; failed
-- from sent or delivered); a repeated or late webhook changes nothing. Returns whether the message was ours and moved.
create or replace function fn_whatsapp_status(p_provider_message_id text, p_status text, p_error text default null, p_at timestamptz default now())
returns boolean language plpgsql security definer set search_path = public as $$
declare d notification_deliveries; v_rank int; v_new int;
begin
  select * into d from notification_deliveries where provider_message_id = p_provider_message_id for update;
  if not found then return false; end if;
  v_rank := case d.state when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 9 end;
  v_new := case p_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 when 'failed' then 4 else 0 end;
  if v_new = 0 or v_new <= v_rank or (v_new = 4 and v_rank > 2) then return false; end if;
  update notification_deliveries set state = p_status,
    delivered_at = case when p_status in ('delivered', 'read') then coalesce(delivered_at, p_at) else delivered_at end,
    read_at = case when p_status = 'read' then p_at else read_at end,
    last_error = case when p_status = 'failed' then p_error else last_error end, updated_at = now()
   where notification_id = d.notification_id;
  if p_status = 'failed' then
    update notifications set status = 'failed', error = coalesce(p_error, 'the provider reported a failed delivery') where id = d.notification_id;
  end if;
  perform fn_emit_event('notification.' || p_status, 'notifications', d.notification_id, null, jsonb_build_object('provider_message_id', p_provider_message_id, 'error', p_error));
  return true;
end $$;

-- ===================================================================== digests
-- Queues the digest rows that are due at this Cairo hour (called by the hourly job). One per recipient and period.
create or replace function fn_queue_digests(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare v_local timestamp := p_now at time zone 'Africa/Cairo'; v_day date := (p_now at time zone 'Africa/Cairo')::date; n int := 0; r record; v_week date;
begin
  if coalesce((fn_setting('digest.daily_enabled'))::boolean, true) and extract(hour from v_local) = fn_setting_int('digest.daily_hour', 20) then
    for r in select distinct m.profile_id, m.role, m.branch_id from memberships m join profiles p on p.id = m.profile_id
             where m.is_active and p.is_active and m.role in ('head_coach', 'sales_manager') and p.email is not null loop
      if not exists (select 1 from notifications x where x.type = 'digest.daily' and x.recipient_profile_id = r.profile_id
                     and x.data->>'period' = v_day::text and x.data->>'branch_id' = r.branch_id::text and x.data->>'role' = r.role::text) then
        perform fn_notify(r.profile_id, 'digest.daily', 'Daily digest · ' || to_char(v_day, 'Dy DD Mon'), null,
          jsonb_build_object('period', v_day, 'role', r.role, 'branch_id', r.branch_id), 'email');
        n := n + 1;
      end if;
    end loop;
  end if;
  if coalesce((fn_setting('digest.weekly_enabled'))::boolean, true) and extract(dow from v_local) = fn_setting_int('digest.weekly_dow', 6)
     and extract(hour from v_local) = fn_setting_int('digest.weekly_hour', 9) then
    v_week := v_day - 7;
    for r in select distinct m.profile_id from memberships m join profiles p on p.id = m.profile_id
             where m.is_active and p.is_active and m.role = 'top_management' and p.email is not null loop
      if not exists (select 1 from notifications x where x.type = 'digest.weekly' and x.recipient_profile_id = r.profile_id and x.data->>'period' = v_week::text) then
        perform fn_notify(r.profile_id, 'digest.weekly', 'Weekly digest · week of ' || to_char(v_week, 'DD Mon'), null,
          jsonb_build_object('period', v_week, 'role', 'top_management'), 'email');
        n := n + 1;
      end if;
    end loop;
  end if;
  return n;
end $$;

-- The numbers behind a digest row, read through the dashboard accessors *as the recipient* (their role and branches
-- decide what they may see), so a digest never shows more than the person's own screens.
create or replace function fn_digest(p_notification_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n notifications; v_role text; v_branch uuid; v_period date; v_month text; v jsonb; v_prev_sub text; v_prev_claims text;
begin
  select * into n from notifications where id = p_notification_id and type in ('digest.daily', 'digest.weekly');
  if not found then raise exception 'not a digest' using errcode = 'no_data_found'; end if;
  v_role := n.data->>'role'; v_branch := nullif(n.data->>'branch_id', '')::uuid; v_period := (n.data->>'period')::date;
  v_month := to_char(v_period, 'YYYY-MM');
  v_prev_sub := current_setting('request.jwt.claim.sub', true); v_prev_claims := current_setting('request.jwt.claims', true);
  perform set_config('request.jwt.claim.sub', n.recipient_profile_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', n.recipient_profile_id, 'role', 'authenticated')::text, true);

  v := jsonb_build_object('kind', split_part(n.type, '.', 2), 'role', v_role, 'period', v_period, 'month', v_month,
         'name', (select full_name from profiles where id = n.recipient_profile_id),
         'branch_name', (select name from branches where id = v_branch));
  if n.type = 'digest.daily' then
    v := v || jsonb_build_object('today', fn_today_live());
    if v_role = 'sales_manager' then
      v := v || jsonb_build_object('tiles', (fn_dashboard_tiles('sales', v_month, v_branch))->'tiles',
        'reps', (select coalesce(jsonb_agg(jsonb_build_object('name', r.full_name, 'leads', r.leads, 'won', r.won, 'won_revenue', r.won_revenue,
                   'overdue', r.overdue_follow_ups, 'open_flags', r.open_flags) order by r.won_revenue desc), '[]') from fn_sales_team(v_branch, v_month) r));
    else
      v := v || jsonb_build_object('coaches', (select coalesce(jsonb_agg(jsonb_build_object('name', c.full_name, 'sessions', c.sessions_completed,
                   'no_show_pct', c.no_show_pct, 'unpaid', c.unpaid_sessions, 'commission_pct', c.commission_pct) order by c.full_name), '[]')
                 from fn_dashboard_coaches(v_month) c where c.branch_id = v_branch));
    end if;
  else
    v := v || jsonb_build_object('tiles', (fn_dashboard_tiles('admin', v_month, null))->'tiles',
      'weeks', (select coalesce(jsonb_agg(to_jsonb(w) order by w.week_start, w.branch_id), '[]') from fn_dashboard_weekly(2) w),
      'branches', (select coalesce(jsonb_object_agg(id, name), '{}') from branches));
  end if;

  perform set_config('request.jwt.claim.sub', coalesce(v_prev_sub, ''), true);
  perform set_config('request.jwt.claims', coalesce(v_prev_claims, ''), true);
  return v;
end $$;

-- ===================================================================== jobs
-- Hourly: materialize today and tomorrow, session reminders (−24h, −2h; clients without an account are reached on their
-- phone through fn_notify_client), 14-day expiry heads-up, "time to renew" (one per recipient per week: the client's
-- WhatsApp, the coach's and the rep's in-app notices are capped separately), SLA breaches, digests.
create or replace function fn_hourly_notifications() returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; r record; v_coach uuid; v_rep uuid;
begin
  perform fn_materialize_sessions(cairo_date(now()));
  perform fn_materialize_sessions(cairo_date(now()) + 1);
  for r in
    select s.id, s.scheduled_at, s.client_id, p.full_name coach_name,
           case when s.scheduled_at between now() + interval '23 hours' and now() + interval '25 hours' then 'session.reminder_24h'
                when s.scheduled_at between now() + interval '1 hour' and now() + interval '3 hours' then 'session.reminder_2h' end as kind
    from sessions s join memberships m on m.id = s.coach_membership_id join profiles p on p.id = m.profile_id
    where s.status = 'booked' and s.scheduled_at between now() + interval '1 hour' and now() + interval '25 hours'
  loop
    if r.kind is not null and not exists (select 1 from notifications x where x.type = r.kind and x.data->>'session_id' = r.id::text) then
      perform fn_notify_client(r.client_id, r.kind, 'Session ' || case when r.kind like '%24h' then 'tomorrow' else 'in 2 hours' end,
        to_char(r.scheduled_at at time zone 'Africa/Cairo', 'Dy DD Mon HH24:MI') || ' with ' || r.coach_name, jsonb_build_object('session_id', r.id, 'client_id', r.client_id), 'whatsapp');
      n := n + 1;
    end if;
  end loop;
  for r in
    select l.id lot_id, l.client_id, l.qty_remaining, c.full_name, c.coach_membership_id
    from credit_lots l join clients c on c.id = l.client_id
    where l.status = 'active' and l.qty_remaining > 0 and l.expires_at between now() + interval '13 days' and now() + interval '15 days'
      and not exists (select 1 from notifications x where x.type = 'credits.expiring_14d' and x.data->>'lot_id' = l.id::text)
  loop
    perform fn_notify_client(r.client_id, 'credits.expiring_14d', r.qty_remaining || ' sessions expire in 2 weeks', 'Book them in or ask about a freeze', jsonb_build_object('lot_id', r.lot_id, 'client_id', r.client_id), 'whatsapp');
    perform fn_notify((select profile_id from memberships where id = r.coach_membership_id), 'credits.expiring_14d', r.full_name || ': ' || r.qty_remaining || ' sessions expire in 2 weeks', null, jsonb_build_object('lot_id', r.lot_id, 'client_id', r.client_id));
    n := n + 1;
  end loop;
  for r in
    select c.id, c.full_name, c.coach_membership_id, c.rep_membership_id, fn_credit_balance(c.id) bal,
           (select min(expires_at) from credit_lots l where l.client_id = c.id and l.status = 'active' and l.qty_remaining > 0) next_exp
    from clients c where c.status = 'active'
  loop
    if (r.bal between 1 and fn_setting_int('risk.low_credit_threshold', 2)) or (r.next_exp is not null and r.next_exp < now() + make_interval(days => fn_setting_int('risk.expiring_days', 7))) then
      if not exists (select 1 from notifications x where x.type = 'credits.low' and x.channel = 'whatsapp' and x.data->>'client_id' = r.id::text and x.created_at > now() - interval '7 days') then
        perform fn_notify_client(r.id, 'credits.low', 'Time to renew', r.bal || ' sessions left', jsonb_build_object('client_id', r.id), 'whatsapp');
        n := n + 1;
      end if;
      v_coach := (select profile_id from memberships where id = r.coach_membership_id);
      v_rep := (select profile_id from memberships where id = r.rep_membership_id);
      if v_coach is not null and not exists (select 1 from notifications x where x.type = 'credits.low' and x.recipient_profile_id = v_coach and x.data->>'client_id' = r.id::text and x.created_at > now() - interval '7 days') then
        perform fn_notify(v_coach, 'credits.low', r.full_name || ': ' || r.bal || ' credits left', 'Open the renewal conversation', jsonb_build_object('client_id', r.id));
      end if;
      if v_rep is not null and not exists (select 1 from notifications x where x.type = 'credits.low' and x.recipient_profile_id = v_rep and x.data->>'client_id' = r.id::text and x.created_at > now() - interval '7 days') then
        perform fn_notify(v_rep, 'credits.low', r.full_name || ': ' || r.bal || ' credits left', 'Renewal opportunity', jsonb_build_object('client_id', r.id));
      end if;
    end if;
  end loop;
  for r in select l.id, l.full_name, l.branch_id, m.profile_id from leads l join memberships m on m.id = l.owner_membership_id
           where l.first_contact_at is null and l.first_contact_due_at < now() and l.status = 'new'
             and not exists (select 1 from notifications x where x.type = 'lead.sla_breach' and x.data->>'lead_id' = l.id::text) loop
    perform fn_notify(r.profile_id, 'lead.sla_breach', 'SLA breached: ' || r.full_name, 'No first contact yet', jsonb_build_object('lead_id', r.id));
    perform fn_notify_role('sales_manager', r.branch_id, 'lead.sla_breach', 'SLA breached: ' || r.full_name, null, jsonb_build_object('lead_id', r.id));
    n := n + 1;
  end loop;
  n := n + fn_queue_digests();
  return n;
end $$;

-- Freezes whose end date has come: end them (extends lots and memberships by the frozen days).
create or replace function fn_end_due_freezes() returns int language plpgsql security definer set search_path = public as $$
declare f record; n int := 0;
begin
  for f in select id from freezes where status = 'active' and ends_at <= now() order by ends_at loop
    perform fn_end_freeze(f.id);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function fn_nightly() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_expired int; v_lapsed int; v_risk int; v_mat int; v_freezes int; v jsonb;
begin
  -- nothing is ever deleted or anonymized: client and lead history is kept in full (decision 18)
  v_freezes := fn_end_due_freezes();
  v_expired := fn_expire_credits();
  v_lapsed := fn_mark_lapsed();
  v_risk := fn_compute_risk_scores();
  v_mat := fn_materialize_sessions(cairo_date(now())) + fn_materialize_sessions(cairo_date(now()) + 1);
  perform fn_refresh_views(true);
  v := jsonb_build_object('cairo_date', cairo_date(now()), 'freezes_ended', v_freezes, 'expired', v_expired, 'lapsed', v_lapsed,
                          'risk_scored', v_risk, 'sessions_materialized', v_mat);
  perform fn_emit_event('job.nightly', null, null, null, v);
  return v;
end $$;

-- pg_cron runs in UTC and Cairo moves between UTC+2 and UTC+3, so the nightly schedule fires at 00:30 and 01:30 UTC
-- and this guard runs the job only in the 03:00 Cairo hour, once per Cairo date.
create or replace function fn_nightly_if_due(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if extract(hour from p_now at time zone 'Africa/Cairo') <> 3 then return null; end if;
  if exists (select 1 from events where type = 'job.nightly' and payload->>'cairo_date' = cairo_date(p_now)::text) then return null; end if;
  return fn_nightly();
end $$;

-- Every 5 minutes: POST to the notify Edge Function. Its URL and shared secret live in Vault (`notify_url`,
-- `notify_secret`), set per environment; without them this does nothing and says so.
create or replace function fn_invoke_notify() returns bigint language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notify_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_secret';
  if v_url is null or v_secret is null then
    raise notice 'notify is not configured: add the notify_url and notify_secret Vault secrets';
    return null;
  end if;
  return net.http_post(url := v_url, body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-notify-secret', v_secret), timeout_milliseconds := 55000);
end $$;

do $$
declare j text;
begin
  foreach j in array array['gymos-nightly', 'gymos-notify'] loop
    if exists (select 1 from cron.job where jobname = j) then perform cron.unschedule(j); end if;
  end loop;
  perform cron.schedule('gymos-nightly', '30 0,1 * * *', $c$ select public.fn_nightly_if_due() $c$);   -- 03:30 Cairo, summer or winter
  perform cron.schedule('gymos-notify', '*/5 * * * *', $c$ select public.fn_invoke_notify() $c$);
end $$;

-- ===================================================================== refunds and transfers
-- Refund a payment: the money goes back and the deal's unused sessions are withdrawn when the sales manager approves
-- (fn_decide_approval 'refund'). Asked by whoever may record payments on the deal, or top management.
create or replace function fn_request_refund(p_payment_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare x payments; d deals;
begin
  select * into x from payments where id = p_payment_id;
  if not found then raise exception 'payment not found' using errcode = 'no_data_found'; end if;
  select * into d from deals where id = x.deal_id;
  if not (is_top_management() or fn_can_pay_deal(d)) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  if x.voided_at is not null then raise exception 'payment already voided' using errcode = 'check_violation'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason required' using errcode = 'check_violation'; end if;
  if exists (select 1 from approvals a where a.subject_table = 'payments' and a.subject_id = p_payment_id and a.status = 'pending') then
    raise exception 'a request for this payment is already waiting for approval' using errcode = 'check_violation';
  end if;
  return fn_request_approval('refund', 'payments', p_payment_id, d.branch_id, trim(p_reason),
    jsonb_build_object('amount_piastres', x.amount_piastres, 'deal_id', x.deal_id));
end $$;

-- Transfer a pack's remaining sessions to another client (same coach): the sales manager approves
-- (fn_decide_approval 'transfer' moves the lot, with ledger rows on both sides).
create or replace function fn_request_transfer(p_lot_id uuid, p_to_client_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare l credit_lots; c clients; t clients;
begin
  select * into l from credit_lots where id = p_lot_id;
  if not found then raise exception 'pack not found' using errcode = 'no_data_found'; end if;
  select * into c from clients where id = l.client_id;
  if not (is_top_management() or has_role('sales_manager', c.home_branch_id) or has_role('sales_rep', c.home_branch_id)) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if l.status <> 'active' or l.qty_remaining <= 0 then raise exception 'only an active pack with sessions left can be transferred' using errcode = 'check_violation'; end if;
  select * into t from clients where id = p_to_client_id;
  if not found then raise exception 'client not found' using errcode = 'no_data_found'; end if;
  if t.id = c.id then raise exception 'pick another client' using errcode = 'check_violation'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason required' using errcode = 'check_violation'; end if;
  if exists (select 1 from approvals a where a.subject_table = 'credit_lots' and a.subject_id = p_lot_id and a.status = 'pending') then
    raise exception 'a request for this pack is already waiting for approval' using errcode = 'check_violation';
  end if;
  return fn_request_approval('transfer', 'credit_lots', p_lot_id, c.home_branch_id, trim(p_reason),
    jsonb_build_object('to_client_id', t.id, 'to_client_name', t.full_name, 'from_client_id', c.id, 'from_client_name', c.full_name, 'qty', l.qty_remaining,
                       'coach_name', fn_membership_name(l.coach_membership_id)));
end $$;

-- Freezes and money requests for a client, as the sales team sees them (sales client screen), with what the caller may do.
create or replace function fn_client_requests(p_client_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c clients;
begin
  select * into c from clients where id = p_client_id;
  if not found or not (is_top_management() or p_client_id in (select my_sales_client_ids()) or has_role('front_desk', c.home_branch_id)) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'status', c.status,
    'freezes', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'starts_at', f.starts_at, 'ends_at', f.ends_at, 'days', f.days, 'status', f.status, 'reason', f.reason)
                 order by f.created_at desc) from freezes f where f.client_id = p_client_id), '[]'),
    'transfers', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'lot_id', a.subject_id, 'status', a.status, 'to_client_name', a.payload->>'to_client_name',
                 'qty', (a.payload->>'qty')::int, 'requested_at', a.requested_at) order by a.requested_at desc)
                 from approvals a where a.type = 'transfer' and a.payload->>'from_client_id' = p_client_id::text), '[]'),
    'freeze_max_days', fn_setting_int('freeze.max_days', 30),
    'can_freeze', is_top_management() or has_role('sales_manager', c.home_branch_id) or has_role('sales_rep', c.home_branch_id),
    'can_end_freeze', is_top_management() or has_role('sales_manager', c.home_branch_id),
    'can_transfer', is_top_management() or has_role('sales_manager', c.home_branch_id) or has_role('sales_rep', c.home_branch_id));
end $$;

-- Refunds and transfers for /admin/money: the month's requests (pending and decided) with their subject.
create or replace function fn_money_requests(p_month text, p_branch_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_top_management() then raise exception 'top management only' using errcode = 'insufficient_privilege'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'type', a.type, 'status', a.status, 'reason', a.reason, 'note', a.decision_note,
      'requested_at', a.requested_at, 'decided_at', a.decided_at, 'requested_by', (select full_name from profiles where id = a.requested_by),
      'decided_by', (select full_name from profiles where id = a.decided_by), 'branch_id', a.branch_id,
      'amount_piastres', (a.payload->>'amount_piastres')::bigint, 'deal_id', a.payload->>'deal_id',
      'client_name', coalesce(a.payload->>'from_client_name', (select coalesce(c.full_name, l.full_name) from payments x join deals d on d.id = x.deal_id
                        left join clients c on c.id = d.client_id left join leads l on l.id = d.lead_id where x.id = a.subject_id)),
      'to_client_name', a.payload->>'to_client_name', 'qty', (a.payload->>'qty')::int, 'coach_name', a.payload->>'coach_name')
    order by a.requested_at desc)
    from approvals a
    where a.type in ('refund', 'transfer') and (p_branch_id is null or a.branch_id = p_branch_id)
      and (a.status = 'pending' or to_char(a.requested_at at time zone 'Africa/Cairo', 'YYYY-MM') = p_month)), '[]');
end $$;

-- ===================================================================== grants
revoke execute on function fn_notify_claim(int, int, notification_channel[], notification_channel[]), fn_notify_result(uuid, text, text, text, text, text),
  fn_whatsapp_status(text, text, text, timestamptz), fn_queue_digests(timestamptz), fn_digest(uuid), fn_end_due_freezes(),
  fn_nightly_if_due(timestamptz), fn_invoke_notify(), fn_hourly_notifications(), fn_nightly()
  from public, anon, authenticated;
grant execute on function fn_notify_claim(int, int, notification_channel[], notification_channel[]), fn_notify_result(uuid, text, text, text, text, text),
  fn_whatsapp_status(text, text, text, timestamptz), fn_digest(uuid) to service_role;
revoke execute on function fn_request_refund(uuid, text), fn_request_transfer(uuid, uuid, text), fn_client_requests(uuid), fn_money_requests(text, uuid) from public, anon;
grant execute on function fn_request_refund(uuid, text), fn_request_transfer(uuid, uuid, text), fn_client_requests(uuid), fn_money_requests(text, uuid) to authenticated;
