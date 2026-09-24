-- GymOS — 0008_money.sql (M3 Money)
-- Deals, approvals, payments, expiry extension, catalog, money admin. Business rules stay in 0001
-- (fn_price_deal, fn_submit_deal, fn_decide_approval, fn_record_payment, fn_extend_expiry); this file adds:
--  1. read shapes (SECURITY DEFINER, scoped like the RLS policies): fn_deal_catalog, fn_branch_coaches, fn_deal,
--     fn_sales_deals, fn_sales_approvals, fn_sales_client, fn_money_summary
--  2. writes as RPCs (definition of done): fn_create_deal, fn_save_deal_draft (totals only via fn_price_deal),
--     fn_request_payment_void, fn_save_product, fn_save_bundle_items
--  3. fn_deal_approval_preview: the same approval test as fn_submit_deal, for the builder's live indicator
--  4. mv_liability joins the 5-minute refresh (the money screen shows it)

-- =====================================================================
-- helpers
-- =====================================================================
-- Same predicate as the deals_read policy.
create or replace function fn_can_see_deal(p_deal_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from deals d where d.id = p_deal_id and (
    is_top_management() or has_role('sales_manager', d.branch_id) or has_role('front_desk', d.branch_id) or has_role('head_coach', d.branch_id)
    or d.rep_membership_id in (select my_membership_ids()) or d.closer_membership_id in (select my_membership_ids())
    or d.client_id in (select my_coach_client_ids()) or d.client_id = my_client_id()))
$$;

-- Same predicate as the deals_update_draft policy (who may build a draft).
create or replace function fn_can_edit_deal(p_deal deals) returns boolean
language sql stable security definer set search_path = public as $$
  select p_deal.status = 'draft' and (is_top_management() or has_role('sales_manager', p_deal.branch_id)
    or p_deal.rep_membership_id in (select my_membership_ids()) or p_deal.closer_membership_id in (select my_membership_ids()))
$$;

-- Who may record a payment (same test as fn_record_payment).
create or replace function fn_can_pay_deal(p_deal deals) returns boolean
language sql stable security definer set search_path = public as $$
  select is_top_management() or has_role('sales_manager', p_deal.branch_id) or has_role('front_desk', p_deal.branch_id)
    or p_deal.rep_membership_id in (select my_membership_ids()) or p_deal.closer_membership_id in (select my_membership_ids())
$$;

