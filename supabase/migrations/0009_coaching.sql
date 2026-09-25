-- GymOS — 0009_coaching.sql (M4 Coaching)
-- The weekly schedule, the coach's day, clients, programs, the head coach's Team and the reception kiosk.
-- Business rules stay in 0001 (fn_upsert_schedule_slot, fn_end_schedule_slot, fn_skip_slot, fn_materialize_sessions,
-- fn_record_attendance, fn_start_walkin_session, fn_add_session, fn_assign_coach, fn_check_in, fn_flag_for_sales);
-- this file adds:
--  1. read shapes (SECURITY DEFINER, scoped like fn_coach_day and the RLS policies): fn_coach_week, fn_schedulable_clients,
--     fn_coach_today (materializes the day first, like the screen did with two calls), fn_coach_clients, fn_coach_client,
--     fn_program, fn_program_templates, fn_coach_team
--  2. writes as RPCs: fn_add_weekly_slots (several weekdays in one transaction), fn_set_availability, fn_add_client_note,
--     fn_save_program, fn_new_program_version, fn_activate_program, fn_save_template, fn_kiosk_check_in, fn_kiosk_notify_sales
--  3. two gym-wide starter templates (exercise names are resolved when a template is read)
-- Dates are Cairo dates (cairo_date(now())), never the server's current_date.

-- =====================================================================
-- helpers
-- =====================================================================
-- Who may look at a coach's week/day: the coach, the branch head coach and sales manager, top management (as fn_coach_day).
create or replace function fn_can_see_coach(p_coach uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.id = p_coach and m.role = 'coach' and (
    is_top_management() or m.id in (select my_membership_ids()) or has_role('head_coach', m.branch_id) or has_role('sales_manager', m.branch_id)))
$$;

-- Who may change it (and record attendance on it): the coach, the branch head coach, top management (as fn_upsert_schedule_slot).
create or replace function fn_can_edit_coach(p_coach uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.id = p_coach and m.role = 'coach' and (
    is_top_management() or m.id in (select my_membership_ids()) or has_role('head_coach', m.branch_id)))
$$;

-- Clients a coach works with: the programs/clients RLS scope (primary coach, head coach's branch) plus anyone holding a pack
-- with one of my coach memberships (docs/04: such a client shows in my schedule and balances).
create or replace function fn_can_coach_client(p_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_top_management() or p_client in (select my_coach_client_ids())
    or exists (select 1 from credit_lots l where l.client_id = p_client and l.coach_membership_id in (select my_membership_ids()))
$$;

-- The caller's own coach membership for a branch (a head coach coaches through their coach membership).
create or replace function fn_my_coach_membership(p_branch uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from memberships where profile_id = auth.uid() and role = 'coach' and is_active and branch_id = p_branch limit 1
$$;

create or replace function fn_weekday_name(d int) returns text language sql immutable as $$
  select (array['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[d + 1]
$$;

-- Resolves a template/program day list: each exercise by id, or by name (starter templates are written with names).
create or replace function fn_resolve_days(p_days jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', coalesce(d->>'name', 'Day ' || di),
           'exercises', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'exercise_id', e.id, 'exercise_name', e.name, 'muscle_group', e.muscle_group, 'equipment', e.equipment,
                      'sets', coalesce((x->>'sets')::int, 3), 'reps', coalesce(x->>'reps', '10'), 'tempo', x->>'tempo',
                      'rest_seconds', (x->>'rest_seconds')::int, 'target_weight_kg', (x->>'target_weight_kg')::numeric,
                      'notes', x->>'notes', 'superset_group', x->>'superset_group') order by xi)
             from jsonb_array_elements(coalesce(d->'exercises', '[]')) with ordinality as xs(x, xi)
             join exercises e on e.id = case when x ? 'exercise_id' then (x->>'exercise_id')::uuid end or (not x ? 'exercise_id' and e.name = x->>'exercise')), '[]')
         ) order by di), '[]')
  from jsonb_array_elements(coalesce(p_days, '[]')) with ordinality as ds(d, di)
$$;

