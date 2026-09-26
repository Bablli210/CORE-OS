-- GymOS — 0013_push_tokens.sql (M8: push via Expo)
-- The phone app registers its Expo push token for the signed-in person; the notify Edge Function's Expo provider
-- delivers `channel = push` notifications to every active token of the recipient. A token Expo reports as no longer
-- registered is revoked. One device can change hands (shared phone): registering moves the token to the new person.

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  token text not null unique check (token ~ '^Expo(nent)?PushToken\[.+\]$'),
  platform text not null check (platform in ('ios', 'android')),
  device_name text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text
);
create index on push_tokens (profile_id) where revoked_at is null;
alter table push_tokens enable row level security;
create policy push_tokens_read on push_tokens for select to authenticated using (profile_id = auth.uid() or is_top_management());
revoke all on push_tokens from anon, authenticated;
grant select on push_tokens to authenticated;

-- The signed-in person's phone: register (or refresh) its Expo push token.
create or replace function fn_register_push_token(p_token text, p_platform text, p_device text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = 'insufficient_privilege'; end if;
  insert into push_tokens(profile_id, token, platform, device_name) values (auth.uid(), p_token, p_platform, nullif(trim(p_device), ''))
  on conflict (token) do update set profile_id = auth.uid(), platform = excluded.platform, device_name = excluded.device_name,
    last_seen_at = now(), revoked_at = null, revoked_reason = null
  returning id into v_id;
  perform fn_emit_event('push.registered', 'push_tokens', v_id, null, jsonb_build_object('platform', p_platform));
  return v_id;
end $$;

-- Sign-out on the phone: stop pushing to it.
create or replace function fn_unregister_push_token(p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update push_tokens set revoked_at = now(), revoked_reason = 'signed out' where token = p_token and profile_id = auth.uid() and revoked_at is null returning id into v_id;
  if v_id is not null then perform fn_emit_event('push.unregistered', 'push_tokens', v_id, null, '{}'); end if;
  return v_id is not null;
end $$;

-- The notify function: Expo said the device is gone (DeviceNotRegistered).
create or replace function fn_revoke_push_token(p_token text, p_reason text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update push_tokens set revoked_at = now(), revoked_reason = p_reason where token = p_token and revoked_at is null returning id into v_id;
  if v_id is not null then perform fn_emit_event('push.revoked', 'push_tokens', v_id, null, jsonb_build_object('reason', p_reason)); end if;
  return v_id is not null;
end $$;

-- 0012's claim, now carrying the recipient's active push tokens on push rows.
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
                      'language', coalesce(p.preferred_language, 'en'),
                      'push_tokens', case when r.channel = 'push' then coalesce((select jsonb_agg(t.token order by t.last_seen_at desc) from push_tokens t
                                       where t.profile_id = r.recipient_profile_id and t.revoked_at is null), '[]') end)
                    from (select 1) one left join profiles p on p.id = r.recipient_profile_id left join clients c on c.id = r.client_id)));
  end loop;
  return v_out;
end $$;

revoke execute on function fn_register_push_token(text, text, text), fn_unregister_push_token(text), fn_revoke_push_token(text, text) from public, anon;
revoke execute on function fn_revoke_push_token(text, text) from authenticated;
grant execute on function fn_register_push_token(text, text, text), fn_unregister_push_token(text) to authenticated;
grant execute on function fn_revoke_push_token(text, text) to service_role;