-- Would submitting this deal (as the caller) need approval, and why. Mirrors fn_submit_deal exactly.
create or replace function fn_deal_approval_preview(p_deal_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d deals; v_allow numeric; v_eff numeric; v_boss boolean; v_reasons text[] := '{}';
begin
  select * into d from deals where id = p_deal_id;
  v_boss := is_top_management() or has_role('sales_manager', d.branch_id);
  select coalesce(max(discount_allowance_pct), 0) into v_allow from memberships where id in (select my_membership_ids());
  v_eff := case when d.subtotal_piastres > 0 then d.discount_piastres * 100.0 / d.subtotal_piastres else 0 end;
  if d.total_piastres <= 0 and d.subtotal_piastres > 0 then v_reasons := array_append(v_reasons, 'zero_total'); end if;
  if not fn_setting_bool('deals.auto_approve_list_price', true) and not v_boss then v_reasons := array_append(v_reasons, 'manual_approval'); end if;
  if v_eff > v_allow and not v_boss then v_reasons := array_append(v_reasons, 'discount_over_allowance'); end if;
  if d.payment_plan = 'installments' and fn_setting_bool('deals.installments_need_approval', true) and not v_boss then v_reasons := array_append(v_reasons, 'installments'); end if;
  if d.payment_plan = 'installments' and not fn_setting_bool('payments.installments_enabled', true) then v_reasons := array_append(v_reasons, 'installments_disabled'); end if;
  return jsonb_build_object('needs_approval', cardinality(v_reasons) > 0, 'reasons', to_jsonb(v_reasons),
    'allowance_pct', case when v_boss then 100 else v_allow end, 'effective_pct', round(v_eff, 1));
end $$;

-- =====================================================================
-- 1. READ SHAPES
-- =====================================================================
-- The catalog a deal in this branch can use: active products for the branch or all branches; a branch-specific
-- row overrides the all-branches row with the same code. Bundles are left out (see docs/06: bundle expansion is not
-- implemented by fn_record_payment yet). Per-session values are computed here, never in the client.
create or replace function fn_deal_catalog(p_branch_id uuid)
returns table(id uuid, code text, name text, type product_type, branch_id uuid, price_piastres bigint, duration_days int, session_count int,
              expiry_days int, per_session_piastres bigint, net_per_session_piastres bigint, sort_order int)
language sql stable security definer set search_path = public as $$
  select * from (
    select distinct on (p.code) p.id, p.code, p.name, p.type, p.branch_id, p.price_piastres, p.duration_days, p.session_count, p.expiry_days,
           p.per_session_value_piastres, round(p.per_session_value_piastres * (100 - fn_setting_num('commission.tax_pct', 14)) / 100.0)::bigint, p.sort_order
    from products p
    where is_staff() and p.is_active and p.type <> 'bundle' and (p.branch_id is null or p.branch_id = p_branch_id)
    order by p.code, p.branch_id nulls last
  ) c order by c.sort_order, c.name
$$;

-- Every active coach of a branch (the picker's "all coaches" list after fn_rank_coaches' suggestions).
create or replace function fn_branch_coaches(p_branch_id uuid)
returns table(membership_id uuid, full_name text, gender text, capacity int, active_clients int, specialties text[])
language sql stable security definer set search_path = public as $$
  select m.id, p.full_name, p.gender, coalesce(m.capacity, 20),
         (select count(*) from clients c where c.coach_membership_id = m.id and c.status in ('active', 'frozen'))::int, m.specialties
  from memberships m join profiles p on p.id = m.profile_id
  where is_staff() and p_branch_id in (select my_branch_ids()) and m.branch_id = p_branch_id and m.role = 'coach' and m.is_active
  order by p.full_name
$$;

-- Everything the deal screen shows, in one call.
create or replace function fn_deal(p_deal_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d deals; v_tax numeric := fn_setting_num('commission.tax_pct', 14);
begin
  select * into d from deals where id = p_deal_id;
  if not found or not fn_can_see_deal(p_deal_id) then raise exception 'deal not found' using errcode = 'no_data_found'; end if;
  return jsonb_build_object(
    'id', d.id, 'branch_id', d.branch_id, 'branch_name', (select name from branches where id = d.branch_id), 'status', d.status,
    'lead', (select jsonb_build_object('id', l.id, 'full_name', l.full_name, 'phone', l.phone, 'status', l.status) from leads l where l.id = d.lead_id),
    'client', (select jsonb_build_object('id', c.id, 'full_name', c.full_name, 'phone', c.phone, 'provisioned', c.profile_id is not null,
                 'coach_name', fn_membership_name(c.coach_membership_id)) from clients c where c.id = d.client_id),
    'rep_name', fn_membership_name(d.rep_membership_id), 'closer_name', fn_membership_name(d.closer_membership_id), 'is_renewal', d.is_renewal,
    'subtotal_piastres', d.subtotal_piastres, 'discount_pct', d.discount_pct, 'discount_fixed_piastres', d.discount_fixed_piastres,
    'discount_piastres', d.discount_piastres, 'total_piastres', d.total_piastres, 'paid_piastres', d.paid_piastres,
    'remaining_piastres', greatest(0, d.total_piastres - d.paid_piastres),
    'min_first_payment_piastres', case when d.paid_piastres = 0 then ceil(d.total_piastres * fn_setting_num('payments.min_first_payment_pct', 30) / 100.0)::bigint end,
    'payment_plan', d.payment_plan, 'installments_count', d.installments_count, 'notes', d.notes,
    'created_at', d.created_at, 'approved_at', d.approved_at, 'first_paid_at', d.first_paid_at, 'paid_at', d.paid_at, 'tax_pct', v_tax,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'product_id', i.product_id, 'product_name', p.name, 'product_type', coalesce(i.product_type, p.type), 'qty', i.qty,
        'unit_price_piastres', i.unit_price_piastres, 'line_total_piastres', i.line_total_piastres,
        'session_count', coalesce(i.session_count, p.session_count), 'duration_days', coalesce(i.duration_days, p.duration_days),
        'expiry_days', coalesce(i.expiry_days, p.expiry_days), 'provider_membership_id', i.provider_membership_id,
        'provider_name', fn_membership_name(i.provider_membership_id), 'credits_issued', i.credits_issued,
        'per_session_piastres', case when i.product_type = 'pt_pack' and i.session_count > 0 then round(i.line_total_piastres::numeric / (i.session_count * i.qty))::bigint end,
        'net_per_session_piastres', case when i.product_type = 'pt_pack' and i.session_count > 0 then round(i.line_total_piastres::numeric / (i.session_count * i.qty) * (100 - v_tax) / 100.0)::bigint end
      ) order by i.created_at) from deal_items i join products p on p.id = i.product_id where i.deal_id = d.id), '[]'),
    'issues', coalesce((select jsonb_agg(distinct 'pt_needs_coach'::text) from deal_items i join products p on p.id = i.product_id
                         where i.deal_id = d.id and p.type = 'pt_pack' and i.provider_membership_id is null), '[]'),
    'approval', (select jsonb_build_object('id', a.id, 'type', a.type, 'status', a.status, 'reason', a.reason, 'requested_at', a.requested_at,
                   'requested_by', (select full_name from profiles where id = a.requested_by), 'decided_by', (select full_name from profiles where id = a.decided_by),
                   'decided_at', a.decided_at, 'decision_note', a.decision_note, 'payload', a.payload)
                 from approvals a where a.subject_table = 'deals' and a.subject_id = d.id order by a.requested_at desc limit 1),
    'approval_preview', case when d.status = 'draft' then fn_deal_approval_preview(d.id) end,
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'amount_piastres', x.amount_piastres, 'method', x.method, 'reference', x.reference,
                   'received_at', x.received_at, 'recorded_by', (select full_name from profiles where id = x.recorded_by), 'voided_at', x.voided_at, 'void_reason', x.void_reason,
                   'void_pending', exists (select 1 from approvals a where a.subject_table = 'payments' and a.subject_id = x.id and a.status = 'pending'))
                 order by x.received_at) from payments x where x.deal_id = d.id), '[]'),
    'timeline', coalesce((select jsonb_agg(jsonb_build_object('type', e.type, 'occurred_at', e.occurred_at,
                   'actor', (select full_name from profiles where id = e.actor_profile_id), 'payload', e.payload) order by e.occurred_at, e.id)
                 from events e
                 where (e.subject_table = 'deals' and e.subject_id = d.id)
                    or (e.subject_table = 'payments' and e.subject_id in (select id from payments where deal_id = d.id))
                    or (e.subject_table = 'approvals' and e.subject_id in (select id from approvals where (subject_table = 'deals' and subject_id = d.id)
                          or (subject_table = 'payments' and subject_id in (select id from payments where deal_id = d.id))))), '[]'),
    'can_edit', fn_can_edit_deal(d),
    'can_pay', d.status in ('approved', 'partially_paid') and fn_can_pay_deal(d),
    'can_cancel', d.status in ('draft', 'pending_approval', 'approved') and (is_top_management() or has_role('sales_manager', d.branch_id) or d.rep_membership_id in (select my_membership_ids())),
    'can_request_void', fn_can_pay_deal(d)
  );
