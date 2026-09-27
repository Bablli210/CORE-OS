-- GymOS — 0014_shared_hours.sql (the owner's rule of 2026-09-27, docs/06 decision 20)
-- "a coach can have 2 or more clients book the same session and hour, it is totally up to him/her".
--
-- A coach may put two or more clients in the same hour, on the weekly schedule and as one-off sessions, with no cap.
-- Classes may share an hour with clients too: the coach decides. Each client still has their own session (own outcome,
-- one of their own sessions with that coach used on Completed, own reminders, own unpaid flag), so nothing downstream changes.
-- Still refused:
--   (a) anything over a Blocked hour of that coach, and a Blocked hour over existing slots or over a booked one-off of that
--       coach on a date it runs;
--   (b) the same client in two overlapping slots or sessions, with any coach (a weekly slot is also checked against the
--       client's booked one-offs, and a one-off against the client's weekly slots whose session is not created yet);
--   (c) a client with no sessions left with that coach (unchanged).
-- Both functions take a per-client advisory lock before the client checks, so two coaches adding the same client at the same
-- moment cannot both pass the check.
--
-- Redefines fn_upsert_schedule_slot and fn_add_session with the same signatures, so their grants (0001 §19: authenticated,
-- not anon/PUBLIC) and SECURITY DEFINER + search_path stay as they were. fn_add_weekly_slots (0009) calls
-- fn_upsert_schedule_slot and still prefixes the failing day ("Sun: overlaps a blocked hour on that day").
-- Checked and unchanged: fn_materialize_sessions (idempotent per slot and time: two slots in one hour give two sessions),
-- fn_start_walkin_session (records what happened now; no time check), fn_coach_day / fn_coach_today / fn_coach_week (lists),
-- the hourly reminders (one per session), mv_coach_month (commission counts each completed session).
--
-- Times are compared as minutes of the day, so a slot that runs up to midnight is compared correctly
-- (the old `time + interval` wrapped at 24:00).

-- ---------------------------------------------------------------- weekly schedule
create or replace function fn_upsert_schedule_slot(p_coach_membership_id uuid, p_weekday int, p_start_time time, p_kind slot_kind default 'client', p_client_id uuid default null, p_label text default null, p_duration int default null, p_starts_on date default current_date, p_ends_on date default null, p_slot_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare m memberships; v_dur int; v_id uuid; v_from int; v_to int;
begin
  select * into m from memberships where id = p_coach_membership_id and role = 'coach' and is_active;
  if not found then raise exception 'not an active coach'; end if;
  if not (is_top_management() or has_role('head_coach', m.branch_id) or p_coach_membership_id in (select my_membership_ids())) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  v_dur := coalesce(p_duration, fn_setting_int('scheduling.slot_minutes', 60));
  v_from := (extract(epoch from p_start_time) / 60)::int;
  v_to := v_from + v_dur;
  if p_kind = 'client' then
    if p_client_id is null then raise exception 'client required' using errcode = 'check_violation'; end if;
    if fn_credit_balance(p_client_id, p_coach_membership_id) <= 0 then raise exception 'client has no credits with this coach' using errcode = 'GY001'; end if;
    -- one writer per client at a time (any coach), so the checks below and the insert cannot race
    perform pg_advisory_xact_lock(hashtextextended(p_client_id::text, 0));
  end if;
  -- (a) a Blocked hour blocks: nothing goes over one, and a new Blocked hour goes over nothing (same weekday, dates intersecting)
  if exists (select 1 from schedule_slots x
             where x.coach_membership_id = p_coach_membership_id and x.weekday = p_weekday and x.is_active and x.id is distinct from p_slot_id
               and (x.kind = 'blocked' or p_kind = 'blocked')
               and (x.ends_on is null or x.ends_on >= p_starts_on) and (p_ends_on is null or x.starts_on <= p_ends_on)
               and (extract(epoch from x.start_time) / 60)::int < v_to and (extract(epoch from x.start_time) / 60)::int + x.duration_minutes > v_from) then
    if p_kind = 'blocked' then
      raise exception 'a blocked hour cannot overlap another slot on that day' using errcode = 'check_violation';
    end if;
    raise exception 'overlaps a blocked hour on that day' using errcode = 'check_violation';
  end if;
  -- ... and a new Blocked hour goes over no booked one-off of that coach on a date it runs (sessions from slots are covered above)
  if p_kind = 'blocked' and exists (select 1 from sessions s
             where s.coach_membership_id = p_coach_membership_id and s.status = 'booked' and s.slot_id is null and s.scheduled_at > now()
               and extract(dow from cairo_date(s.scheduled_at))::int = p_weekday
               and cairo_date(s.scheduled_at) >= p_starts_on and (p_ends_on is null or cairo_date(s.scheduled_at) <= p_ends_on)
               and (extract(epoch from (s.scheduled_at at time zone 'Africa/Cairo')::time) / 60)::int < v_to
               and (extract(epoch from (s.scheduled_at at time zone 'Africa/Cairo')::time) / 60)::int + s.duration_minutes > v_from) then
    raise exception 'a blocked hour cannot overlap another slot on that day' using errcode = 'check_violation';
  end if;
  -- (b) the same client is never in two places at once, with any coach. Other clients (and classes) may share the hour.
  if p_kind = 'client' and exists (select 1 from schedule_slots x
             where x.client_id = p_client_id and x.weekday = p_weekday and x.is_active and x.id is distinct from p_slot_id
               and (x.ends_on is null or x.ends_on >= p_starts_on) and (p_ends_on is null or x.starts_on <= p_ends_on)
               and (extract(epoch from x.start_time) / 60)::int < v_to and (extract(epoch from x.start_time) / 60)::int + x.duration_minutes > v_from) then
    raise exception 'client already has a slot at that time' using errcode = 'check_violation';
  end if;
  -- ... nor with a booked one-off (or any future booked session not from this slot) on that weekday in the slot's date range
  -- (coalesce, not `is distinct from`: a one-off has no slot_id and must count while a new slot has no p_slot_id either)
  if p_kind = 'client' and exists (select 1 from sessions s
             where s.client_id = p_client_id and s.status = 'booked' and coalesce(s.slot_id <> p_slot_id, true) and s.scheduled_at > now()
               and extract(dow from cairo_date(s.scheduled_at))::int = p_weekday
               and cairo_date(s.scheduled_at) >= p_starts_on and (p_ends_on is null or cairo_date(s.scheduled_at) <= p_ends_on)
               and (extract(epoch from (s.scheduled_at at time zone 'Africa/Cairo')::time) / 60)::int < v_to
               and (extract(epoch from (s.scheduled_at at time zone 'Africa/Cairo')::time) / 60)::int + s.duration_minutes > v_from) then
    raise exception 'client already has a session at that time' using errcode = 'check_violation';
  end if;
  if p_slot_id is null then
    insert into schedule_slots(coach_membership_id, branch_id, weekday, start_time, duration_minutes, kind, client_id, label, starts_on, ends_on, created_by)
    values (p_coach_membership_id, m.branch_id, p_weekday, p_start_time, v_dur, p_kind, case when p_kind = 'client' then p_client_id end, p_label, p_starts_on, p_ends_on, auth.uid()) returning id into v_id;
  else
    update schedule_slots set weekday = p_weekday, start_time = p_start_time, duration_minutes = v_dur, kind = p_kind, client_id = case when p_kind = 'client' then p_client_id end, label = p_label, starts_on = p_starts_on, ends_on = p_ends_on
     where id = p_slot_id and coach_membership_id = p_coach_membership_id returning id into v_id;
    if v_id is null then raise exception 'slot not found'; end if;
    -- future materialized sessions from the old definition are dropped and recreated on next materialization
    delete from sessions where slot_id = v_id and status = 'booked' and scheduled_at > now();
  end if;
  perform fn_emit_event('schedule.slot_upserted', 'schedule_slots', v_id, m.branch_id, jsonb_build_object('coach_membership_id', p_coach_membership_id, 'client_id', p_client_id, 'kind', p_kind, 'weekday', p_weekday, 'start_time', p_start_time));
  return v_id;
end $$;

-- ---------------------------------------------------------------- one-off sessions
-- One-off session outside the weekly schedule (a make-up, a trial). Coaches only; requires credits with this coach.
-- Other clients may be with the coach at the same time. Refused: a Blocked hour of the coach on that date, and the same
-- client already booked then (a booked session with any coach, or a weekly slot of theirs whose session is not created yet).
create or replace function fn_add_session(p_client_id uuid, p_coach_membership_id uuid, p_scheduled_at timestamptz, p_duration int default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare c clients; m memberships; v_dur int; v_sid uuid; v_date date; v_from int; v_to int;
begin
  select * into c from clients where id = p_client_id;
  select * into m from memberships where id = p_coach_membership_id and role = 'coach' and is_active;
  if c is null or m is null then raise exception 'client or coach not found'; end if;
  if not (is_top_management() or has_role('head_coach', m.branch_id) or p_coach_membership_id in (select my_membership_ids())) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if fn_credit_balance(p_client_id, p_coach_membership_id) <= 0 then raise exception 'client has no credits with this coach' using errcode = 'GY001'; end if;
  -- one writer per client at a time (any coach), the same lock fn_upsert_schedule_slot takes
  perform pg_advisory_xact_lock(hashtextextended(p_client_id::text, 0));
  v_dur := coalesce(p_duration, fn_setting_int('scheduling.slot_minutes', 60));
  v_date := cairo_date(p_scheduled_at);
  v_from := (extract(epoch from (p_scheduled_at at time zone 'Africa/Cairo')::time) / 60)::int;
  v_to := v_from + v_dur;
  -- the coach's Blocked hours running on that date
  if exists (select 1 from schedule_slots x
             where x.coach_membership_id = p_coach_membership_id and x.kind = 'blocked' and x.is_active
               and x.weekday = extract(dow from v_date)::int and x.starts_on <= v_date and (x.ends_on is null or x.ends_on >= v_date)
               and not exists (select 1 from schedule_skips k where k.slot_id = x.id and k.skip_date = v_date)
               and (extract(epoch from x.start_time) / 60)::int < v_to and (extract(epoch from x.start_time) / 60)::int + x.duration_minutes > v_from) then
    raise exception 'overlaps a blocked hour on that day' using errcode = 'check_violation';
  end if;
  -- the same client, with any coach: booked sessions, and weekly slots on that date not materialized yet
  if exists (select 1 from sessions s where s.client_id = p_client_id and s.status = 'booked'
             and tstzrange(s.scheduled_at, s.scheduled_at + make_interval(mins => s.duration_minutes)) && tstzrange(p_scheduled_at, p_scheduled_at + make_interval(mins => v_dur)))
     or exists (select 1 from schedule_slots x
                where x.client_id = p_client_id and x.kind = 'client' and x.is_active
                  and x.weekday = extract(dow from v_date)::int and x.starts_on <= v_date and (x.ends_on is null or x.ends_on >= v_date)
                  and not exists (select 1 from schedule_skips k where k.slot_id = x.id and k.skip_date = v_date)
                  and not exists (select 1 from sessions s where s.slot_id = x.id and cairo_date(s.scheduled_at) = v_date)
                  and (extract(epoch from x.start_time) / 60)::int < v_to and (extract(epoch from x.start_time) / 60)::int + x.duration_minutes > v_from) then
    raise exception 'client already has a session at that time' using errcode = 'check_violation';
  end if;
  insert into sessions(client_id, coach_membership_id, branch_id, scheduled_at, duration_minutes, notes, created_by) values (p_client_id, p_coach_membership_id, m.branch_id, p_scheduled_at, v_dur, p_notes, auth.uid()) returning id into v_sid;
  perform fn_emit_event('session.added', 'sessions', v_sid, m.branch_id, jsonb_build_object('client_id', p_client_id, 'coach_membership_id', p_coach_membership_id, 'scheduled_at', p_scheduled_at));
  perform fn_notify_client(p_client_id, 'session.added', 'Session scheduled', to_char(p_scheduled_at at time zone 'Africa/Cairo', 'Dy DD Mon HH24:MI'), jsonb_build_object('session_id', v_sid), 'whatsapp');
  return v_sid;
end $$;

