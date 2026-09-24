-- GymOS — 0004_m1_admin.sql (M1 Foundation)
-- 1. Realtime on notifications (the header bell subscribes to the user's own rows; RLS still applies).
-- 2. Admin writes as RPCs so every change is permission-checked in one place and emits an event
--    (CLAUDE.md rule 3; definition of done: writes only through RPC):
--      fn_update_setting, fn_save_membership, fn_create_staff_profile, fn_set_profile_active, fn_mark_notifications_read.
--    The tables stay RLS-protected as before; these functions are top-management only.

-- =====================================================================
-- 1. REALTIME
-- =====================================================================
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;

-- =====================================================================
-- 2. SETTINGS
-- =====================================================================
-- Updates one existing key. The new value must keep the JSON type of the current one (number stays number,
-- array stays array) so the fn_setting_* readers never break; commission.pt_tiers is validated in shape.
create or replace function fn_update_setting(p_key text, p_value jsonb) returns settings
language plpgsql security definer set search_path = public as $$
declare v_old settings; v_new settings; t jsonb; v_prev_up_to int; v_i int := 0; v_n int;
begin
  if not is_top_management() then raise exception 'only top management can change settings' using errcode = 'insufficient_privilege'; end if;
  select * into v_old from settings where key = p_key for update;
  if not found then raise exception 'unknown setting %', p_key using errcode = 'no_data_found'; end if;
  if p_value is null or jsonb_typeof(p_value) <> jsonb_typeof(v_old.value) then
    raise exception 'setting % must be a %', p_key, jsonb_typeof(v_old.value) using errcode = 'check_violation';
  end if;
  if p_key = 'commission.pt_tiers' then
    v_n := jsonb_array_length(p_value);
    if v_n = 0 then raise exception 'commission tiers cannot be empty' using errcode = 'check_violation'; end if;
    for t in select value from jsonb_array_elements(p_value) loop
      v_i := v_i + 1;
      if jsonb_typeof(t->'pct') <> 'number' or (t->>'pct')::numeric < 0 or (t->>'pct')::numeric > 100 then
        raise exception 'tier % needs a percentage between 0 and 100', v_i using errcode = 'check_violation';
      end if;
      if v_i < v_n then
        if jsonb_typeof(t->'up_to') <> 'number' or (t->>'up_to')::numeric <> floor((t->>'up_to')::numeric) or (t->>'up_to')::int <= coalesce(v_prev_up_to, 0) then
          raise exception 'tier % needs a whole "up to" number larger than the previous tier', v_i using errcode = 'check_violation';
        end if;
        v_prev_up_to := (t->>'up_to')::int;
      elsif t ? 'up_to' and jsonb_typeof(t->'up_to') <> 'null' then
        raise exception 'the last tier has no upper limit (up_to must be null)' using errcode = 'check_violation';
      end if;
    end loop;
  end if;
  update settings set value = p_value, updated_by = auth.uid(), updated_at = now() where key = p_key returning * into v_new;
  perform fn_emit_event('setting.updated', 'settings', null, null, jsonb_build_object('key', p_key, 'from', v_old.value, 'to', p_value));
  return v_new;
end $$;

-- =====================================================================
-- 3. PEOPLE
-- =====================================================================
-- Profile for a staff member whose auth user was just created by the invite (admin API).
create or replace function fn_create_staff_profile(p_profile_id uuid, p_full_name text, p_email text, p_phone text default null)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not is_top_management() then raise exception 'only top management can add staff' using errcode = 'insufficient_privilege'; end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'name required' using errcode = 'check_violation'; end if;
  if not exists (select 1 from auth.users u where u.id = p_profile_id) then raise exception 'auth user not found' using errcode = 'no_data_found'; end if;
  if p_phone is not null and exists (select 1 from profiles where phone = fn_normalize_phone(p_phone) and id <> p_profile_id) then
    raise exception 'phone already belongs to another person' using errcode = 'unique_violation';
  end if;
  insert into profiles(id, full_name, email, phone) values (p_profile_id, trim(p_full_name), lower(trim(p_email)), fn_normalize_phone(p_phone))
  on conflict (id) do update set full_name = excluded.full_name, email = excluded.email, phone = coalesce(excluded.phone, profiles.phone);
  perform fn_emit_event('staff.created', 'profiles', p_profile_id, null, jsonb_build_object('email', lower(trim(p_email))));
  return p_profile_id;
end $$;

-- Adds (p_membership_id null) or edits a staff membership. Clients get memberships through provisioning, not here.
-- A head coach membership also creates the coach membership (trigger tg_head_coach_needs_coach).
create or replace function fn_save_membership(
  p_membership_id uuid, p_profile_id uuid, p_role app_role, p_branch_id uuid,
  p_capacity int default null, p_specialties text[] default '{}', p_discount_allowance_pct numeric default 0, p_is_active boolean default true
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_old memberships;
begin
  if not is_top_management() then raise exception 'only top management can change roles' using errcode = 'insufficient_privilege'; end if;
  if p_role = 'client' then raise exception 'client memberships are created when a pack is sold' using errcode = 'check_violation'; end if;
  if p_role = 'top_management' and p_branch_id is not null then raise exception 'top management covers all branches; leave branch empty' using errcode = 'check_violation'; end if;
  if p_role <> 'top_management' and p_branch_id is null then raise exception 'pick a branch for this role' using errcode = 'check_violation'; end if;
  if p_capacity is not null and p_capacity < 0 then raise exception 'capacity cannot be negative' using errcode = 'check_violation'; end if;
  if coalesce(p_discount_allowance_pct, 0) < 0 or coalesce(p_discount_allowance_pct, 0) > 100 then raise exception 'discount allowance must be 0–100' using errcode = 'check_violation'; end if;
  if p_membership_id is not null and p_membership_id in (select my_membership_ids()) and not coalesce(p_is_active, true)
     and (select role from memberships where id = p_membership_id) = 'top_management' then
    raise exception 'you cannot deactivate your own top management role' using errcode = 'check_violation';
  end if;
  if exists (select 1 from memberships m where m.profile_id = p_profile_id and m.role = p_role and m.branch_id is not distinct from p_branch_id
             and m.id is distinct from p_membership_id) then
    raise exception 'this person already has that role in that branch' using errcode = 'unique_violation';
  end if;

  if p_membership_id is null then
    insert into memberships(profile_id, branch_id, role, capacity, specialties, discount_allowance_pct, is_active)
    values (p_profile_id, p_branch_id, p_role, p_capacity, coalesce(p_specialties, '{}'), coalesce(p_discount_allowance_pct, 0), coalesce(p_is_active, true))
    returning id into v_id;
  else
    select * into v_old from memberships where id = p_membership_id for update;
    if not found then raise exception 'membership not found' using errcode = 'no_data_found'; end if;
    if v_old.role = 'client' then raise exception 'client memberships are not edited here' using errcode = 'check_violation'; end if;
    update memberships set role = p_role, branch_id = p_branch_id, capacity = p_capacity, specialties = coalesce(p_specialties, '{}'),
                           discount_allowance_pct = coalesce(p_discount_allowance_pct, 0), is_active = coalesce(p_is_active, true)
     where id = p_membership_id returning id into v_id;
  end if;
  perform fn_emit_event('membership.saved', 'memberships', v_id, p_branch_id,
    jsonb_build_object('profile_id', p_profile_id, 'role', p_role, 'is_active', coalesce(p_is_active, true), 'created', p_membership_id is null));
  return v_id;
end $$;

-- Deactivates (or reactivates) a person: the profile and every staff membership. History is kept.
create or replace function fn_set_profile_active(p_profile_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_top_management() then raise exception 'only top management can deactivate people' using errcode = 'insufficient_privilege'; end if;
  if p_profile_id = auth.uid() and not p_active then raise exception 'you cannot deactivate yourself' using errcode = 'check_violation'; end if;
  update profiles set is_active = p_active where id = p_profile_id;
  if not found then raise exception 'person not found' using errcode = 'no_data_found'; end if;
  update memberships set is_active = p_active where profile_id = p_profile_id and role <> 'client';
  perform fn_emit_event('profile.activation_changed', 'profiles', p_profile_id, null, jsonb_build_object('active', p_active));
end $$;

-- =====================================================================
-- 4. NOTIFICATIONS — mark own rows read (all, or the given ids). Delivery status of other channels is untouched.
-- =====================================================================
create or replace function fn_mark_notifications_read(p_ids uuid[] default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = 'insufficient_privilege'; end if;
  update notifications set read_at = now(), status = case when channel = 'in_app' then 'read'::notification_status else status end
   where read_at is null
     and (recipient_profile_id = auth.uid() or (recipient_profile_id is null and client_id = my_client_id()))
     and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function fn_update_setting(text, jsonb), fn_create_staff_profile(uuid, text, text, text),
  fn_save_membership(uuid, uuid, app_role, uuid, int, text[], numeric, boolean), fn_set_profile_active(uuid, boolean), fn_mark_notifications_read(uuid[]) from public, anon;
grant execute on function fn_update_setting(text, jsonb), fn_create_staff_profile(uuid, text, text, text),
  fn_save_membership(uuid, uuid, app_role, uuid, int, text[], numeric, boolean), fn_set_profile_active(uuid, boolean), fn_mark_notifications_read(uuid[]) to authenticated;