end $$;

create or replace function fn_sales_deals(p_branch_id uuid, p_status deal_status default null, p_search text default null)
returns table(id uuid, status deal_status, name text, phone text, lead_id uuid, client_id uuid, total_piastres bigint, paid_piastres bigint,
              rep_name text, is_renewal boolean, created_at timestamptz, first_paid_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.id, d.status, coalesce(c.full_name, l.full_name), coalesce(c.phone, l.phone), d.lead_id, d.client_id, d.total_piastres, d.paid_piastres,
         fn_membership_name(d.rep_membership_id), d.is_renewal, d.created_at, d.first_paid_at
  from deals d left join leads l on l.id = d.lead_id left join clients c on c.id = d.client_id
  where d.branch_id = p_branch_id and fn_can_see_deal(d.id)
    and (p_status is null or d.status = p_status)
    and (coalesce(trim(p_search), '') = '' or coalesce(c.full_name, l.full_name) ilike '%' || trim(p_search) || '%')
  order by d.created_at desc
  limit 300
$$;

-- Pending approvals for the sales manager (attendance edits are the head coach's), with what each one is about.
create or replace function fn_sales_approvals(p_branch_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_top_management() or has_role('sales_manager', p_branch_id)) then raise exception 'only the sales manager' using errcode = 'insufficient_privilege'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'type', a.type, 'reason', a.reason, 'requested_at', a.requested_at, 'payload', a.payload,
      'requested_by', (select full_name from profiles where id = a.requested_by), 'subject_table', a.subject_table, 'subject_id', a.subject_id,
      'deal', case when a.subject_table = 'deals' then (select jsonb_build_object('id', d.id, 'name', coalesce(c.full_name, l.full_name), 'total_piastres', d.total_piastres,
                  'subtotal_piastres', d.subtotal_piastres, 'discount_piastres', d.discount_piastres, 'payment_plan', d.payment_plan, 'installments_count', d.installments_count)
                  from deals d left join leads l on l.id = d.lead_id left join clients c on c.id = d.client_id where d.id = a.subject_id) end,
      'payment', case when a.subject_table = 'payments' then (select jsonb_build_object('id', x.id, 'deal_id', x.deal_id, 'amount_piastres', x.amount_piastres, 'method', x.method,
                  'received_at', x.received_at, 'name', coalesce(c.full_name, l.full_name))
                  from payments x join deals d on d.id = x.deal_id left join leads l on l.id = d.lead_id left join clients c on c.id = d.client_id where x.id = a.subject_id) end,
      'lot', case when a.subject_table = 'credit_lots' then (select jsonb_build_object('id', cl.id, 'client_id', cl.client_id, 'name', c.full_name, 'qty_remaining', cl.qty_remaining,
                  'coach_name', fn_membership_name(cl.coach_membership_id), 'expires_at', cl.expires_at, 'status', cl.status)
                  from credit_lots cl join clients c on c.id = cl.client_id where cl.id = a.subject_id) end,
      'freeze', case when a.subject_table = 'freezes' then (select jsonb_build_object('id', f.id, 'name', c.full_name, 'days', f.days, 'starts_at', f.starts_at, 'ends_at', f.ends_at)
                  from freezes f join clients c on c.id = f.client_id where f.id = a.subject_id) end,
      'lead', case when a.subject_table = 'leads' then (select jsonb_build_object('id', l.id, 'name', l.full_name, 'to', fn_membership_name((a.payload->>'to_membership_id')::uuid))
                  from leads l where l.id = a.subject_id) end
    ) order by a.requested_at)
    from approvals a
    where a.status = 'pending' and a.type <> 'attendance_edit' and (a.branch_id = p_branch_id or (a.branch_id is null and is_top_management()))
  ), '[]');
