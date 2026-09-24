-- GymOS — 0006_sales_views.sql (M2 Sales)
-- The M2 prompt names this file 0003_sales_views.sql; 0003–0005 were already taken, so it is 0006.
--
-- 1. Read shapes for the sales screens (SECURITY DEFINER, scoped exactly like the leads RLS policies) so the app never
--    joins leads with memberships/profiles on the client: fn_sales_leads, fn_sales_lead, fn_find_by_phone,
--    fn_sales_today, fn_sales_queue, fn_sales_team, fn_sales_reps, fn_lead_breakdown.
-- 2. Public wizard resume: fn_onboarding_state(token) (anon) returns only what the lead entered.
-- 3. Writes that were table-only become RPCs (every write through fn_*, each emits an event):
--    fn_log_touch, fn_add_follow_up, fn_complete_follow_up.
-- 4. Function privileges: new functions are no longer executable by PUBLIC/anon by default; anon keeps exactly the
--    wizard functions.

-- =====================================================================
-- helpers
-- =====================================================================
-- Same predicate as the leads_read policy.
create or replace function fn_can_see_lead(p_lead_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from leads l
    where l.id = p_lead_id
      and (is_top_management() or l.id in (select my_lead_ids()) or (has_role('front_desk', l.branch_id) and l.created_by = auth.uid()))
  )
$$;

-- Caller may act for sales in this branch (rep, manager, front desk) or is top management.
create or replace function fn_is_sales_of_branch(p_branch_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_top_management() or exists (
    select 1 from memberships m where m.profile_id = auth.uid() and m.is_active and m.branch_id = p_branch_id
      and m.role in ('sales_rep', 'sales_manager', 'front_desk')
  )
$$;

create or replace function fn_membership_name(p_membership_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select p.full_name from memberships m join profiles p on p.id = m.profile_id where m.id = p_membership_id
$$;

-- When a lead entered its current stage: the last stage event, else first contact (auto-move), else creation.
create or replace function fn_lead_stage_since(p_lead leads) returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select max(e.occurred_at) from events e where e.subject_table = 'leads' and e.subject_id = p_lead.id and e.type in ('lead.stage_changed', 'lead.onboarded')),
    case when p_lead.status = 'contacted' then p_lead.first_contact_at end,
    p_lead.created_at)
$$;

create or replace function fn_lead_sla_state(p_lead leads) returns text
language sql stable as $$
  select case
    when p_lead.first_contact_at is not null then case when p_lead.first_contact_due_at is null or p_lead.first_contact_at <= p_lead.first_contact_due_at then 'met' else 'late' end
    when p_lead.status in ('won', 'lost') then 'closed'
    when p_lead.first_contact_due_at < now() then 'breached'
    else 'due' end
$$;

-- =====================================================================
-- 1. READ SHAPES
-- =====================================================================
create or replace function fn_sales_leads(p_branch_id uuid default null, p_status lead_status default null, p_search text default null, p_include_closed boolean default false)
returns table(
  id uuid, branch_id uuid, full_name text, phone text, email text, status lead_status,
  source_code text, source_name text, owner_membership_id uuid, owner_name text, interest_tags text[],
  created_at timestamptz, first_contact_due_at timestamptz, first_contact_at timestamptz, stage_since timestamptz,
  next_follow_up_at timestamptz, onboarding_completed_at timestamptz, review_status review_status, lost_reason lost_reason,
  last_touch_at timestamptz, is_stale boolean, sla_state text)
language sql stable security definer set search_path = public as $$
  select l.id, l.branch_id, l.full_name, l.phone, l.email, l.status,
         s.code, s.name, l.owner_membership_id, fn_membership_name(l.owner_membership_id), l.interest_tags,
         l.created_at, l.first_contact_due_at, l.first_contact_at, fn_lead_stage_since(l),
         (select min(f.due_at) from follow_ups f where f.lead_id = l.id and f.status = 'open'),
         l.onboarding_completed_at, l.review_status, l.lost_reason,
         t.last_touch_at,
         l.status not in ('won', 'lost') and coalesce(t.last_touch_at, l.created_at) < now() - make_interval(days => fn_setting_int('sales.stale_lead_days', 14)),
         fn_lead_sla_state(l)
  from leads l
  left join lead_sources s on s.id = l.source_id
  left join lateral (select max(x.occurred_at) as last_touch_at from touches x where x.lead_id = l.id) t on true
  where fn_can_see_lead(l.id)
    and (p_branch_id is null or l.branch_id = p_branch_id)
    and (p_status is null or l.status = p_status)
    and (p_include_closed or p_status is not null or l.status not in ('won', 'lost'))
    and (coalesce(trim(p_search), '') = '' or l.full_name ilike '%' || trim(p_search) || '%' or l.phone like '%' || regexp_replace(p_search, '[^0-9]', '', 'g') || '%'
         and regexp_replace(p_search, '[^0-9]', '', 'g') <> '')
  order by l.created_at desc
  limit 500
