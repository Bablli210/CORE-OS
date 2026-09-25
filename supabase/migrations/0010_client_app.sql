-- GymOS — 0010_client_app.sql (M5 Client app)
-- The client's own screens. Clients write workout_logs / set_logs / body_metrics directly under RLS (0001 policies; the
-- set_logs trigger marks PRs, the workout_logs trigger emits workout.logged) with ids generated on the phone, so a replayed
-- offline write is the same row (INSERT … ON CONFLICT DO NOTHING). Everything else is an RPC:
--  1. read shapes for the signed-in client (scoped by my_client_id()): fn_client_home, fn_client_training,
--     fn_client_progress, fn_client_credits
--  2. writes: fn_update_my_profile; renewals and freezes use 0001's fn_flag_for_sales / fn_request_freeze as they are
--  3. self check-in: fn_client_check_in — one tap when a session is within the hour, or the kiosk's QR code of the day
--     (fn_kiosk_code, staff; an HMAC of branch + Cairo date with a secret nobody can read over the API)

-- =====================================================================
-- helpers
-- =====================================================================
-- Server-side secrets (kiosk QR). RLS on, no policies, no grants: readable only inside SECURITY DEFINER functions.
create table app_secrets (key text primary key, value text not null);
alter table app_secrets enable row level security;
revoke all on app_secrets from public, anon, authenticated;
insert into app_secrets(key, value) values ('kiosk_qr', encode(extensions.gen_random_bytes(32), 'hex'));

-- The signed-in client's row, or an error the app shows as "your member profile isn't linked".
create or replace function fn_require_client() returns clients
language plpgsql stable security definer set search_path = public as $$
declare c clients;
begin
  select * into c from clients where profile_id = auth.uid();
  if not found then raise exception 'not a client' using errcode = 'no_data_found'; end if;
  return c;
end $$;

-- Today's kiosk code for a branch (changes every Cairo day).
create or replace function fn_kiosk_code_for(p_branch uuid, p_day date) returns text
language sql stable security definer set search_path = public as $$
  select left(encode(extensions.hmac(p_branch::text || ':' || p_day::text, (select value from app_secrets where key = 'kiosk_qr'), 'sha256'), 'hex'), 16)
$$;

-- Estimated 1RM (Epley), the same formula as the PR trigger.
create or replace function fn_e1rm(p_weight numeric, p_reps int) returns numeric language sql immutable as $$
  select case when p_weight is null or p_reps is null or p_reps <= 0 then null else p_weight * (1 + p_reps / 30.0) end
$$;