-- =====================================================================
-- 1. READ SHAPES
-- =====================================================================
-- A coach's recurring week as the WeekGrid draws it: working hours, slots active during the week of p_week_start (with the
-- dates skipped that week), and the sessions left with this coach for each client slot.
create or replace function fn_coach_week(p_coach uuid, p_week_start date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m memberships; v_end date := p_week_start + 6;
begin
  select * into m from memberships where id = p_coach and role = 'coach';
  if not found then raise exception 'coach not found' using errcode = 'no_data_found'; end if;
  if not fn_can_see_coach(p_coach) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  return jsonb_build_object(
    'coach', jsonb_build_object('membership_id', m.id, 'name', (select full_name from profiles where id = m.profile_id), 'branch_id', m.branch_id),
    'can_edit', fn_can_edit_coach(p_coach),
    'week_start', p_week_start,
    'today', cairo_date(now()),
    'slot_minutes', fn_setting_int('scheduling.slot_minutes', 60),
    'opening_hours', (select opening_hours from branches where id = m.branch_id),
    'availability', coalesce((select jsonb_agg(jsonb_build_object('weekday', a.weekday, 'start_time', to_char(a.start_time, 'HH24:MI'), 'end_time', to_char(a.end_time, 'HH24:MI')) order by a.weekday, a.start_time)
                              from coach_availability a where a.membership_id = p_coach), '[]'),
    'slots', coalesce((select jsonb_agg(jsonb_build_object(
                'id', x.id, 'weekday', x.weekday, 'start_time', to_char(x.start_time, 'HH24:MI'), 'duration_minutes', x.duration_minutes, 'kind', x.kind,
                'client_id', x.client_id, 'client_name', c.full_name, 'label', x.label, 'starts_on', x.starts_on, 'ends_on', x.ends_on,
                'credits_left', case when x.client_id is not null then fn_credit_balance(x.client_id, p_coach) end,
                'skipped', coalesce((select jsonb_agg(k.skip_date order by k.skip_date) from schedule_skips k where k.slot_id = x.id and k.skip_date between p_week_start and v_end), '[]'))
              order by x.weekday, x.start_time)
              from schedule_slots x left join clients c on c.id = x.client_id
              where x.coach_membership_id = p_coach and x.is_active and x.starts_on <= v_end and (x.ends_on is null or x.ends_on >= p_week_start)), '[]'));
end $$;

-- Clients a coach can put on the week or start a walk-in with: packs with this coach, or this coach is their primary coach.
-- Sessions left with this coach, next expiry, and the training days/time they asked for at onboarding (to preselect).
create or replace function fn_schedulable_clients(p_coach uuid)
returns table(client_id uuid, full_name text, credits_left int, next_expiry timestamptz, is_primary boolean, pref_days jsonb, pref_time text, weekly_slots int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not fn_can_see_coach(p_coach) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  return query
  select c.id, c.full_name, fn_credit_balance(c.id, p_coach),
         (select min(l.expires_at) from credit_lots l where l.client_id = c.id and l.coach_membership_id = p_coach and l.status = 'active' and l.qty_remaining > 0 and l.expires_at > now()),
         c.coach_membership_id = p_coach,
         coalesce(c.onboarding_responses #> '{pt_prefs,days}', '[]'), c.onboarding_responses #>> '{pt_prefs,time}',
         (select count(*)::int from schedule_slots x where x.client_id = c.id and x.coach_membership_id = p_coach and x.is_active)
  from clients c
  where c.coach_membership_id = p_coach
     or exists (select 1 from credit_lots l where l.client_id = c.id and l.coach_membership_id = p_coach and l.status = 'active')
  order by (fn_credit_balance(c.id, p_coach) > 0) desc, c.full_name;
end $$;

-- The coach's day for the Today screen. For today or later, the day's sessions are first materialized from the weekly slots
-- (fn_materialize_sessions is idempotent). Sessions carry what one tap needs: credits left with this coach, unpaid, injuries,
-- whether an edit now needs the head coach (late) and whether one is already pending.
create or replace function fn_coach_today(p_coach uuid, p_date date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m memberships; v_date date := coalesce(p_date, cairo_date(now())); v_window int := fn_setting_int('attendance.edit_window_hours', 24);
        v_risk int := fn_setting_int('risk.at_risk_threshold', 60);
begin
  select * into m from memberships where id = p_coach and role = 'coach';
  if not found then raise exception 'coach not found' using errcode = 'no_data_found'; end if;
  if not fn_can_see_coach(p_coach) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  if v_date >= cairo_date(now()) then perform fn_materialize_sessions(v_date, p_coach); end if;
  return jsonb_build_object(
    'date', v_date,
    'today', cairo_date(now()),
    'coach', jsonb_build_object('membership_id', m.id, 'name', (select full_name from profiles where id = m.profile_id), 'branch_id', m.branch_id),
    'can_record', fn_can_edit_coach(p_coach),
    'can_edit_late', is_top_management() or has_role('head_coach', m.branch_id),
    'edit_window_hours', v_window,
    'availability', coalesce((select jsonb_agg(jsonb_build_object('start_time', to_char(a.start_time, 'HH24:MI'), 'end_time', to_char(a.end_time, 'HH24:MI')) order by a.start_time)
                              from coach_availability a where a.membership_id = p_coach and a.weekday = extract(dow from v_date)::int), '[]'),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', s.id, 'starts_at', s.scheduled_at, 'duration_minutes', s.duration_minutes, 'client_id', s.client_id, 'client_name', c.full_name,
                  'status', s.status, 'credits_left', fn_credit_balance(s.client_id, p_coach), 'unpaid', s.unpaid, 'waived', s.waived, 'is_walk_in', s.is_walk_in,
                  'credit_consumed', s.credit_consumed, 'slot_id', s.slot_id,
                  'injuries', coalesce(nullif(c.injuries, ''), nullif(c.onboarding_responses #>> '{health,injuries}', '')),
                  'at_risk', coalesce(c.risk_score, 0) >= v_risk,
                  'late', now() > s.scheduled_at + make_interval(hours => v_window),
                  'pending_approval', exists (select 1 from approvals a where a.type = 'attendance_edit' and a.subject_id = s.id and a.status = 'pending'))
                order by s.scheduled_at)
                from sessions s join clients c on c.id = s.client_id
                where s.coach_membership_id = p_coach and cairo_date(s.scheduled_at) = v_date), '[]'),
    'blocks', coalesce((select jsonb_agg(jsonb_build_object('slot_id', x.id, 'kind', x.kind, 'label', x.label,
                  'starts_at', (v_date::text || ' ' || x.start_time::text)::timestamp at time zone 'Africa/Cairo', 'duration_minutes', x.duration_minutes) order by x.start_time)
                from schedule_slots x
                where x.coach_membership_id = p_coach and x.is_active and x.kind <> 'client' and x.weekday = extract(dow from v_date)::int
                  and x.starts_on <= v_date and (x.ends_on is null or x.ends_on >= v_date)
                  and not exists (select 1 from schedule_skips k where k.slot_id = x.id and k.skip_date = v_date)), '[]'),
    'follow_ups', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'title', f.title, 'due_at', f.due_at, 'client_id', f.client_id,
                  'client_name', c.full_name, 'overdue', f.due_at < now()) order by f.due_at)
                from follow_ups f left join clients c on c.id = f.client_id
                where f.status = 'open' and f.assigned_to_membership_id = p_coach
                  and f.due_at < ((v_date + 1)::timestamp at time zone 'Africa/Cairo') + interval '2 days'), '[]'));