$$;

-- Everything the lead detail screen shows, in one call.
create or replace function fn_sales_lead(p_lead_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l leads; v_manager boolean;
begin
  select * into l from leads where id = p_lead_id;
  if not found or not fn_can_see_lead(p_lead_id) then raise exception 'lead not found' using errcode = 'no_data_found'; end if;
  v_manager := is_top_management() or has_role('sales_manager', l.branch_id);
  return jsonb_build_object(
    'id', l.id, 'branch_id', l.branch_id, 'branch_name', (select name from branches where id = l.branch_id),
    'full_name', l.full_name, 'phone', l.phone, 'email', l.email, 'status', l.status,
    'lost_reason', l.lost_reason, 'lost_note', l.lost_note, 'interest_tags', to_jsonb(l.interest_tags),
    'source_code', (select code from lead_sources where id = l.source_id), 'source_name', (select name from lead_sources where id = l.source_id),
    'owner_membership_id', l.owner_membership_id, 'owner_name', fn_membership_name(l.owner_membership_id),
    'created_at', l.created_at, 'stage_since', fn_lead_stage_since(l),
    'first_contact_due_at', l.first_contact_due_at, 'first_contact_at', l.first_contact_at, 'sla_state', fn_lead_sla_state(l),
    'review_status', l.review_status, 'review_note', l.review_note,
    'instagram_handle', l.instagram_handle, 'consent_marketing', l.consent_marketing, 'consent_content', l.consent_content,
    'onboarding', jsonb_build_object('responses', l.onboarding_responses, 'completed_at', l.onboarding_completed_at,
        'link_sent', l.onboarding_token is not null, 'link_expires_at', l.onboarding_token_expires_at, 'schema_version', l.onboarding_schema_version),
    'converted_client_id', l.converted_client_id,
    'can_edit', v_manager or l.owner_membership_id in (select my_membership_ids()),
    'can_manage', v_manager,
    'touches', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'type', t.type, 'direction', t.direction, 'note', t.note,
                           'occurred_at', t.occurred_at, 'by_name', p.full_name) order by t.occurred_at desc)
                         from touches t left join profiles p on p.id = t.by_profile_id where t.lead_id = l.id), '[]'),
    'follow_ups', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'title', f.title, 'due_at', f.due_at, 'status', f.status,
                           'completed_at', f.completed_at, 'assignee_name', fn_membership_name(f.assigned_to_membership_id)) order by f.status, f.due_at)
                         from follow_ups f where f.lead_id = l.id), '[]'),
    'deals', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'status', d.status, 'total_piastres', d.total_piastres, 'created_at', d.created_at) order by d.created_at desc)
                         from deals d where d.lead_id = l.id), '[]')
  );
end $$;