-- =====================================================================
-- 1. READ SHAPES (the signed-in client only)
-- =====================================================================
-- Today: sessions left per coach, membership end, the next session (booked, or the next occurrence of a weekly slot),
-- the weekly slots the coach set (read-only: there is no client booking), the active program and today's suggested day.
create or replace function fn_client_home() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c clients := fn_require_client(); v_today date := cairo_date(now()); v_program programs; v_last int; v_days int;
begin
  select * into v_program from programs where client_id = c.id and status = 'active' limit 1;
  if v_program.id is not null then
    select count(*) into v_days from program_days where program_id = v_program.id;
    select d.day_index into v_last from workout_logs w join program_days d on d.id = w.program_day_id
     where w.client_id = c.id and d.program_id = v_program.id order by w.performed_at desc limit 1;
  end if;
  return jsonb_build_object(
    'client_id', c.id, 'first_name', split_part(c.full_name, ' ', 1), 'full_name', c.full_name, 'status', c.status,
    'branch_id', c.home_branch_id, 'branch_name', (select name from branches where id = c.home_branch_id),
    'coach_name', (select p.full_name from memberships m join profiles p on p.id = m.profile_id where m.id = c.coach_membership_id),
    'balances', coalesce((select jsonb_agg(to_jsonb(b)) from fn_credit_balances(c.id) b), '[]'),
    'membership_ends_at', (select max(e.ends_at) from entitlements e where e.client_id = c.id and e.type = 'membership' and e.status in ('active','frozen') and e.ends_at > now()),
    'checked_in_today', exists (select 1 from visits v where v.client_id = c.id and cairo_date(v.checked_in_at) = v_today),
    'slots', coalesce((select jsonb_agg(jsonb_build_object('weekday', x.weekday, 'start_time', to_char(x.start_time, 'HH24:MI'), 'duration_minutes', x.duration_minutes,
                'coach_name', p.full_name) order by (x.weekday + 1) % 7, x.start_time)
              from schedule_slots x join memberships m on m.id = x.coach_membership_id join profiles p on p.id = m.profile_id
              where x.client_id = c.id and x.is_active and x.starts_on <= v_today + 7 and (x.ends_on is null or x.ends_on >= v_today)), '[]'),
    'next_session', (
      select jsonb_build_object('starts_at', n.starts_at, 'coach_name', n.coach_name, 'branch_id', n.branch_id, 'branch_name', (select name from branches where id = n.branch_id),
                                'within_hour', n.starts_at between now() - interval '1 hour' and now() + interval '1 hour')
      from (
        select s.scheduled_at starts_at, p.full_name coach_name, s.branch_id
          from sessions s join memberships m on m.id = s.coach_membership_id join profiles p on p.id = m.profile_id
         where s.client_id = c.id and s.status = 'booked' and s.scheduled_at > now() - interval '1 hour'
        union all
        -- weekly slots not materialized yet (the hourly job creates today's and tomorrow's)
        select (d::date::text || ' ' || x.start_time::text)::timestamp at time zone 'Africa/Cairo', p.full_name, x.branch_id
          from schedule_slots x join memberships m on m.id = x.coach_membership_id join profiles p on p.id = m.profile_id
          cross join generate_series(v_today, v_today + 7, interval '1 day') d
         where x.client_id = c.id and x.is_active and x.weekday = extract(dow from d)::int and x.starts_on <= d::date and (x.ends_on is null or x.ends_on >= d::date)
           and not exists (select 1 from schedule_skips k where k.slot_id = x.id and k.skip_date = d::date)
           and not exists (select 1 from sessions s where s.slot_id = x.id and cairo_date(s.scheduled_at) = d::date)
           and (d::date::text || ' ' || x.start_time::text)::timestamp at time zone 'Africa/Cairo' > now() - interval '1 hour'
      ) n order by n.starts_at limit 1),
    'program', case when v_program.id is null then null else jsonb_build_object(
      'id', v_program.id, 'name', v_program.name, 'weeks', v_program.weeks, 'ends_at', v_program.ends_at,
      'coach_name', (select p.full_name from memberships m join profiles p on p.id = m.profile_id where m.id = v_program.coach_membership_id),
      'next_day_index', case when v_days > 0 then coalesce(v_last, 0) % v_days + 1 end,
      'days', coalesce((select jsonb_agg(jsonb_build_object('day_index', d.day_index, 'name', d.name, 'exercises', (select count(*) from program_exercises e where e.program_day_id = d.id)) order by d.day_index)
                        from program_days d where d.program_id = v_program.id), '[]')) end,
    'workouts_this_week', (select count(*) from workout_logs w where w.client_id = c.id and cairo_date(w.performed_at) >= week_start_sat(v_today)));
end $$;