end $$;

-- The coach's client list (docs/04 /coach/clients): clients whose primary coach is this coach, with the 30-day adherence
-- computed live with the same formula as mv_client_adherence (completed / (completed + no-show)), so a new client or a
-- no-show shows at once. An outcome recorded earlier on the day of the session counts straight away.
create or replace function fn_coach_clients(p_coach uuid)
returns table(client_id uuid, full_name text, status client_status, credits_left int, next_expiry timestamptz, last_visit_at timestamptz,
              scheduled_30d int, completed_30d int, no_shows_30d int, adherence_pct int, unpaid_sessions int, risk_score int, at_risk boolean,
              weekly_slots int, injuries text)
language plpgsql stable security definer set search_path = public as $$
declare v_risk int := fn_setting_int('risk.at_risk_threshold', 60);
begin
  if not fn_can_see_coach(p_coach) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  return query
  select c.id, c.full_name, c.status, fn_credit_balance(c.id, p_coach),
         (select min(l.expires_at) from credit_lots l where l.client_id = c.id and l.coach_membership_id = p_coach and l.status = 'active' and l.qty_remaining > 0 and l.expires_at > now()),
         c.last_visit_at, a.scheduled, a.completed, a.no_shows,
         case when a.scheduled > 0 then round(100.0 * a.completed / a.scheduled)::int end,
         (select count(*)::int from sessions s where s.client_id = c.id and s.unpaid and s.settled_at is null),
         coalesce(c.risk_score, 0), coalesce(c.risk_score, 0) >= v_risk,
         (select count(*)::int from schedule_slots x where x.client_id = c.id and x.coach_membership_id = p_coach and x.is_active),
         coalesce(nullif(c.injuries, ''), nullif(c.onboarding_responses #>> '{health,injuries}', ''))
  from clients c
  cross join lateral (
    select count(*) filter (where s.status in ('completed','no_show'))::int scheduled, count(*) filter (where s.status = 'completed')::int completed,
           count(*) filter (where s.status = 'no_show')::int no_shows
    from sessions s where s.client_id = c.id and s.scheduled_at > now() - interval '30 days') a
  where c.coach_membership_id = p_coach
  order by (coalesce(c.risk_score, 0) >= v_risk) desc, case when a.scheduled > 0 then 100.0 * a.completed / a.scheduled else 101 end asc, c.full_name;
end $$;

-- One client for the coaching side (docs/04 /coach/clients/[id]): header, balances per coach, onboarding answers, live adherence,
-- weekly slots, session history, programs, recent workouts, coaching notes.
create or replace function fn_coach_client(p_client uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c clients; v_risk int := fn_setting_int('risk.at_risk_threshold', 60);
begin
  select * into c from clients where id = p_client;
  if not found or not fn_can_coach_client(p_client) then raise exception 'client not found' using errcode = 'no_data_found'; end if;
  return jsonb_build_object(
    'id', c.id, 'full_name', c.full_name, 'phone', c.phone, 'gender', c.gender, 'status', c.status, 'joined_at', c.joined_at, 'last_visit_at', c.last_visit_at,
    'branch_id', c.home_branch_id, 'branch_name', (select name from branches where id = c.home_branch_id),
    'coach_membership_id', c.coach_membership_id,
    'coach_name', (select p.full_name from memberships m join profiles p on p.id = m.profile_id where m.id = c.coach_membership_id),
    'rep_name', (select p.full_name from memberships m join profiles p on p.id = m.profile_id where m.id = c.rep_membership_id),
    'risk_score', coalesce(c.risk_score, 0), 'at_risk', coalesce(c.risk_score, 0) >= v_risk, 'risk_reasons', coalesce(c.risk_reasons, '[]'),
    'injuries', coalesce(nullif(c.injuries, ''), nullif(c.onboarding_responses #>> '{health,injuries}', '')),
    'onboarding', coalesce(c.onboarding_responses, '{}'),
    'unpaid_sessions', (select count(*) from sessions s where s.client_id = c.id and s.unpaid and s.settled_at is null),
    'balances', coalesce((select jsonb_agg(to_jsonb(b)) from fn_credit_balances(c.id) b), '[]'),
    'membership_ends_at', (select max(e.ends_at) from entitlements e where e.client_id = c.id and e.type = 'membership' and e.status in ('active','frozen')),
    'adherence', (select jsonb_build_object('scheduled_30d', count(*) filter (where s.status in ('completed','no_show')), 'completed_30d', count(*) filter (where s.status = 'completed'),
                    'no_shows_30d', count(*) filter (where s.status = 'no_show'),
                    'adherence_pct', case when count(*) filter (where s.status in ('completed','no_show')) > 0
                      then round(100.0 * count(*) filter (where s.status = 'completed') / count(*) filter (where s.status in ('completed','no_show'))) end)
                  from sessions s where s.client_id = c.id and s.scheduled_at > now() - interval '30 days'),
    'slots', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'weekday', x.weekday, 'start_time', to_char(x.start_time, 'HH24:MI'), 'duration_minutes', x.duration_minutes,
                  'coach_membership_id', x.coach_membership_id, 'coach_name', p.full_name) order by (x.weekday + 1) % 7, x.start_time)
                from schedule_slots x join memberships m on m.id = x.coach_membership_id join profiles p on p.id = m.profile_id
                where x.client_id = c.id and x.is_active), '[]'),
    'next_session', (select jsonb_build_object('id', s.id, 'starts_at', s.scheduled_at, 'coach_name', p.full_name)
                     from sessions s join memberships m on m.id = s.coach_membership_id join profiles p on p.id = m.profile_id
                     where s.client_id = c.id and s.status = 'booked' and s.scheduled_at > now() order by s.scheduled_at limit 1),
    'sessions', coalesce((select jsonb_agg(x order by x.starts_at desc) from (
                  select s.id, s.scheduled_at starts_at, s.status, s.unpaid, s.settled_at, s.waived, s.is_walk_in, s.credit_consumed, s.coach_membership_id, p.full_name coach_name
                  from sessions s join memberships m on m.id = s.coach_membership_id join profiles p on p.id = m.profile_id
                  where s.client_id = c.id and s.scheduled_at > now() - interval '90 days' order by s.scheduled_at desc limit 60) x), '[]'),
    'programs', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'status', g.status, 'weeks', g.weeks, 'starts_at', g.starts_at, 'ends_at', g.ends_at,
                  'updated_at', g.updated_at, 'days', (select count(*) from program_days d where d.program_id = g.id)) order by g.status = 'active' desc, g.updated_at desc)
                from programs g where g.client_id = c.id), '[]'),
    'workouts', coalesce((select jsonb_agg(x order by x.performed_at desc) from (
                  select w.id, w.performed_at, d.name day_name, (select count(*) from set_logs sl where sl.workout_log_id = w.id) sets,
                         (select count(*) from set_logs sl where sl.workout_log_id = w.id and sl.is_pr) prs
                  from workout_logs w left join program_days d on d.id = w.program_day_id
                  where w.client_id = c.id order by w.performed_at desc limit 10) x), '[]'),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'visibility', n.visibility, 'created_at', n.created_at, 'author', p.full_name) order by n.created_at desc)
                from client_notes n join memberships m on m.id = n.author_membership_id join profiles p on p.id = m.profile_id
                where n.client_id = c.id and (is_top_management() or n.visibility in ('coaching','all'))), '[]'));