-- Duplicate check as you type. Any staff member; details only when the caller may open the record.
create or replace function fn_find_by_phone(p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_phone text; l leads; c clients;
begin
  if not is_staff() then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  v_phone := fn_normalize_phone(p_phone);
  if v_phone is null or length(v_phone) < 8 then return jsonb_build_object('found', false); end if;
  select * into l from leads where phone = v_phone and status <> 'lost' limit 1;
  if found then
    return jsonb_build_object('found', true, 'kind', 'lead', 'id', l.id, 'visible', fn_can_see_lead(l.id),
      'name', case when fn_can_see_lead(l.id) then l.full_name end, 'status', l.status,
      'owner_name', split_part(coalesce(fn_membership_name(l.owner_membership_id), ''), ' ', 1),
      'branch_code', (select code from branches where id = l.branch_id));
  end if;
  select * into c from clients where phone = v_phone limit 1;
  if found then
    return jsonb_build_object('found', true, 'kind', 'client', 'id', c.id,
      'visible', is_top_management() or c.id in (select my_sales_client_ids()) or c.id in (select my_coach_client_ids()) or has_role('front_desk', c.home_branch_id),
      'name', case when is_top_management() or c.id in (select my_sales_client_ids()) or has_role('front_desk', c.home_branch_id) then c.full_name end,
      'branch_code', (select code from branches where id = c.home_branch_id));
  end if;
  return jsonb_build_object('found', false);
end $$;

-- The sales Today screen for the acting branch.
create or replace function fn_sales_today(p_branch_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_mine uuid[]; v_manager boolean; v_end timestamptz; v_start timestamptz;
begin
  if not fn_is_sales_of_branch(p_branch_id) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  select coalesce(array_agg(id), '{}') into v_mine from memberships where profile_id = auth.uid() and is_active and branch_id = p_branch_id;
  v_manager := is_top_management() or has_role('sales_manager', p_branch_id);
  v_start := ((now() at time zone 'Africa/Cairo')::date)::timestamp at time zone 'Africa/Cairo';
  v_end := v_start + interval '1 day';
  return jsonb_build_object(
    'flags', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'client_id', c.id, 'client_name', c.full_name, 'phone', c.phone,
                  'note', regexp_replace(f.title, '^FLAG: [^—]*— ', ''), 'created_at', f.created_at,
                  'coach_name', fn_membership_name(c.coach_membership_id), 'assignee_name', fn_membership_name(f.assigned_to_membership_id)) order by f.created_at)
               from follow_ups f join clients c on c.id = f.client_id
               where f.status = 'open' and f.title like 'FLAG:%' and c.home_branch_id = p_branch_id
                 and (v_manager or f.assigned_to_membership_id = any(v_mine))), '[]'),
    'follow_ups', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'title', f.title, 'due_at', f.due_at, 'overdue', f.due_at < now(),
                  'lead_id', f.lead_id, 'client_id', f.client_id, 'name', coalesce(l.full_name, c.full_name), 'phone', coalesce(l.phone, c.phone)) order by f.due_at)
               from follow_ups f left join leads l on l.id = f.lead_id left join clients c on c.id = f.client_id
               where f.status = 'open' and f.title not like 'FLAG:%' and f.assigned_to_membership_id = any(v_mine) and f.due_at < v_end), '[]'),
    'new_leads', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'full_name', l.full_name, 'phone', l.phone, 'created_at', l.created_at,
                  'first_contact_due_at', l.first_contact_due_at, 'sla_state', fn_lead_sla_state(l),
                  'source_name', (select name from lead_sources where id = l.source_id)) order by l.first_contact_due_at)
               from leads l where l.branch_id = p_branch_id and l.owner_membership_id = any(v_mine) and l.status = 'new' and l.first_contact_at is null), '[]'),
    'onboarded_today', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'full_name', l.full_name, 'phone', l.phone, 'completed_at', l.onboarding_completed_at) order by l.onboarding_completed_at desc)
               from leads l where l.branch_id = p_branch_id and l.owner_membership_id = any(v_mine) and l.onboarding_completed_at >= v_start), '[]')
  );
end $$;