-- The workout logger's data: the active program (days, exercises) and, per exercise, the sets of the last workout that had it
-- ("last time") and the best estimated 1RM so far. Cached on the phone so the logger opens without signal.
create or replace function fn_client_training() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c clients := fn_require_client(); v_program uuid; v_last int; v_days int;
begin
  select id into v_program from programs where client_id = c.id and status = 'active' limit 1;
  select count(*) into v_days from program_days where program_id = v_program;
  select d.day_index into v_last from workout_logs w join program_days d on d.id = w.program_day_id
   where w.client_id = c.id and d.program_id = v_program order by w.performed_at desc limit 1;
  return jsonb_build_object(
    'client_id', c.id,
    'program', case when v_program is null then null else fn_program(v_program) end,
    'next_day_index', case when v_days > 0 then coalesce(v_last, 0) % v_days + 1 end,
    'history', coalesce((
      select jsonb_object_agg(x.exercise_id, jsonb_build_object('performed_at', x.performed_at, 'sets', x.sets, 'best_e1rm', x.best))
      from (
        select e.exercise_id,
               (select w.performed_at from set_logs s join workout_logs w on w.id = s.workout_log_id
                 where w.client_id = c.id and s.exercise_id = e.exercise_id order by w.performed_at desc limit 1) performed_at,
               (select jsonb_agg(jsonb_build_object('set_index', s.set_index, 'weight_kg', s.weight_kg, 'reps', s.reps, 'is_pr', s.is_pr) order by s.set_index)
                  from set_logs s where s.workout_log_id = (select w.id from set_logs s2 join workout_logs w on w.id = s2.workout_log_id
                                                            where w.client_id = c.id and s2.exercise_id = e.exercise_id order by w.performed_at desc limit 1)
                   and s.exercise_id = e.exercise_id) sets,
               (select max(fn_e1rm(s.weight_kg, s.reps)) from set_logs s join workout_logs w on w.id = s.workout_log_id where w.client_id = c.id and s.exercise_id = e.exercise_id) best
        from (select distinct pe.exercise_id from program_exercises pe join program_days d on d.id = pe.program_day_id where d.program_id = v_program) e
      ) x where x.performed_at is not null), '{}'));
end $$;

-- Progress: PRs per exercise, the top-set series for one exercise, the weekly streak, and body weight.
create or replace function fn_client_progress(p_exercise uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c clients := fn_require_client(); v_today date := cairo_date(now()); v_streak int := 0; v_week date;
begin
  -- consecutive gym weeks (Sat–Fri) with a workout or a visit, counting back from this week (this week may still be empty)
  v_week := week_start_sat(v_today);
  if not exists (select 1 from workout_logs w where w.client_id = c.id and week_start_sat(cairo_date(w.performed_at)) = v_week)
     and not exists (select 1 from visits v where v.client_id = c.id and week_start_sat(cairo_date(v.checked_in_at)) = v_week) then
    v_week := v_week - 7;
  end if;
  while exists (select 1 from workout_logs w where w.client_id = c.id and week_start_sat(cairo_date(w.performed_at)) = v_week)
     or exists (select 1 from visits v where v.client_id = c.id and week_start_sat(cairo_date(v.checked_in_at)) = v_week) loop
    v_streak := v_streak + 1;
    v_week := v_week - 7;
  end loop;
  return jsonb_build_object(
    'streak_weeks', v_streak,
    'workouts_30d', (select count(*) from workout_logs w where w.client_id = c.id and w.performed_at > now() - interval '30 days'),
    'prs', coalesce((select jsonb_agg(x order by x.performed_at desc) from (
        select distinct on (s.exercise_id) s.exercise_id, e.name exercise_name, s.weight_kg, s.reps, round(fn_e1rm(s.weight_kg, s.reps), 1) e1rm, w.performed_at
        from set_logs s join workout_logs w on w.id = s.workout_log_id join exercises e on e.id = s.exercise_id
        where w.client_id = c.id and s.weight_kg is not null and s.reps > 0
        order by s.exercise_id, fn_e1rm(s.weight_kg, s.reps) desc, w.performed_at) x), '[]'),
    'exercise_id', coalesce(p_exercise, (select s.exercise_id from set_logs s join workout_logs w on w.id = s.workout_log_id where w.client_id = c.id and s.weight_kg is not null
                                         group by s.exercise_id order by count(*) desc, s.exercise_id limit 1)),
    'series', coalesce((select jsonb_agg(jsonb_build_object('date', x.day, 'top_kg', x.top) order by x.day) from (
        select cairo_date(w.performed_at) as day, max(s.weight_kg) top
        from set_logs s join workout_logs w on w.id = s.workout_log_id
        where w.client_id = c.id and s.weight_kg is not null
          and s.exercise_id = coalesce(p_exercise, (select s2.exercise_id from set_logs s2 join workout_logs w2 on w2.id = s2.workout_log_id where w2.client_id = c.id and s2.weight_kg is not null
                                                    group by s2.exercise_id order by count(*) desc, s2.exercise_id limit 1))
        group by 1) x), '[]'),
    'body', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'measured_at', b.measured_at, 'weight_kg', b.weight_kg) order by b.measured_at)
                      from body_metrics b where b.client_id = c.id and b.weight_kg is not null and b.measured_at > now() - interval '365 days'), '[]'));