end $$;

-- A client as the sales team sees it: packs (lots) with expiry, memberships, deals. Extension happens here.
create or replace function fn_sales_client(p_client_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c clients;
begin
  select * into c from clients where id = p_client_id;
  if not found or not (is_top_management() or p_client_id in (select my_sales_client_ids()) or p_client_id in (select my_coach_client_ids()) or has_role('front_desk', c.home_branch_id)) then
    raise exception 'client not found' using errcode = 'no_data_found';
  end if;
  return jsonb_build_object(
    'id', c.id, 'full_name', c.full_name, 'phone', c.phone, 'status', c.status, 'branch_id', c.home_branch_id,
    'branch_name', (select name from branches where id = c.home_branch_id), 'joined_at', c.joined_at,
    'rep_name', fn_membership_name(c.rep_membership_id), 'coach_name', fn_membership_name(c.coach_membership_id), 'provisioned', c.profile_id is not null,
    'lead_id', c.lead_id,
    'balances', coalesce((select jsonb_agg(to_jsonb(b)) from fn_credit_balances(c.id) b), '[]'),
    'lots', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'coach_name', fn_membership_name(l.coach_membership_id), 'qty_issued', l.qty_issued,
               'qty_remaining', l.qty_remaining, 'per_session_piastres', l.per_session_value_piastres, 'issued_at', l.issued_at, 'expires_at', l.expires_at, 'status', l.status,
               'expired_qty', case when l.status = 'expired' then (select -x.qty from credit_ledger x where x.lot_id = l.id and x.entry_type = 'expire' order by x.created_at desc limit 1) end,
               'pending_extension', (select jsonb_build_object('id', a.id, 'new_expires_at', a.payload->>'new_expires_at', 'requested_by', (select full_name from profiles where id = a.requested_by))
                                     from approvals a where a.subject_table = 'credit_lots' and a.subject_id = l.id and a.type = 'expiry_extension' and a.status = 'pending' limit 1))
             order by l.expires_at desc) from credit_lots l where l.client_id = c.id), '[]'),
    'entitlements', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'type', e.type, 'product_name', p.name, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'status', e.status)
             order by e.ends_at desc) from entitlements e left join products p on p.id = e.product_id where e.client_id = c.id), '[]'),
    'deals', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'status', d.status, 'total_piastres', d.total_piastres, 'paid_piastres', d.paid_piastres, 'created_at', d.created_at)
             order by d.created_at desc) from deals d where d.client_id = c.id and fn_can_see_deal(d.id)), '[]'),
    'can_extend', is_top_management() or has_role('sales_manager', c.home_branch_id),
    'can_request_extension', c.rep_membership_id in (select my_membership_ids()) or has_role('sales_rep', c.home_branch_id)
  );
end $$;