-- The sales manager's queue for a branch.
create or replace function fn_sales_queue(p_branch_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_stale int := fn_setting_int('sales.stale_lead_days', 14);
begin
  if not (is_top_management() or has_role('sales_manager', p_branch_id)) then raise exception 'only the sales manager' using errcode = 'insufficient_privilege'; end if;
  return jsonb_build_object(
    'flags', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'client_id', c.id, 'client_name', c.full_name,
                  'note', regexp_replace(f.title, '^FLAG: [^—]*— ', ''), 'created_at', f.created_at, 'assignee_name', fn_membership_name(f.assigned_to_membership_id),
                  'coach_name', fn_membership_name(c.coach_membership_id)) order by f.created_at)
               from follow_ups f join clients c on c.id = f.client_id
               where f.status = 'open' and f.title like 'FLAG:%' and c.home_branch_id = p_branch_id), '[]'),
    'unassigned', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'full_name', l.full_name, 'phone', l.phone, 'created_at', l.created_at,
                  'source_name', (select name from lead_sources where id = l.source_id), 'first_contact_due_at', l.first_contact_due_at) order by l.created_at)
               from leads l where l.branch_id = p_branch_id and l.owner_membership_id is null and l.status not in ('won', 'lost')), '[]'),
    'review', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'full_name', l.full_name, 'phone', l.phone, 'created_at', l.created_at,
                  'owner_name', fn_membership_name(l.owner_membership_id), 'source_name', (select name from lead_sources where id = l.source_id)) order by l.created_at)
               from leads l where l.branch_id = p_branch_id and l.review_status = 'pending' and l.status not in ('won', 'lost')), '[]'),
    'sla_breaches', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'full_name', l.full_name, 'owner_name', fn_membership_name(l.owner_membership_id),
                  'first_contact_due_at', l.first_contact_due_at) order by l.first_contact_due_at)
               from leads l where l.branch_id = p_branch_id and l.first_contact_at is null and l.first_contact_due_at < now() and l.status = 'new'), '[]'),
    'stale', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'full_name', l.full_name, 'status', l.status, 'owner_name', fn_membership_name(l.owner_membership_id),
                  'last_touch_at', t.last_touch_at) order by coalesce(t.last_touch_at, l.created_at))
               from leads l left join lateral (select max(x.occurred_at) last_touch_at from touches x where x.lead_id = l.id) t on true
               where l.branch_id = p_branch_id and l.status not in ('won', 'lost') and coalesce(t.last_touch_at, l.created_at) < now() - make_interval(days => v_stale)), '[]'),
    'approvals_pending', (select count(*) from approvals a where a.branch_id = p_branch_id and a.status = 'pending' and a.type <> 'attendance_edit')
  );
end $$;

-- Reps (and the manager) of a branch: pickers for assignment. Any sales member of the branch.
create or replace function fn_sales_reps(p_branch_id uuid)
returns table(membership_id uuid, full_name text, role app_role, rotation_paused boolean)
language sql stable security definer set search_path = public as $$
  select m.id, p.full_name, m.role, m.rotation_paused
  from memberships m join profiles p on p.id = m.profile_id
  where fn_is_sales_of_branch(p_branch_id) and m.branch_id = p_branch_id and m.is_active and m.role in ('sales_rep', 'sales_manager')
  order by m.role desc, p.full_name
$$;

-- Sales manager's team table: rotation state + this month's numbers (mv_rep_month) + open flags + target.
create or replace function fn_sales_team(p_branch_id uuid, p_month text)
returns table(membership_id uuid, full_name text, rotation_paused boolean, leads bigint, contacted bigint, onboarded bigint, quoted bigint, won bigint, lost bigint,
              conversion_pct numeric, median_response_min numeric, won_revenue bigint, membership_collected bigint, commission_piastres bigint,
              overdue_follow_ups bigint, open_flags bigint, target_won_revenue numeric)
language sql stable security definer set search_path = public as $$
  select m.id, p.full_name, m.rotation_paused,
         coalesce(r.leads, 0), coalesce(r.contacted, 0), coalesce(r.onboarded, 0), coalesce(r.quoted, 0), coalesce(r.won, 0), coalesce(r.lost, 0),
         coalesce(r.conversion_pct, 0), r.median_response_min, coalesce(r.won_revenue, 0), coalesce(r.membership_collected, 0), coalesce(r.commission_piastres, 0),
         (select count(*) from follow_ups f where f.assigned_to_membership_id = m.id and f.status = 'open' and f.due_at < now()),
         (select count(*) from follow_ups f where f.assigned_to_membership_id = m.id and f.status = 'open' and f.title like 'FLAG:%'),
         (select t.value from targets t where t.period = p_month and t.scope_type = 'membership' and t.scope_id = m.id and t.metric = 'won_revenue')
  from memberships m join profiles p on p.id = m.profile_id
  left join mv_rep_month r on r.membership_id = m.id and r.month = p_month
  where (is_top_management() or has_role('sales_manager', p_branch_id))
    and m.branch_id = p_branch_id and m.role = 'sales_rep' and m.is_active
  order by p.full_name
$$;