end $$;

-- Credits: per-coach balances (fn_credit_balances), each pack, the ledger, payments, memberships, freezes, the advisor to ask,
-- and whether a renewal request is already open. There is no self-service extension.
create or replace function fn_client_credits() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c clients := fn_require_client();
begin
  return jsonb_build_object(
    'client_id', c.id,
    'balances', coalesce((select jsonb_agg(to_jsonb(b)) from fn_credit_balances(c.id) b), '[]'),
    'lots', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'coach_name', p.full_name, 'qty_issued', l.qty_issued, 'qty_remaining', l.qty_remaining,
                  'issued_at', l.issued_at, 'expires_at', l.expires_at, 'status', l.status) order by l.issued_at desc)
                from credit_lots l join memberships m on m.id = l.coach_membership_id join profiles p on p.id = m.profile_id where l.client_id = c.id), '[]'),
    'ledger', coalesce((select jsonb_agg(x order by x.created_at desc) from (
                  select g.id, g.entry_type, g.qty, g.created_at, p.full_name coach_name, s.scheduled_at session_at
                  from credit_ledger g join credit_lots l on l.id = g.lot_id join memberships m on m.id = l.coach_membership_id join profiles p on p.id = m.profile_id
                  left join sessions s on s.id = g.session_id
                  where g.client_id = c.id order by g.created_at desc limit 50) x), '[]'),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', y.id, 'amount_piastres', y.amount_piastres, 'method', y.method, 'received_at', y.received_at, 'voided', y.voided_at is not null)
                  order by y.received_at desc)
                from payments y join deals d on d.id = y.deal_id where d.client_id = c.id), '[]'),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'type', e.type, 'product_name', pr.name, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'status', e.status)
                  order by e.ends_at desc)
                from entitlements e left join products pr on pr.id = e.product_id where e.client_id = c.id), '[]'),
    'freezes', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'starts_at', f.starts_at, 'ends_at', f.ends_at, 'days', f.days, 'status', f.status) order by f.created_at desc)
                from freezes f where f.client_id = c.id), '[]'),
    'freeze_max_days', fn_setting_int('freeze.max_days', 30),
    'advisor', (select jsonb_build_object('first_name', split_part(p.full_name, ' ', 1), 'phone', p.phone) from memberships m join profiles p on p.id = m.profile_id where m.id = c.rep_membership_id),
    'renewal_open', exists (select 1 from follow_ups f where f.client_id = c.id and f.status = 'open' and f.title like 'FLAG:%'));
end $$;

-- =====================================================================
-- 2. WRITES
-- =====================================================================
-- Profile: training preferences (merged into onboarding_responses.pt_prefs), marketing / content consents
-- (onboarding_responses.social), Instagram handle, app language.
create or replace function fn_update_my_profile(p_pt_prefs jsonb default null, p_instagram text default null, p_language text default null,
  p_consent_marketing boolean default null, p_consent_content boolean default null) returns void