-- Month close for top management: booked, collected (by method and by item type, pro-rata), voided, unpaid sessions,
-- recent deals and payments. Liability and commissions come from fn_commission_report (below).
create or replace function fn_money_summary(p_month text, p_branch_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_top_management() then raise exception 'top management only' using errcode = 'insufficient_privilege'; end if;
  return jsonb_build_object(
    'booked_piastres', (select coalesce(sum(total_piastres), 0) from deals where status in ('partially_paid', 'paid') and to_char(first_paid_at at time zone 'Africa/Cairo', 'YYYY-MM') = p_month and (p_branch_id is null or branch_id = p_branch_id)),
    'collected_piastres', (select coalesce(sum(x.amount_piastres), 0) from payments x join deals d on d.id = x.deal_id where x.voided_at is null and to_char(x.received_at at time zone 'Africa/Cairo', 'YYYY-MM') = p_month and (p_branch_id is null or d.branch_id = p_branch_id)),
    'voided_piastres', (select coalesce(sum(x.amount_piastres), 0) from payments x join deals d on d.id = x.deal_id where x.voided_at is not null and to_char(x.voided_at at time zone 'Africa/Cairo', 'YYYY-MM') = p_month and (p_branch_id is null or d.branch_id = p_branch_id)),
    'by_method', coalesce((select jsonb_object_agg(method, amt) from (select x.method, sum(x.amount_piastres) amt from payments x join deals d on d.id = x.deal_id
                  where x.voided_at is null and to_char(x.received_at at time zone 'Africa/Cairo', 'YYYY-MM') = p_month and (p_branch_id is null or d.branch_id = p_branch_id) group by 1) m), '{}'),
    'by_type', coalesce((select jsonb_object_agg(product_type, round(amt)::bigint) from (
                  select i.product_type, sum(x.amount_piastres * i.line_total_piastres::numeric / nullif(t.total, 0)) amt
                  from payments x join deals d on d.id = x.deal_id
                  join deal_items i on i.deal_id = d.id
                  join (select deal_id, sum(line_total_piastres) total from deal_items group by 1) t on t.deal_id = d.id
                  where x.voided_at is null and to_char(x.received_at at time zone 'Africa/Cairo', 'YYYY-MM') = p_month and (p_branch_id is null or d.branch_id = p_branch_id)
                  group by 1) m), '{}'),
    'unpaid_sessions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'client_name', c.full_name, 'coach_name', fn_membership_name(s.coach_membership_id),
                  'scheduled_at', s.scheduled_at, 'branch_id', s.branch_id) order by s.scheduled_at)
                  from sessions s join clients c on c.id = s.client_id where s.unpaid and (p_branch_id is null or s.branch_id = p_branch_id)), '[]'),
    'deals', coalesce((select jsonb_agg(to_jsonb(x)) from (select d.id, d.status, coalesce(c.full_name, l.full_name) as name, d.total_piastres, d.paid_piastres,
                  fn_membership_name(d.rep_membership_id) as rep_name, d.created_at, d.branch_id
                  from deals d left join leads l on l.id = d.lead_id left join clients c on c.id = d.client_id
                  where p_branch_id is null or d.branch_id = p_branch_id order by d.created_at desc limit 50) x), '[]'),
    'payments', coalesce((select jsonb_agg(to_jsonb(x)) from (select p.id, p.deal_id, coalesce(c.full_name, l.full_name) as name, p.amount_piastres, p.method, p.received_at, p.voided_at,
                  (select full_name from profiles where id = p.recorded_by) as recorded_by
                  from payments p join deals d on d.id = p.deal_id left join leads l on l.id = d.lead_id left join clients c on c.id = d.client_id
                  where p_branch_id is null or d.branch_id = p_branch_id order by p.received_at desc limit 50) x), '[]')
  );
end $$;