end $$;

-- A program with its days and exercises (the builder, and the client's view).
create or replace function fn_program(p_program uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare g programs;
begin
  select * into g from programs where id = p_program;
  if not found or not (g.client_id = my_client_id() or fn_can_coach_client(g.client_id)) then raise exception 'program not found' using errcode = 'no_data_found'; end if;
  return jsonb_build_object(
    'id', g.id, 'client_id', g.client_id, 'client_name', (select full_name from clients where id = g.client_id), 'coach_membership_id', g.coach_membership_id,
    'coach_name', (select p.full_name from memberships m join profiles p on p.id = m.profile_id where m.id = g.coach_membership_id),
    'name', g.name, 'goal', g.goal, 'weeks', g.weeks, 'status', g.status, 'starts_at', g.starts_at, 'ends_at', g.ends_at, 'updated_at', g.updated_at,
    'can_edit', g.status = 'draft' and fn_can_coach_client(g.client_id),
    'days', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'day_index', d.day_index, 'name', d.name,
                'exercises', coalesce((select jsonb_agg(jsonb_build_object('id', pe.id, 'exercise_id', pe.exercise_id, 'exercise_name', e.name, 'muscle_group', e.muscle_group,
                    'equipment', e.equipment, 'sets', pe.sets, 'reps', pe.reps, 'tempo', pe.tempo, 'rest_seconds', pe.rest_seconds, 'target_weight_kg', pe.target_weight_kg,
                    'notes', pe.notes, 'superset_group', pe.superset_group) order by pe.order_index)
                  from program_exercises pe join exercises e on e.id = pe.exercise_id where pe.program_day_id = d.id), '[]')) order by d.day_index)
              from program_days d where d.program_id = g.id), '[]'));
end $$;

-- Templates the caller can use (templates_read policy), with exercises resolved to ids.
create or replace function fn_program_templates() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'gym_wide', t.owner_membership_id is null,
           'owner_name', (select p.full_name from memberships m join profiles p on p.id = m.profile_id where m.id = t.owner_membership_id),
           'days', fn_resolve_days(t.structure)) order by t.owner_membership_id is null, t.name), '[]')
  from program_templates t
  where is_staff() and (is_top_management() or t.owner_membership_id is null or t.owner_membership_id in (select my_membership_ids())
        or (t.branch_id in (select my_branch_ids()) and has_role('head_coach', t.branch_id)))
$$;

