-- GymOS — 0015_plain_lead_wording.sql
-- Plain language for the first-contact deadline (owner request, 2026-10-01): staff saw "SLA breached" and
-- "Contact within SLA" and didn't know the term. Only the notification text changes; the rule, the setting
-- (sales.first_contact_sla_hours), the notification types and every grant stay as they were.
--   lead.sla_breach:  "SLA breached: <name>"  ->  "Contact overdue: <name>" / "Nobody has contacted this lead yet"
--   lead.assigned:    "Contact within SLA"    ->  "Contact them within <N> hours" (N from the setting)
-- Existing rows are reworded too, so the notification lists read the same before and after.

create or replace function fn_assign_lead(p_lead_id uuid, p_membership_id uuid default null, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_lead leads; v_new uuid; v_old uuid; v_new_profile uuid; v_old_profile uuid;
begin
  select * into v_lead from leads where id = p_lead_id for update;
  if not found then raise exception 'lead not found'; end if;
  -- callers: sales manager of the branch, top management, or internal (auth.uid() null in jobs)
  if auth.uid() is not null and not (is_top_management() or has_role('sales_manager', v_lead.branch_id)) then
    raise exception 'only the sales manager can assign leads' using errcode = 'insufficient_privilege';
  end if;
  v_old := v_lead.owner_membership_id;
  if v_old is not null and p_reason is null then
    raise exception 'reassignment requires a reason' using errcode = 'check_violation';
  end if;
  if p_membership_id is null and not fn_setting_bool('leads.round_robin_enabled', true) then raise exception 'round robin is disabled; pick a rep' using errcode = 'check_violation'; end if;
  v_new := coalesce(p_membership_id, fn_round_robin_next(v_lead.branch_id));
  update leads set owner_membership_id = v_new where id = p_lead_id;
  select profile_id into v_new_profile from memberships where id = v_new;
  perform fn_notify(v_new_profile, 'lead.assigned', 'New lead: ' || v_lead.full_name, coalesce(p_reason, 'Contact them within ' || fn_setting_int('sales.first_contact_sla_hours', 2) || ' hours'), jsonb_build_object('lead_id', p_lead_id));
  if v_old is not null and v_old <> v_new then
    select profile_id into v_old_profile from memberships where id = v_old;
    perform fn_notify(v_old_profile, 'lead.reassigned', 'Lead reassigned: ' || v_lead.full_name, p_reason, jsonb_build_object('lead_id', p_lead_id));
  end if;
  perform fn_emit_event('lead.assigned', 'leads', p_lead_id, v_lead.branch_id, jsonb_build_object('from', v_old, 'to', v_new, 'reason', p_reason));
  return v_new;
end $$;

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
    perform fn_notify(r.profile_id, 'lead.sla_breach', 'Contact overdue: ' || r.full_name, 'Nobody has contacted this lead yet', jsonb_build_object('lead_id', r.id));
    perform fn_notify_role('sales_manager', r.branch_id, 'lead.sla_breach', 'Contact overdue: ' || r.full_name, 'Nobody has contacted this lead yet', jsonb_build_object('lead_id', r.id));
    n := n + 1;
  end loop;
  n := n + fn_queue_digests();
  return n;
end $$;

update notifications
   set title = 'Contact overdue: ' || substr(title, length('SLA breached: ') + 1),
       body = 'Nobody has contacted this lead yet'
 where type = 'lead.sla_breach' and title like 'SLA breached: %';

update notifications
   set body = 'Contact them within ' || fn_setting_int('sales.first_contact_sla_hours', 2) || ' hours'
 where type = 'lead.assigned' and body = 'Contact within SLA';