-- Commission report for payroll (top management): coaches from mv_coach_month (net delivered × tier), reps from
-- mv_rep_month (membership collected × rate). Per-session gross/net are computed here so the screen shows, not derives.
create or replace function fn_commission_report(p_month text, p_branch_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_top_management() then raise exception 'top management only' using errcode = 'insufficient_privilege'; end if;
  return jsonb_build_object(
    'tax_pct', fn_setting_num('commission.tax_pct', 14),
    'membership_pct', fn_setting_num('commission.sales_membership_pct', 0),
    'nutrition_pct', fn_setting_num('commission.sales_nutrition_pct', 0),
    'tiers', fn_setting('commission.pt_tiers'),
    'coaches', coalesce((select jsonb_agg(jsonb_build_object('membership_id', c.membership_id, 'full_name', c.full_name, 'branch_id', c.branch_id,
        'sessions_burned', c.credits_burned, 'delivered_piastres', c.revenue_delivered, 'delivered_net_piastres', c.revenue_delivered_net,
        'per_session_piastres', case when c.credits_burned > 0 then round(c.revenue_delivered::numeric / c.credits_burned)::bigint end,
        'net_per_session_piastres', case when c.credits_burned > 0 then round(c.revenue_delivered_net::numeric / c.credits_burned)::bigint end,
        'commission_pct', c.commission_pct, 'commission_piastres', c.commission_piastres, 'unpaid_sessions', c.unpaid_sessions) order by c.full_name)
      from mv_coach_month c where c.month = p_month and (p_branch_id is null or c.branch_id = p_branch_id)), '[]'),
    'reps', coalesce((select jsonb_agg(jsonb_build_object('membership_id', r.membership_id, 'full_name', r.full_name, 'branch_id', r.branch_id,
        'won_revenue_piastres', r.won_revenue, 'membership_collected_piastres', r.membership_collected, 'nutrition_collected_piastres', r.nutrition_collected,
        'pt_collected_piastres', r.pt_collected, 'commission_piastres', r.commission_piastres) order by r.full_name)
      from mv_rep_month r where r.month = p_month and (p_branch_id is null or r.branch_id = p_branch_id)), '[]'),
    'liability', coalesce((select jsonb_agg(jsonb_build_object('coach_membership_id', l.coach_membership_id, 'coach_name', fn_membership_name(l.coach_membership_id),
        'branch_id', l.branch_id, 'clients', l.clients, 'credits_remaining', l.credits_remaining, 'liability_piastres', l.liability_piastres,
        'credits_expiring_30d', l.credits_expiring_30d) order by l.liability_piastres desc)
      from mv_liability l where p_branch_id is null or l.branch_id = p_branch_id), '[]'),
    'liability_total_piastres', (select coalesce(sum(liability_piastres), 0) from mv_liability where p_branch_id is null or branch_id = p_branch_id)
  );
end $$;

-- =====================================================================
-- 2. WRITES
-- =====================================================================
-- A draft deal for a lead (first sale) or a client (renewal). Returns the open draft if one already exists.
create or replace function fn_create_deal(p_lead_id uuid default null, p_client_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare l leads; c clients; v_branch uuid; v_rep uuid; v_closer uuid; v_id uuid;
begin
  if (p_lead_id is null) = (p_client_id is null) then raise exception 'a deal is for a lead or a client' using errcode = 'check_violation'; end if;
  if p_lead_id is not null then
    select * into l from leads where id = p_lead_id;
    if not found or not (is_top_management() or has_role('sales_manager', l.branch_id) or l.owner_membership_id in (select my_membership_ids())) then
      raise exception 'not allowed' using errcode = 'insufficient_privilege';
    end if;
    if l.status in ('won', 'lost') then raise exception 'lead is closed' using errcode = 'check_violation'; end if;
    select id into v_id from deals where lead_id = p_lead_id and status = 'draft' order by created_at desc limit 1;
    if v_id is not null then return v_id; end if;
    v_branch := l.branch_id;
    v_rep := coalesce(l.owner_membership_id, (select id from memberships where profile_id = auth.uid() and is_active and branch_id = v_branch and role = 'sales_rep' limit 1));
  else
    select * into c from clients where id = p_client_id;
    if not found or not (is_top_management() or p_client_id in (select my_sales_client_ids()) or p_client_id in (select my_coach_client_ids())) then
      raise exception 'not allowed' using errcode = 'insufficient_privilege';
    end if;
    select id into v_id from deals where client_id = p_client_id and status = 'draft' order by created_at desc limit 1;
    if v_id is not null then return v_id; end if;
    v_branch := c.home_branch_id;
    v_rep := c.rep_membership_id;
  end if;
  v_closer := (select id from memberships where profile_id = auth.uid() and is_active and branch_id = v_branch
                 and role in ('sales_rep', 'sales_manager', 'coach', 'head_coach') order by role = 'sales_rep' desc, role = 'sales_manager' desc limit 1);
  insert into deals(branch_id, lead_id, client_id, rep_membership_id, closer_membership_id, is_renewal, created_by)
  values (v_branch, p_lead_id, p_client_id, v_rep, v_closer, p_client_id is not null, auth.uid()) returning id into v_id;
  perform fn_emit_event('deal.created', 'deals', v_id, v_branch, jsonb_build_object('lead_id', p_lead_id, 'client_id', p_client_id, 'renewal', p_client_id is not null));
  return v_id;
end $$;

-- Replaces a draft's items and terms, then prices it with fn_price_deal (the only place totals are computed).
-- While a PT pack has no coach yet, fn_price_deal refuses; the draft is still saved and 'issues' says what's missing.
create or replace function fn_save_deal_draft(p_deal_id uuid, p_items jsonb, p_discount_pct numeric default 0, p_discount_fixed_piastres bigint default 0,
  p_payment_plan payment_plan default 'single', p_installments_count int default 1, p_notes text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d deals; it jsonb; p products; v_provider uuid; v_qty int;
begin
  select * into d from deals where id = p_deal_id for update;
  if not found or not fn_can_edit_deal(d) then raise exception 'only a draft you own can be edited' using errcode = 'insufficient_privilege'; end if;
  if coalesce(p_discount_pct, 0) < 0 or coalesce(p_discount_pct, 0) > 100 or coalesce(p_discount_fixed_piastres, 0) < 0 then
    raise exception 'discount out of range' using errcode = 'check_violation';
  end if;
  delete from deal_items where deal_id = p_deal_id;
  for it in select value from jsonb_array_elements(coalesce(p_items, '[]')) loop
    select * into p from products where id = (it->>'product_id')::uuid;
    if not found or not p.is_active or p.type = 'bundle' or not (p.branch_id is null or p.branch_id = d.branch_id) then
      raise exception 'product not available in this branch' using errcode = 'check_violation';
    end if;
    v_qty := coalesce((it->>'qty')::int, 1);
    if v_qty < 1 or v_qty > 20 then raise exception 'quantity must be 1–20' using errcode = 'check_violation'; end if;
    v_provider := nullif(it->>'provider_membership_id', '')::uuid;
    if v_provider is not null and not exists (select 1 from memberships m where m.id = v_provider and m.is_active and m.branch_id = d.branch_id
         and m.role = any(case when p.type = 'pt_pack' then array['coach']::app_role[] else array['coach', 'nutritionist']::app_role[] end)) then
      raise exception 'provider must be an active coach of this branch' using errcode = 'check_violation';
    end if;
    insert into deal_items(deal_id, product_id, qty, provider_membership_id, product_type) values (p_deal_id, p.id, v_qty, case when p.type in ('pt_pack', 'nutrition') then v_provider end, p.type);
  end loop;
  update deals set discount_pct = coalesce(p_discount_pct, 0), discount_fixed_piastres = coalesce(p_discount_fixed_piastres, 0),
                   payment_plan = coalesce(p_payment_plan, 'single'), installments_count = case when p_payment_plan = 'installments' then greatest(2, coalesce(p_installments_count, 2)) else 1 end,
                   notes = nullif(trim(p_notes), '')
   where id = p_deal_id;
  begin
    perform fn_price_deal(p_deal_id);
  exception when check_violation then
    null; -- a PT pack without a coach (or a bad nutrition provider): saved, not priced; fn_deal reports the issue
  end;
  return fn_deal(p_deal_id);
end $$;

-- Rep, sales manager or front desk asks to void a payment; the sales manager decides (fn_decide_approval voids it
-- and refunds the deal's unconsumed credits).
create or replace function fn_request_payment_void(p_payment_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare x payments; d deals;
begin
  select * into x from payments where id = p_payment_id;
  if not found then raise exception 'payment not found' using errcode = 'no_data_found'; end if;
  select * into d from deals where id = x.deal_id;
  if not fn_can_pay_deal(d) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  if x.voided_at is not null then raise exception 'payment already voided' using errcode = 'check_violation'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason required' using errcode = 'check_violation'; end if;
  if exists (select 1 from approvals a where a.subject_table = 'payments' and a.subject_id = p_payment_id and a.status = 'pending') then
    raise exception 'a void is already waiting for approval' using errcode = 'check_violation';
  end if;
  return fn_request_approval('payment_void', 'payments', p_payment_id, d.branch_id, trim(p_reason), '{}');
end $$;

-- Catalog editor: add or edit a product. Top management or a sales manager (products_write policy).
-- Price edits never change existing deals: fn_price_deal snapshots prices onto deal items.
create or replace function fn_save_product(p_id uuid, p_code text, p_name text, p_type product_type, p_branch_id uuid, p_price_piastres bigint,
  p_duration_days int default null, p_session_count int default null, p_expiry_days int default null, p_session_minutes int default 60,
  p_is_active boolean default true, p_sort_order int default 0) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not (is_top_management() or has_role('sales_manager')) then raise exception 'only top management or the sales manager edit the catalog' using errcode = 'insufficient_privilege'; end if;
  if p_branch_id is not null and not (is_top_management() or has_role('sales_manager', p_branch_id)) then raise exception 'not your branch' using errcode = 'insufficient_privilege'; end if;
  if coalesce(trim(p_code), '') = '' or coalesce(trim(p_name), '') = '' then raise exception 'code and name required' using errcode = 'check_violation'; end if;
  if p_price_piastres is null or p_price_piastres < 0 then raise exception 'price required' using errcode = 'check_violation'; end if;
  if p_type = 'pt_pack' and coalesce(p_session_count, 0) <= 0 then raise exception 'a PT pack needs a session count' using errcode = 'check_violation'; end if;
  if p_type in ('membership', 'nutrition') and coalesce(p_duration_days, 0) <= 0 then raise exception 'needs a duration in days' using errcode = 'check_violation'; end if;
  if p_expiry_days is not null and p_expiry_days <= 0 then raise exception 'expiry days must be positive' using errcode = 'check_violation'; end if;
  if exists (select 1 from products where code = upper(trim(p_code)) and branch_id is not distinct from p_branch_id and id is distinct from p_id) then
    raise exception 'code already used for that branch' using errcode = 'unique_violation';
  end if;
  if p_id is null then
    insert into products(code, name, type, branch_id, price_piastres, duration_days, session_count, expiry_days, session_minutes, is_active, sort_order)
    values (upper(trim(p_code)), trim(p_name), p_type, p_branch_id, p_price_piastres, case when p_type in ('membership', 'nutrition') then p_duration_days end,
            case when p_type = 'pt_pack' then p_session_count end, case when p_type = 'pt_pack' then p_expiry_days end, coalesce(p_session_minutes, 60),
            coalesce(p_is_active, true), coalesce(p_sort_order, 0))
    returning id into v_id;
  else
    update products set code = upper(trim(p_code)), name = trim(p_name), type = p_type, branch_id = p_branch_id, price_piastres = p_price_piastres,
      duration_days = case when p_type in ('membership', 'nutrition') then p_duration_days end, session_count = case when p_type = 'pt_pack' then p_session_count end,
      expiry_days = case when p_type = 'pt_pack' then p_expiry_days end, session_minutes = coalesce(p_session_minutes, 60),
      is_active = coalesce(p_is_active, true), sort_order = coalesce(p_sort_order, 0)
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'product not found' using errcode = 'no_data_found'; end if;
  end if;
  perform fn_emit_event('product.saved', 'products', v_id, p_branch_id, jsonb_build_object('code', upper(trim(p_code)), 'price', p_price_piastres, 'active', p_is_active));
  return v_id;
end $$;

-- What a bundle contains (bundle rows are edited here; they are not sold in deals yet, see docs/06).
create or replace function fn_save_bundle_items(p_bundle_id uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare it jsonb;
begin
  if not (is_top_management() or has_role('sales_manager')) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  if not exists (select 1 from products where id = p_bundle_id and type = 'bundle') then raise exception 'not a bundle' using errcode = 'check_violation'; end if;
  delete from bundle_items where bundle_product_id = p_bundle_id;
  for it in select value from jsonb_array_elements(coalesce(p_items, '[]')) loop
    if exists (select 1 from products where id = (it->>'product_id')::uuid and type = 'bundle') then raise exception 'a bundle cannot contain a bundle' using errcode = 'check_violation'; end if;
    insert into bundle_items(bundle_product_id, product_id, qty) values (p_bundle_id, (it->>'product_id')::uuid, greatest(1, coalesce((it->>'qty')::int, 1)));
  end loop;
  perform fn_emit_event('product.saved', 'products', p_bundle_id, null, jsonb_build_object('bundle_items', p_items));
end $$;

-- =====================================================================
-- 3. REFRESH: liability every 5 minutes (was nightly only)
-- =====================================================================
create or replace function fn_refresh_views(p_heavy boolean default false) returns void language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view concurrently mv_daily_branch;
  refresh materialized view concurrently mv_coach_month;
  refresh materialized view concurrently mv_rep_month;
  refresh materialized view concurrently mv_client_adherence;
  refresh materialized view concurrently mv_liability;
  if p_heavy then
    refresh materialized view concurrently mv_heatmap;
    refresh materialized view concurrently mv_source_roi;
    refresh materialized view concurrently mv_retention_cohort;
  end if;
end $$;

-- =====================================================================
-- 4. PRIVILEGES (see 0006: every migration revokes anon/PUBLIC on its functions)
-- =====================================================================
revoke execute on function
  fn_can_see_deal(uuid), fn_can_edit_deal(deals), fn_can_pay_deal(deals), fn_deal_approval_preview(uuid), fn_deal_catalog(uuid), fn_branch_coaches(uuid),
  fn_deal(uuid), fn_sales_deals(uuid, deal_status, text), fn_sales_approvals(uuid), fn_sales_client(uuid), fn_money_summary(text, uuid), fn_commission_report(text, uuid),
  fn_create_deal(uuid, uuid), fn_save_deal_draft(uuid, jsonb, numeric, bigint, payment_plan, int, text), fn_request_payment_void(uuid, text),
  fn_save_product(uuid, text, text, product_type, uuid, bigint, int, int, int, int, boolean, int), fn_save_bundle_items(uuid, jsonb), fn_refresh_views(boolean)
from public, anon;
revoke execute on function fn_can_see_deal(uuid), fn_can_edit_deal(deals), fn_can_pay_deal(deals), fn_refresh_views(boolean) from authenticated;
grant execute on function
  fn_deal_approval_preview(uuid), fn_deal_catalog(uuid), fn_branch_coaches(uuid), fn_deal(uuid), fn_sales_deals(uuid, deal_status, text), fn_sales_approvals(uuid),
  fn_sales_client(uuid), fn_money_summary(text, uuid), fn_commission_report(text, uuid), fn_create_deal(uuid, uuid), fn_save_deal_draft(uuid, jsonb, numeric, bigint, payment_plan, int, text),
  fn_request_payment_void(uuid, text), fn_save_product(uuid, text, text, product_type, uuid, bigint, int, int, int, int, boolean, int), fn_save_bundle_items(uuid, jsonb)
to authenticated;