-- The head coach's Team screen: coaches with this month's numbers (mv_coach_month) and live load, branch clients for the
-- reassignment picker, and the audit list (pending attendance edits, recent waivers, recent late edits, unpaid sessions).
create or replace function fn_coach_team(p_branch uuid, p_month text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_top_management() or has_role('head_coach', p_branch)) then raise exception 'the Team screen is the head coach''s' using errcode = 'insufficient_privilege'; end if;
  return jsonb_build_object(
    'coaches', coalesce((select jsonb_agg(jsonb_build_object(
                  'membership_id', m.id, 'name', p.full_name, 'is_head_coach', exists (select 1 from memberships h where h.profile_id = m.profile_id and h.role = 'head_coach' and h.is_active and h.branch_id = m.branch_id),
                  'capacity', coalesce(m.capacity, (select h.capacity from memberships h where h.profile_id = m.profile_id and h.role = 'head_coach' and h.branch_id = m.branch_id limit 1), 20),
                  'active_clients', (select count(*) from clients c where c.coach_membership_id = m.id and c.status in ('active','frozen')),
                  'weekly_slots', (select count(*) from schedule_slots x where x.coach_membership_id = m.id and x.is_active and x.kind = 'client'),
                  'sessions_completed', coalesce(v.sessions_completed, 0), 'credits_burned', coalesce(v.credits_burned, 0), 'no_show_pct', coalesce(v.no_show_pct, 0),
                  'revenue_delivered_net', coalesce(v.revenue_delivered_net, 0), 'commission_pct', coalesce(v.commission_pct, 0), 'unpaid_sessions', coalesce(v.unpaid_sessions, 0),
                  'retention_pct', v.retention_pct, 'utilization_pct', v.utilization_pct) order by p.full_name)
                from memberships m join profiles p on p.id = m.profile_id left join mv_coach_month v on v.membership_id = m.id and v.month = p_month
                where m.branch_id = p_branch and m.role = 'coach' and m.is_active), '[]'),
    'clients', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'full_name', c.full_name, 'coach_membership_id', c.coach_membership_id,
                  'coach_name', (select p.full_name from memberships m join profiles p on p.id = m.profile_id where m.id = c.coach_membership_id),
                  'credits_left', fn_credit_balance(c.id, c.coach_membership_id)) order by c.full_name)
                from clients c where c.home_branch_id = p_branch and c.coach_membership_id is not null), '[]'),
    'pending_edits', coalesce((select jsonb_agg(jsonb_build_object('approval_id', a.id, 'session_id', s.id, 'client_name', c.full_name, 'coach_name', p.full_name,
                  'starts_at', s.scheduled_at, 'current_status', s.status, 'requested_outcome', a.payload->>'outcome', 'waive', coalesce((a.payload->>'waive')::boolean, false),
                  'waive_reason', a.payload->>'waive_reason', 'requested_by', (select full_name from profiles where id = a.requested_by), 'requested_at', a.requested_at) order by a.requested_at)
                from approvals a join sessions s on s.id = a.subject_id join clients c on c.id = s.client_id
                join memberships m on m.id = s.coach_membership_id join profiles p on p.id = m.profile_id
                where a.type = 'attendance_edit' and a.status = 'pending' and a.branch_id = p_branch), '[]'),
    'waivers', coalesce((select jsonb_agg(jsonb_build_object('session_id', s.id, 'client_name', c.full_name, 'coach_name', p.full_name, 'starts_at', s.scheduled_at,
                  'reason', s.waive_reason, 'recorded_by', (select full_name from profiles where id = s.outcome_recorded_by)) order by s.scheduled_at desc)
                from sessions s join clients c on c.id = s.client_id join memberships m on m.id = s.coach_membership_id join profiles p on p.id = m.profile_id
                where s.branch_id = p_branch and s.waived and s.scheduled_at > now() - interval '30 days'), '[]'),
    'late_edits', coalesce((select jsonb_agg(jsonb_build_object('approval_id', a.id, 'client_name', c.full_name, 'starts_at', s.scheduled_at, 'outcome', a.payload->>'outcome',
                  'status', a.status, 'requested_by', (select full_name from profiles where id = a.requested_by), 'decided_by', (select full_name from profiles where id = a.decided_by),
                  'decided_at', a.decided_at) order by a.decided_at desc)
                from approvals a join sessions s on s.id = a.subject_id join clients c on c.id = s.client_id
                where a.type = 'attendance_edit' and a.status <> 'pending' and a.branch_id = p_branch and a.decided_at > now() - interval '30 days'), '[]'),
    'unpaid', coalesce((select jsonb_agg(jsonb_build_object('session_id', s.id, 'client_name', c.full_name, 'coach_name', p.full_name, 'starts_at', s.scheduled_at) order by s.scheduled_at desc)
                from sessions s join clients c on c.id = s.client_id join memberships m on m.id = s.coach_membership_id join profiles p on p.id = m.profile_id
                where s.branch_id = p_branch and s.unpaid and s.settled_at is null), '[]'));
end $$;

-- =====================================================================
-- 2. WRITES
-- =====================================================================
-- Adds the same slot on several weekdays at once (a client three times a week) — all or nothing. The failing weekday is
-- named in the error (DETAIL = weekday number) so the sheet can say "Sun: overlaps another slot on that day".
create or replace function fn_add_weekly_slots(p_coach uuid, p_weekdays int[], p_start_time time, p_kind slot_kind default 'client',
  p_client_id uuid default null, p_label text default null, p_duration int default null, p_starts_on date default null) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare d int; v_ids uuid[] := '{}'; v_state text; v_msg text;
begin
  if coalesce(cardinality(p_weekdays), 0) = 0 then raise exception 'pick at least one day' using errcode = 'check_violation'; end if;
  foreach d in array p_weekdays loop
    if d not between 0 and 6 then raise exception 'weekday must be 0–6' using errcode = 'check_violation'; end if;
    begin
      v_ids := v_ids || fn_upsert_schedule_slot(p_coach, d, p_start_time, p_kind, p_client_id, nullif(trim(p_label), ''), p_duration, coalesce(p_starts_on, cairo_date(now())), null, null);
    exception when check_violation or sqlstate 'GY001' then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      raise exception '%: %', fn_weekday_name(d), v_msg using errcode = v_state, detail = d::text;
    end;
  end loop;
  return v_ids;
end $$;