-- Leads by source and lost reason in a month: my leads (rep) or the branch (manager / top management).
create or replace function fn_lead_breakdown(p_branch_id uuid, p_month text)
returns table(dimension text, key text, n bigint)
language sql stable security definer set search_path = public as $$
  with scoped as (
    select l.* from leads l
    where l.branch_id = p_branch_id and to_char(l.created_at at time zone 'Africa/Cairo', 'YYYY-MM') = p_month
      and (is_top_management() or has_role('sales_manager', p_branch_id) or l.owner_membership_id in (select my_membership_ids()))
  )
  select 'source', coalesce((select code from lead_sources where id = s.source_id), 'other'), count(*) from scoped s group by 2
  union all
  select 'lost_reason', s.lost_reason::text, count(*) from scoped s where s.status = 'lost' group by 2
  order by 1, 3 desc
$$;

-- =====================================================================
-- 2. PUBLIC WIZARD RESUME (anon)
-- =====================================================================
-- What the token holder already entered, so a refresh resumes where they left off. Never returns other lead data.
create or replace function fn_onboarding_state(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l leads; b branches;
begin
  select * into l from leads where onboarding_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired'); end if;
  select * into b from branches where id = l.branch_id;
  if l.onboarding_token_expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired', 'branch_phone', b.phone, 'branch_name', b.name);
  end if;
  if l.status in ('won', 'lost') then return jsonb_build_object('ok', false, 'reason', 'closed', 'branch_phone', b.phone, 'branch_name', b.name); end if;
  return jsonb_build_object('ok', true, 'full_name', l.full_name, 'responses', l.onboarding_responses,
    'completed', l.onboarding_completed_at is not null, 'advisor', split_part(coalesce(fn_membership_name(l.owner_membership_id), ''), ' ', 1),
    'contact_by', l.first_contact_due_at, 'branch_name', b.name, 'branch_phone', b.phone,
    'heard_from', (select code from lead_sources where id = l.source_id), 'instagram_handle', l.instagram_handle);
end $$;

-- =====================================================================
-- 3. WRITES AS RPCs
-- =====================================================================
-- Log a call / WhatsApp / visit / note on a lead or a client. The first outbound touch on a lead sets first contact
-- and moves new → contacted (trigger tg_touch_first_contact).
create or replace function fn_log_touch(p_lead_id uuid, p_client_id uuid, p_type touch_type, p_direction touch_direction default 'outbound', p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_branch uuid;
begin
  if (p_lead_id is null) = (p_client_id is null) then raise exception 'a touch is on a lead or a client' using errcode = 'check_violation'; end if;
  if p_lead_id is not null then
    select branch_id into v_branch from leads where id = p_lead_id;
    if not (is_top_management() or p_lead_id in (select my_lead_ids()) or has_role('front_desk', v_branch)) then
      raise exception 'not allowed' using errcode = 'insufficient_privilege';
    end if;
    if (select status from leads where id = p_lead_id) in ('won', 'lost') and p_type <> 'note' then
      raise exception 'lead is closed' using errcode = 'check_violation';
    end if;
  else
    select home_branch_id into v_branch from clients where id = p_client_id;
    if not (is_top_management() or p_client_id in (select my_coach_client_ids()) or p_client_id in (select my_sales_client_ids())) then
      raise exception 'not allowed' using errcode = 'insufficient_privilege';
    end if;
  end if;
  insert into touches(lead_id, client_id, type, direction, note, by_profile_id)
  values (p_lead_id, p_client_id, p_type, coalesce(p_direction, 'outbound'), nullif(trim(p_note), ''), auth.uid()) returning id into v_id;
  perform fn_emit_event('touch.logged', case when p_lead_id is not null then 'leads' else 'clients' end, coalesce(p_lead_id, p_client_id), v_branch,
    jsonb_build_object('touch_id', v_id, 'type', p_type, 'direction', p_direction));
  return v_id;
end $$;

-- A follow-up task on a lead or client. Defaults to the lead's owner (or the caller's sales role in the branch).
create or replace function fn_add_follow_up(p_lead_id uuid, p_client_id uuid, p_title text, p_due_at timestamptz, p_assignee uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_branch uuid; v_assignee uuid;
begin
  if (p_lead_id is null) = (p_client_id is null) then raise exception 'a follow-up is on a lead or a client' using errcode = 'check_violation'; end if;
  if coalesce(trim(p_title), '') = '' or p_due_at is null then raise exception 'title and due date required' using errcode = 'check_violation'; end if;
  if p_lead_id is not null then
    select branch_id, owner_membership_id into v_branch, v_assignee from leads where id = p_lead_id;
    if not (is_top_management() or p_lead_id in (select my_lead_ids())) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  else
    select home_branch_id into v_branch from clients where id = p_client_id;
    if not (is_top_management() or p_client_id in (select my_coach_client_ids()) or p_client_id in (select my_sales_client_ids())) then
      raise exception 'not allowed' using errcode = 'insufficient_privilege';
    end if;
  end if;
  v_assignee := coalesce(p_assignee, v_assignee,
    (select id from memberships where profile_id = auth.uid() and is_active and branch_id = v_branch order by (role = 'sales_rep') desc, (role = 'sales_manager') desc limit 1));
  if v_assignee is null then raise exception 'no one to assign the follow-up to' using errcode = 'check_violation'; end if;
  if p_assignee is not null and not (is_top_management() or has_role('sales_manager', v_branch) or p_assignee in (select my_membership_ids())) then
    raise exception 'only the sales manager assigns follow-ups to others' using errcode = 'insufficient_privilege';
  end if;
  insert into follow_ups(lead_id, client_id, assigned_to_membership_id, title, due_at, created_by)
  values (p_lead_id, p_client_id, v_assignee, trim(p_title), p_due_at, auth.uid()) returning id into v_id;
  perform fn_emit_event('follow_up.created', 'follow_ups', v_id, v_branch, jsonb_build_object('lead_id', p_lead_id, 'client_id', p_client_id, 'assignee', v_assignee, 'due_at', p_due_at));
  return v_id;
end $$;

-- Done / skipped. The assignee, the branch sales manager (closes any flag), the client's coaching team, top management.
create or replace function fn_complete_follow_up(p_follow_up_id uuid, p_status follow_up_status default 'done') returns void
language plpgsql security definer set search_path = public as $$
declare f follow_ups; v_branch uuid;
begin
  if p_status = 'open' then raise exception 'use done or skipped' using errcode = 'check_violation'; end if;
  select * into f from follow_ups where id = p_follow_up_id for update;
  if not found then raise exception 'follow-up not found' using errcode = 'no_data_found'; end if;
  v_branch := coalesce((select branch_id from leads where id = f.lead_id), (select home_branch_id from clients where id = f.client_id));
  if not (is_top_management() or f.assigned_to_membership_id in (select my_membership_ids()) or has_role('sales_manager', v_branch)
          or (f.lead_id is not null and f.lead_id in (select my_lead_ids())) or (f.client_id is not null and f.client_id in (select my_coach_client_ids()))) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if f.status <> 'open' then return; end if;
  update follow_ups set status = p_status, completed_at = now() where id = p_follow_up_id;
  perform fn_emit_event('follow_up.completed', 'follow_ups', p_follow_up_id, v_branch,
    jsonb_build_object('status', p_status, 'lead_id', f.lead_id, 'client_id', f.client_id, 'flag', f.title like 'FLAG:%'));
end $$;

-- =====================================================================
-- 4. FUNCTION PRIVILEGES
-- =====================================================================
-- Stock Postgres grants EXECUTE on new functions to PUBLIC, and Supabase's defaults add anon, so functions created
-- after 0001's one-time revoke (all of 0002, and helpers) were callable anonymously. Reset: anon keeps only the wizard's
-- functions and phone normalisation. Every later migration must `revoke execute ... from public, anon` on the functions
-- it creates (0004 and this file do). Default privileges are left alone: the provided SQL tests create helper
-- functions after the migrations and call them as anon.
revoke execute on all functions in schema public from public, anon;
grant execute on function fn_submit_onboarding(text, text, jsonb, boolean), fn_onboarding_state(text), fn_normalize_phone(text) to anon;

revoke execute on function fn_can_see_lead(uuid), fn_is_sales_of_branch(uuid), fn_membership_name(uuid), fn_lead_stage_since(leads), fn_lead_sla_state(leads) from authenticated;
grant execute on function
  fn_sales_leads(uuid, lead_status, text, boolean), fn_sales_lead(uuid), fn_find_by_phone(text), fn_sales_today(uuid), fn_sales_queue(uuid),
  fn_sales_reps(uuid), fn_sales_team(uuid, text), fn_lead_breakdown(uuid, text),
  fn_log_touch(uuid, uuid, touch_type, touch_direction, text), fn_add_follow_up(uuid, uuid, text, timestamptz, uuid), fn_complete_follow_up(uuid, follow_up_status)
to authenticated;