language plpgsql security definer set search_path = public as $$
declare c clients := fn_require_client(); v_resp jsonb;
begin
  if p_language is not null and p_language not in ('en','ar') then raise exception 'language must be en or ar' using errcode = 'check_violation'; end if;
  v_resp := coalesce(c.onboarding_responses, '{}');
  if p_pt_prefs is not null then
    v_resp := jsonb_set(v_resp, '{pt_prefs}', coalesce(v_resp->'pt_prefs', '{}') || (p_pt_prefs - array(select k from jsonb_object_keys(p_pt_prefs) k where k not in ('days','time','trainer_gender'))));
  end if;
  if p_consent_marketing is not null then v_resp := jsonb_set(v_resp, '{social}', coalesce(v_resp->'social', '{}') || jsonb_build_object('consent_marketing', p_consent_marketing)); end if;
  if p_consent_content is not null then v_resp := jsonb_set(v_resp, '{social}', coalesce(v_resp->'social', '{}') || jsonb_build_object('consent_content', p_consent_content)); end if;
  update clients set onboarding_responses = v_resp, instagram_handle = coalesce(nullif(trim(p_instagram), ''), case when p_instagram = '' then null else instagram_handle end), updated_at = now()
   where id = c.id;
  if p_language is not null then update profiles set preferred_language = p_language where id = auth.uid(); end if;
  perform fn_emit_event('client.profile_updated', 'clients', c.id, c.home_branch_id, jsonb_build_object('pt_prefs', p_pt_prefs is not null, 'language', p_language));
end $$;

-- Staff: the kiosk's QR code for today (its URL is /c/here?b=<branch>&k=<code>).
create or replace function fn_kiosk_code(p_branch uuid) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_staff() and (is_top_management() or p_branch in (select my_branch_ids()))) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  return fn_kiosk_code_for(p_branch, cairo_date(now()));
end $$;

-- "I'm here": with the kiosk's code of the day (scanned at the branch), or one tap when a session is within the hour
-- (at that session's branch). Admission is fn_check_in's rule either way.
create or replace function fn_client_check_in(p_branch uuid default null, p_code text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c clients := fn_require_client(); v_branch uuid;
begin
  if p_code is not null then
    if p_branch is null or p_code <> fn_kiosk_code_for(p_branch, cairo_date(now())) then
      return jsonb_build_object('ok', false, 'reason', 'bad_code');
    end if;
    v_branch := p_branch;
  else
    select s.branch_id into v_branch from sessions s
     where s.client_id = c.id and s.status = 'booked' and s.scheduled_at between now() - interval '1 hour' and now() + interval '1 hour'
     order by abs(extract(epoch from s.scheduled_at - now())) limit 1;
    if v_branch is null then return jsonb_build_object('ok', false, 'reason', 'no_session_soon'); end if;
  end if;
  return fn_check_in(c.id, v_branch, 'qr') || jsonb_build_object('branch_name', (select name from branches where id = v_branch));
end $$;

-- =====================================================================
-- 3. PRIVILEGES (see 0006: every migration revokes anon/PUBLIC on its functions)
-- =====================================================================
revoke execute on function fn_require_client(), fn_kiosk_code_for(uuid, date), fn_e1rm(numeric, int), fn_client_home(), fn_client_training(), fn_client_progress(uuid),
  fn_client_credits(), fn_update_my_profile(jsonb, text, text, boolean, boolean), fn_kiosk_code(uuid), fn_client_check_in(uuid, text) from public, anon;
revoke execute on function fn_require_client(), fn_kiosk_code_for(uuid, date) from authenticated;
grant execute on function fn_e1rm(numeric, int), fn_client_home(), fn_client_training(), fn_client_progress(uuid), fn_client_credits(),
  fn_update_my_profile(jsonb, text, text, boolean, boolean), fn_kiosk_code(uuid), fn_client_check_in(uuid, text) to authenticated;