-- Working hours (coach_availability) replaced as a whole from the editor: [{weekday, start_time, end_time}].
create or replace function fn_set_availability(p_coach uuid, p_hours jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare m memberships;
begin
  select * into m from memberships where id = p_coach and role = 'coach';
  if not found then raise exception 'coach not found' using errcode = 'no_data_found'; end if;
  if not fn_can_edit_coach(p_coach) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_hours, '[]')) h
             where (h->>'weekday')::int not between 0 and 6 or (h->>'end_time')::time <= (h->>'start_time')::time) then
    raise exception 'each block needs a day and an end after its start' using errcode = 'check_violation';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_hours, '[]')) with ordinality a(h, i) join jsonb_array_elements(coalesce(p_hours, '[]')) with ordinality b(h, i)
             on a.i < b.i and (a.h->>'weekday') = (b.h->>'weekday')
             and (a.h->>'start_time')::time < (b.h->>'end_time')::time and (b.h->>'start_time')::time < (a.h->>'end_time')::time) then
    raise exception 'working hours overlap on the same day' using errcode = 'check_violation';
  end if;
  delete from coach_availability where membership_id = p_coach;
  insert into coach_availability(membership_id, weekday, start_time, end_time)
  select p_coach, (h->>'weekday')::int, (h->>'start_time')::time, (h->>'end_time')::time from jsonb_array_elements(coalesce(p_hours, '[]')) h;
  perform fn_emit_event('availability.updated', 'memberships', p_coach, m.branch_id, jsonb_build_object('hours', coalesce(p_hours, '[]')));
end $$;

create or replace function fn_add_client_note(p_client uuid, p_body text, p_visibility note_visibility default 'coaching') returns uuid
language plpgsql security definer set search_path = public as $$
declare c clients; v_author uuid; v_id uuid;
begin
  select * into c from clients where id = p_client;
  if not found or not fn_can_coach_client(p_client) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'note is empty' using errcode = 'check_violation'; end if;
  select id into v_author from memberships where profile_id = auth.uid() and is_active and role in ('coach','head_coach','nutritionist','top_management')
   order by (branch_id = c.home_branch_id) desc nulls last, role = 'coach' desc limit 1;
  insert into client_notes(client_id, author_membership_id, body, visibility) values (p_client, v_author, trim(p_body), p_visibility) returning id into v_id;
  perform fn_emit_event('client.note_added', 'clients', p_client, c.home_branch_id, jsonb_build_object('note_id', v_id, 'visibility', p_visibility));
  return v_id;
end $$;

-- Program builder save (autosave): creates a draft or rewrites a draft's days and exercises from
-- [{name, exercises:[{exercise_id, sets, reps, tempo, rest_seconds, target_weight_kg, notes, superset_group}]}].
-- An active program is never rewritten (clients log against it): fn_new_program_version copies it into a draft.
create or replace function fn_save_program(p_program_id uuid, p_client_id uuid, p_name text, p_goal text, p_weeks int, p_days jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g programs; c clients; v_id uuid; v_day uuid; d record; x record; v_coach uuid;
begin
  if p_program_id is not null then
    select * into g from programs where id = p_program_id for update;
    if not found then raise exception 'program not found' using errcode = 'no_data_found'; end if;
    p_client_id := g.client_id;
  end if;
  select * into c from clients where id = p_client_id;
  if not found or not fn_can_coach_client(p_client_id) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  if p_program_id is not null and g.status <> 'draft' then raise exception 'only a draft can be edited' using errcode = 'check_violation'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'program name required' using errcode = 'check_violation'; end if;
  if coalesce(p_weeks, 0) not between 1 and 52 then raise exception 'weeks must be 1–52' using errcode = 'check_violation'; end if;
  if jsonb_typeof(coalesce(p_days, '[]')) <> 'array' or jsonb_array_length(coalesce(p_days, '[]')) > 7 then raise exception 'up to 7 days per week' using errcode = 'check_violation'; end if;

  if p_program_id is null then
    v_coach := coalesce(fn_my_coach_membership(c.home_branch_id), c.coach_membership_id);
    if v_coach is null then raise exception 'client has no coach' using errcode = 'check_violation'; end if;
    insert into programs(client_id, coach_membership_id, name, goal, weeks, status) values (p_client_id, v_coach, trim(p_name), p_goal, p_weeks, 'draft') returning id into v_id;
  else
    v_id := p_program_id;
    update programs set name = trim(p_name), goal = p_goal, weeks = p_weeks, updated_at = now() where id = v_id;
    delete from program_days where program_id = v_id;   -- a draft has no workout logs; its structure is rewritten as a whole
  end if;
  for d in select value as day, ordinality as i from jsonb_array_elements(coalesce(p_days, '[]')) with ordinality loop
    insert into program_days(program_id, day_index, name) values (v_id, d.i, coalesce(nullif(trim(d.day->>'name'), ''), 'Day ' || d.i)) returning id into v_day;
    for x in select value as ex, ordinality as j from jsonb_array_elements(coalesce(d.day->'exercises', '[]')) with ordinality loop
      insert into program_exercises(program_day_id, exercise_id, order_index, sets, reps, tempo, rest_seconds, target_weight_kg, notes, superset_group)
      values (v_day, (x.ex->>'exercise_id')::uuid, x.j, greatest(1, coalesce((x.ex->>'sets')::int, 3)), coalesce(nullif(x.ex->>'reps', ''), '10'), nullif(x.ex->>'tempo', ''),
              (x.ex->>'rest_seconds')::int, (x.ex->>'target_weight_kg')::numeric, nullif(x.ex->>'notes', ''), nullif(x.ex->>'superset_group', ''));
    end loop;
  end loop;
  if p_program_id is null then
    perform fn_emit_event('program.created', 'programs', v_id, c.home_branch_id, jsonb_build_object('client_id', p_client_id));
  end if;
  return fn_program(v_id);
end $$;

-- Edit an active (or archived) program: copy it into a new draft; activating the draft archives the old one.
create or replace function fn_new_program_version(p_program_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare g programs; v_id uuid; d program_days; v_day uuid;
begin
  select * into g from programs where id = p_program_id;
  if not found or not fn_can_coach_client(g.client_id) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  select id into v_id from programs where client_id = g.client_id and status = 'draft' order by updated_at desc limit 1;
  if v_id is not null then return v_id; end if;   -- one draft at a time: keep working on it
  insert into programs(client_id, coach_membership_id, name, goal, weeks, status)
  values (g.client_id, coalesce(fn_my_coach_membership((select home_branch_id from clients where id = g.client_id)), g.coach_membership_id), g.name, g.goal, g.weeks, 'draft')
  returning id into v_id;
  for d in select * from program_days where program_id = g.id order by day_index loop
    insert into program_days(program_id, day_index, name) values (v_id, d.day_index, d.name) returning id into v_day;
    insert into program_exercises(program_day_id, exercise_id, order_index, sets, reps, tempo, rest_seconds, target_weight_kg, notes, superset_group)
    select v_day, exercise_id, order_index, sets, reps, tempo, rest_seconds, target_weight_kg, notes, superset_group from program_exercises where program_day_id = d.id;
  end loop;
  perform fn_emit_event('program.created', 'programs', v_id, (select home_branch_id from clients where id = g.client_id), jsonb_build_object('client_id', g.client_id, 'from_program_id', g.id));
  return v_id;
end $$;

-- Activate a draft: the client's current program is archived, this one runs from today for its weeks. The programs trigger
-- (0001) emits program.activated and pushes "Your new program is ready" to the client.
create or replace function fn_activate_program(p_program_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g programs; v_today date := cairo_date(now());
begin
  select * into g from programs where id = p_program_id for update;
  if not found or not fn_can_coach_client(g.client_id) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  if g.status <> 'draft' then raise exception 'only a draft can be activated' using errcode = 'check_violation'; end if;
  if not exists (select 1 from program_days d join program_exercises e on e.program_day_id = d.id where d.program_id = g.id) then
    raise exception 'add at least one exercise before activating' using errcode = 'check_violation';
  end if;
  update programs set status = 'archived', ends_at = least(coalesce(ends_at, v_today), v_today), updated_at = now() where client_id = g.client_id and status = 'active';
  update programs set status = 'active', starts_at = v_today, ends_at = v_today + g.weeks * 7 - 1, updated_at = now() where id = g.id;
  return fn_program(g.id);
end $$;

-- "Save as template": the caller's own template, or gym-wide (head coach / top management).
create or replace function fn_save_template(p_name text, p_days jsonb, p_gym_wide boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_branch uuid; v_id uuid;
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'template name required' using errcode = 'check_violation'; end if;
  select id, branch_id into v_owner, v_branch from memberships where profile_id = auth.uid() and is_active and role in ('coach','head_coach') order by role = 'coach' desc limit 1;
  if v_owner is null and not is_top_management() then raise exception 'coaches only' using errcode = 'insufficient_privilege'; end if;
  if p_gym_wide and not (is_top_management() or has_role('head_coach', v_branch)) then raise exception 'only the head coach saves gym-wide templates' using errcode = 'insufficient_privilege'; end if;
  insert into program_templates(name, owner_membership_id, branch_id, structure)
  values (trim(p_name), case when p_gym_wide then null else v_owner end, v_branch,
          (select coalesce(jsonb_agg(jsonb_build_object('name', d->>'name', 'exercises', (select coalesce(jsonb_agg(x - 'exercise_name' - 'muscle_group' - 'equipment' - 'id'), '[]')
                                     from jsonb_array_elements(coalesce(d->'exercises', '[]')) x))), '[]') from jsonb_array_elements(coalesce(p_days, '[]')) d))
  returning id into v_id;
  perform fn_emit_event('template.saved', 'program_templates', v_id, v_branch, jsonb_build_object('name', trim(p_name), 'gym_wide', p_gym_wide));
  return v_id;
end $$;

-- Reception kiosk: the member types their phone. Finds the client and checks them in (fn_check_in decides admission).
-- Adds what the screen shows: sessions left per coach, membership end, next session, and on refusal whether PT sessions
-- could be used at another branch and who their rep is (for "Notify sales").
create or replace function fn_kiosk_check_in(p_phone text, p_branch uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c clients; v_res jsonb; v_next record;
begin
  if not (is_staff() and (is_top_management() or p_branch in (select my_branch_ids()))) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  select * into c from clients where phone = fn_normalize_phone(p_phone);
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  v_res := fn_check_in(c.id, p_branch, 'phone');
  select s.scheduled_at, p.full_name coach_name into v_next from sessions s join memberships m on m.id = s.coach_membership_id join profiles p on p.id = m.profile_id
   where s.client_id = c.id and s.status = 'booked' and s.scheduled_at > now() - interval '1 hour' order by s.scheduled_at limit 1;
  return v_res - 'next_session' || jsonb_build_object(
    'client_id', c.id, 'first_name', split_part(c.full_name, ' ', 1),
    'balances', coalesce((select jsonb_agg(jsonb_build_object('coach_name', b.coach_name, 'balance', b.balance, 'next_expiry', b.next_expiry)) from fn_credit_balances(c.id) b where b.balance > 0), '[]'),
    'membership_ends_at', (select max(e.ends_at) from entitlements e where e.client_id = c.id and e.type = 'membership' and e.status = 'active' and e.ends_at > now()),
    'next_session', case when v_next.scheduled_at is not null then jsonb_build_object('starts_at', v_next.scheduled_at, 'coach_name', v_next.coach_name) end,
    'pt_branch', (select b.name from credit_lots l join memberships m on m.id = l.coach_membership_id join branches b on b.id = m.branch_id
                  where l.client_id = c.id and l.status = 'active' and l.qty_remaining > 0 and l.expires_at > now() and m.branch_id <> p_branch limit 1),
    'rep_name', (select split_part(p.full_name, ' ', 1) from memberships m join profiles p on p.id = m.profile_id where m.id = c.rep_membership_id));
end $$;

-- "Notify sales" after a refusal at the kiosk: the client's rep (or the branch sales manager) gets a FLAG task, live.
-- Any staff of the kiosk's branch may send it, also for a client of the other branch.
create or replace function fn_kiosk_notify_sales(p_client_id uuid, p_branch uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c clients; v_fid uuid;
begin
  if not (is_staff() and (is_top_management() or p_branch in (select my_branch_ids()))) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  select * into c from clients where id = p_client_id;
  if not found then raise exception 'client not found' using errcode = 'no_data_found'; end if;
  v_fid := fn_flag_for_sales_internal(p_client_id, 'Refused at reception (' || (select name from branches where id = p_branch) || '): no active membership', 'kiosk_refused', null);
  return jsonb_build_object('ok', true, 'follow_up_id', v_fid,
    'notified', coalesce((select split_part(p.full_name, ' ', 1) from memberships m join profiles p on p.id = m.profile_id where m.id = c.rep_membership_id), 'the sales manager'));
end $$;

-- =====================================================================
-- 3. STARTER TEMPLATES (gym-wide; exercises by name, resolved on read)
-- =====================================================================
insert into program_templates(name, owner_membership_id, branch_id, structure) values
 ('Full body — 2 days', null, null, '[
   {"name":"Day A — Full body","exercises":[{"exercise":"Goblet squat","sets":3,"reps":"10","rest_seconds":90},{"exercise":"Bench press","sets":3,"reps":"8","rest_seconds":120},
     {"exercise":"Seated cable row","sets":3,"reps":"10","rest_seconds":90},{"exercise":"Plank","sets":3,"reps":"45s","rest_seconds":60}]},
   {"name":"Day B — Full body","exercises":[{"exercise":"Romanian deadlift","sets":3,"reps":"8","rest_seconds":120},{"exercise":"Dumbbell shoulder press","sets":3,"reps":"10","rest_seconds":90},
     {"exercise":"Lat pulldown","sets":3,"reps":"10","rest_seconds":90},{"exercise":"Dead bug","sets":3,"reps":"10","rest_seconds":60}]}]'),
 ('Upper / lower — 4 days', null, null, '[
   {"name":"Upper 1","exercises":[{"exercise":"Bench press","sets":4,"reps":"6-8","rest_seconds":150},{"exercise":"Barbell row","sets":4,"reps":"8","rest_seconds":120},{"exercise":"Lateral raise","sets":3,"reps":"12","rest_seconds":60}]},
   {"name":"Lower 1","exercises":[{"exercise":"Back squat","sets":4,"reps":"6-8","rest_seconds":150},{"exercise":"Romanian deadlift","sets":3,"reps":"8-10","rest_seconds":120},{"exercise":"Calf raise","sets":3,"reps":"12","rest_seconds":60}]},
   {"name":"Upper 2","exercises":[{"exercise":"Overhead press","sets":4,"reps":"6-8","rest_seconds":150},{"exercise":"Pull-up","sets":4,"reps":"6-10","rest_seconds":120},{"exercise":"Face pull","sets":3,"reps":"15","rest_seconds":60}]},
   {"name":"Lower 2","exercises":[{"exercise":"Hip thrust","sets":4,"reps":"8-10","rest_seconds":120},{"exercise":"Bulgarian split squat","sets":3,"reps":"10","rest_seconds":90},{"exercise":"Leg curl","sets":3,"reps":"12","rest_seconds":60}]}]');

-- =====================================================================
-- 4. PRIVILEGES (see 0006: every migration revokes anon/PUBLIC on its functions)
-- =====================================================================
revoke execute on function
  fn_can_see_coach(uuid), fn_can_edit_coach(uuid), fn_can_coach_client(uuid), fn_my_coach_membership(uuid), fn_weekday_name(int), fn_resolve_days(jsonb),
  fn_coach_week(uuid, date), fn_schedulable_clients(uuid), fn_coach_today(uuid, date), fn_coach_clients(uuid), fn_coach_client(uuid), fn_program(uuid),
  fn_program_templates(), fn_coach_team(uuid, text), fn_add_weekly_slots(uuid, int[], time, slot_kind, uuid, text, int, date), fn_set_availability(uuid, jsonb),
  fn_add_client_note(uuid, text, note_visibility), fn_save_program(uuid, uuid, text, text, int, jsonb), fn_new_program_version(uuid), fn_activate_program(uuid),
  fn_save_template(text, jsonb, boolean), fn_kiosk_check_in(text, uuid), fn_kiosk_notify_sales(uuid, uuid)
from public, anon;
revoke execute on function fn_can_see_coach(uuid), fn_can_edit_coach(uuid), fn_can_coach_client(uuid), fn_my_coach_membership(uuid), fn_weekday_name(int), fn_resolve_days(jsonb) from authenticated;
grant execute on function
  fn_coach_week(uuid, date), fn_schedulable_clients(uuid), fn_coach_today(uuid, date), fn_coach_clients(uuid), fn_coach_client(uuid), fn_program(uuid),
  fn_program_templates(), fn_coach_team(uuid, text), fn_add_weekly_slots(uuid, int[], time, slot_kind, uuid, text, int, date), fn_set_availability(uuid, jsonb),
  fn_add_client_note(uuid, text, note_visibility), fn_save_program(uuid, uuid, text, text, int, jsonb), fn_new_program_version(uuid), fn_activate_program(uuid),
  fn_save_template(text, jsonb, boolean), fn_kiosk_check_in(text, uuid), fn_kiosk_notify_sales(uuid, uuid)
to authenticated;
