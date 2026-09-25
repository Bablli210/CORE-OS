-- GymOS — 0011_analytics_more.sql (M6 Analytics)
-- The M6 prompt names this file 0004_analytics_more.sql; 0004 was taken in M1 and applied migrations are immutable, so it
-- is the next free number. What it adds:
--  1. mv_coach_month and mv_daily_branch rebuilt: sessions burned and delivered revenue now come from the sessions that
--     consumed a credit (sessions.credit_consumed + the lot's per-session value), by the coach who delivered them.
--     0002 counted `consume` ledger rows and ignored `restore` rows, so a session changed from completed to cancelled
--     still counted toward the coach's tier and commission; and it followed the lot's current coach, so a reassignment
--     moved past sessions to the new coach. Columns are unchanged (+ revenue_delivered_net on the daily view).
--  2. new shapes: mv_coach_week (sessions per coach per week, 12 weeks), mv_branch_month (booked vs collected on those
--     deals vs outstanding, branch response time), mv_rep_extra (discount usage, flags handled, extensions asked)
--  3. accessors: fn_dashboard_coach_weeks, fn_dashboard_branch_month, fn_dashboard_rep_extra, fn_dashboard_weekly,
--     fn_dashboard_tiles (every StatTile's value, computed here), fn_dashboard_rows (the rows behind each tile, same
--     predicates, so the count/total equals the tile), fn_dashboard_targets, fn_audit_explorer; write fn_save_target
--  4. fn_refresh_views: every view in the 5-minute refresh except the retention cohorts (heavy, nightly)
--  5. events joins the Realtime publication (the admin "today" strip updates on a check-in)

-- =====================================================================
-- 1. REBUILT VIEWS (drop … cascade takes the setof accessors with them; recreated below with their grants)
-- =====================================================================
drop materialized view mv_coach_month cascade;
create materialized view mv_coach_month as
with months as (select to_char(d, 'YYYY-MM') as month from generate_series(date_trunc('month', cairo_date(now())) - interval '12 months', cairo_date(now()), interval '1 month') d),
coaches as (select m.id membership_id, m.branch_id, p.full_name from memberships m join profiles p on p.id = m.profile_id where m.role = 'coach'),
s as (select s.coach_membership_id, to_char(cairo_date(s.scheduled_at), 'YYYY-MM') as month,
        count(*) filter (where s.status = 'completed') completed,
        count(*) filter (where s.status = 'no_show') no_shows,
        count(*) filter (where s.status = 'cancelled') cancelled,
        count(*) filter (where s.unpaid) unpaid_sessions,
        count(*) filter (where s.credit_consumed) burned,
        count(distinct s.client_id) filter (where s.status = 'completed') clients_seen,
        sum(l.per_session_value_piastres) filter (where s.credit_consumed) delivered,
        sum(l.net_per_session_value_piastres) filter (where s.credit_consumed) delivered_net
      from sessions s left join credit_lots l on l.id = s.lot_id group by 1,2),
w as (select closer_membership_id coach_membership_id, to_char(cairo_date(first_paid_at), 'YYYY-MM') as month, sum(total_piastres) renewals_won, count(*) renewals_n
      from deals where status in ('partially_paid','paid') and is_renewal group by 1,2),
ended as (select l.coach_membership_id, l.client_id, l.id lot_id, max(cl.created_at) ended_at
          from credit_lots l join credit_ledger cl on cl.lot_id = l.id and cl.entry_type in ('consume','expire')
          where l.status in ('exhausted','expired') group by 1,2,3),
ret as (select e.coach_membership_id, to_char(cairo_date(e.ended_at), 'YYYY-MM') as month,
               count(distinct e.client_id) ended_clients,
               count(distinct e.client_id) filter (where exists (select 1 from credit_lots n where n.client_id = e.client_id and n.issued_at > e.ended_at and n.issued_at <= e.ended_at + interval '30 days')) renewed_clients
        from ended e group by 1,2),
avail as (select membership_id, sum(extract(epoch from (end_time - start_time)) / 3600) hours_per_week from coach_availability group by 1),
active as (select coach_membership_id, count(*) n from clients where status in ('active','frozen') group by 1)
select c.membership_id, c.branch_id, c.full_name, months.month,
       coalesce(s.completed,0) sessions_completed, coalesce(s.no_shows,0) no_shows, coalesce(s.cancelled,0) cancelled, coalesce(s.unpaid_sessions,0) unpaid_sessions, coalesce(s.burned,0) credits_burned,
       case when coalesce(s.completed,0) + coalesce(s.no_shows,0) > 0 then round(100.0 * coalesce(s.no_shows,0) / (s.completed + s.no_shows), 1) else 0 end no_show_pct,
       coalesce(s.clients_seen,0) clients_seen, coalesce(s.delivered,0) revenue_delivered, coalesce(s.delivered_net,0) revenue_delivered_net,
       fn_pt_commission_pct(coalesce(s.burned,0)::int) commission_pct,
       round(coalesce(s.delivered_net,0) * fn_pt_commission_pct(coalesce(s.burned,0)::int) / 100.0)::bigint commission_piastres,
       coalesce(w.renewals_won,0) renewals_revenue, coalesce(w.renewals_n,0) renewals_count,
       coalesce(ret.ended_clients,0) clients_ended, coalesce(ret.renewed_clients,0) clients_renewed,
       case when coalesce(ret.ended_clients,0) > 0 then round(100.0 * ret.renewed_clients / ret.ended_clients, 0) else null end retention_pct,
       coalesce(active.n,0) active_clients_now,
       case when coalesce(avail.hours_per_week,0) > 0 then round(100.0 * coalesce(s.completed,0) / (avail.hours_per_week * 4.3), 1) else null end utilization_pct
from coaches c cross join months
left join s on s.coach_membership_id = c.membership_id and s.month = months.month
left join w on w.coach_membership_id = c.membership_id and w.month = months.month
left join ret on ret.coach_membership_id = c.membership_id and ret.month = months.month
left join avail on avail.membership_id = c.membership_id
left join active on active.coach_membership_id = c.membership_id;
create unique index on mv_coach_month (membership_id, month);

drop materialized view mv_daily_branch cascade;
create materialized view mv_daily_branch as
with days as (
  select b.id as branch_id, (cairo_date(now()) - i)::date as day from branches b cross join generate_series(0, 400) i
),
leads_d as (select branch_id, cairo_date(created_at) as day, count(*) n from leads group by 1,2),
won_d as (select branch_id, cairo_date(first_paid_at) as day, count(*) n, sum(total_piastres) booked from deals where status in ('partially_paid','paid') group by 1,2),
lapsed_d as (select branch_id, cairo_date(occurred_at) as day, count(*) n from events where type = 'client.lapsed' group by 1,2),
collected_d as (select d.branch_id, cairo_date(p.received_at) as day, sum(p.amount_piastres) amt from payments p join deals d on d.id = p.deal_id where p.voided_at is null group by 1,2),
delivered_d as (select s.branch_id, cairo_date(s.scheduled_at) as day, sum(l.per_session_value_piastres) amt, sum(l.net_per_session_value_piastres) amt_net, count(*) n
                from sessions s join credit_lots l on l.id = s.lot_id where s.credit_consumed group by 1,2),
sessions_d as (select branch_id, cairo_date(scheduled_at) as day,
                 count(*) filter (where status = 'completed') completed,
                 count(*) filter (where status = 'no_show') no_shows,
                 count(*) filter (where status = 'cancelled') cancelled,
                 count(*) filter (where unpaid) unpaid_sessions
               from sessions group by 1,2),
visits_d as (select branch_id, cairo_date(checked_in_at) as day, count(*) n, count(distinct client_id) uniq from visits group by 1,2),
new_clients_d as (select home_branch_id branch_id, cairo_date(joined_at) as day, count(*) n from clients group by 1,2)
select days.branch_id, days.day, week_start_sat(days.day) week_start, to_char(days.day, 'YYYY-MM') as month,
       coalesce(leads_d.n,0) leads, coalesce(won_d.n,0) deals_won, coalesce(won_d.booked,0) revenue_booked,
       coalesce(collected_d.amt,0) revenue_collected, coalesce(delivered_d.amt,0) revenue_delivered, coalesce(delivered_d.n,0) credits_burned,
       coalesce(sessions_d.completed,0) sessions_completed, coalesce(sessions_d.no_shows,0) no_shows, coalesce(sessions_d.cancelled,0) cancelled, coalesce(sessions_d.unpaid_sessions,0) unpaid_sessions,
       coalesce(visits_d.n,0) visits, coalesce(visits_d.uniq,0) unique_visitors, coalesce(new_clients_d.n,0) new_clients, coalesce(lapsed_d.n,0) clients_lapsed,
       coalesce(delivered_d.amt_net,0) revenue_delivered_net
from days
left join leads_d using (branch_id, day) left join won_d using (branch_id, day) left join collected_d using (branch_id, day)
left join delivered_d using (branch_id, day) left join sessions_d using (branch_id, day) left join visits_d using (branch_id, day)
left join new_clients_d using (branch_id, day) left join lapsed_d using (branch_id, day);
create unique index on mv_daily_branch (branch_id, day);

-- =====================================================================
-- 2. NEW SHAPES
-- =====================================================================
-- Sessions per coach per gym week (Sat–Fri), last 12 weeks.
create materialized view mv_coach_week as
with weeks as (select week_start_sat(cairo_date(now())) - 7 * i as week_start from generate_series(0, 11) i),
coaches as (select m.id membership_id, m.branch_id, p.full_name from memberships m join profiles p on p.id = m.profile_id where m.role = 'coach' and m.is_active),
s as (select coach_membership_id, week_start_sat(cairo_date(scheduled_at)) week_start,
             count(*) filter (where status = 'completed') completed, count(*) filter (where status = 'no_show') no_shows, count(*) filter (where credit_consumed) burned
      from sessions where scheduled_at > now() - interval '13 weeks' group by 1,2)
select c.membership_id, c.branch_id, c.full_name, weeks.week_start,
       coalesce(s.completed,0) sessions_completed, coalesce(s.no_shows,0) no_shows, coalesce(s.burned,0) credits_burned
from coaches c cross join weeks left join s on s.coach_membership_id = c.membership_id and s.week_start = weeks.week_start;
create unique index on mv_coach_week (membership_id, week_start);

-- Share of a deal's total that is one product type (payments are split pro-rata by line; docs/03 §8).
create or replace function fn_line_share(p_deal uuid, p_type product_type) returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(line_total_piastres) filter (where product_type = p_type)::numeric / nullif(sum(line_total_piastres), 0), 0) from deal_items where deal_id = p_deal
$$;

-- Per branch per month: deals booked (first paid in the month), what has been collected on those deals so far and what is
-- still outstanding (booked − collected = outstanding by construction), and the branch's median first-response time.
create materialized view mv_branch_month as
with months as (select to_char(d, 'YYYY-MM') as month from generate_series(date_trunc('month', cairo_date(now())) - interval '12 months', cairo_date(now()), interval '1 month') d),
b as (select id branch_id from branches),
dm as (select branch_id, to_char(cairo_date(first_paid_at), 'YYYY-MM') as month, count(*) deals, sum(total_piastres) booked, sum(paid_piastres) collected_on_booked
       from deals where status in ('partially_paid','paid') group by 1,2),
lm as (select branch_id, to_char(cairo_date(created_at), 'YYYY-MM') as month, count(*) leads,
              percentile_cont(0.5) within group (order by extract(epoch from (first_contact_at - created_at)) / 60) filter (where first_contact_at is not null) median_response_min
       from leads group by 1,2),
-- money collected on the deals of the branch's reps, split pro-rata by line type (as mv_rep_month), rounded once per branch
sm as (select m.branch_id, to_char(cairo_date(p.received_at), 'YYYY-MM') as month,
              sum(p.amount_piastres * fn_line_share(d.id, 'membership')) membership_collected,
              sum(p.amount_piastres * (fn_line_share(d.id, 'membership') * fn_setting_num('commission.sales_membership_pct', 0)
                                     + fn_line_share(d.id, 'nutrition') * fn_setting_num('commission.sales_nutrition_pct', 0)) / 100.0) sales_commission
       from payments p join deals d on d.id = p.deal_id join memberships m on m.id = d.rep_membership_id and m.role = 'sales_rep'
       where p.voided_at is null group by 1,2)
select b.branch_id, months.month, coalesce(dm.deals,0) booked_deals, coalesce(dm.booked,0) booked, coalesce(dm.collected_on_booked,0) collected_on_booked,
       coalesce(dm.booked,0) - coalesce(dm.collected_on_booked,0) outstanding, coalesce(lm.leads,0) leads, round(lm.median_response_min::numeric, 0) median_response_min,
       round(coalesce(sm.membership_collected,0))::bigint membership_collected, round(coalesce(sm.sales_commission,0))::bigint sales_commission
from b cross join months left join dm on dm.branch_id = b.branch_id and dm.month = months.month left join lm on lm.branch_id = b.branch_id and lm.month = months.month
left join sm on sm.branch_id = b.branch_id and sm.month = months.month;
create unique index on mv_branch_month (branch_id, month);

-- Per rep per month: discount usage, FLAG tasks handled (and how fast), expiry extensions asked for.
create materialized view mv_rep_extra as
with months as (select to_char(d, 'YYYY-MM') as month from generate_series(date_trunc('month', cairo_date(now())) - interval '12 months', cairo_date(now()), interval '1 month') d),
reps as (select m.id membership_id, m.profile_id, m.branch_id, p.full_name from memberships m join profiles p on p.id = m.profile_id where m.role = 'sales_rep'),
disc as (select rep_membership_id, to_char(cairo_date(first_paid_at), 'YYYY-MM') as month, count(*) filter (where discount_piastres > 0) discounted_deals, sum(discount_piastres) discount_given
         from deals where status in ('partially_paid','paid') group by 1,2),
fl as (select assigned_to_membership_id, to_char(cairo_date(completed_at), 'YYYY-MM') as month, count(*) handled,
              percentile_cont(0.5) within group (order by extract(epoch from (completed_at - created_at)) / 3600) median_hours
       from follow_ups where title like 'FLAG:%' and status = 'done' and completed_at is not null group by 1,2),
ext as (select requested_by, to_char(cairo_date(requested_at), 'YYYY-MM') as month, count(*) n from approvals where type = 'expiry_extension' group by 1,2)
select r.membership_id, r.branch_id, r.full_name, months.month,
       coalesce(disc.discounted_deals,0) discounted_deals, coalesce(disc.discount_given,0) discount_given_piastres,
       coalesce(fl.handled,0) flags_handled, round(fl.median_hours::numeric, 1) flags_median_hours, coalesce(ext.n,0) extensions_requested
from reps r cross join months
left join disc on disc.rep_membership_id = r.membership_id and disc.month = months.month
left join fl on fl.assigned_to_membership_id = r.membership_id and fl.month = months.month
left join ext on ext.requested_by = r.profile_id and ext.month = months.month;
create unique index on mv_rep_extra (membership_id, month);

revoke all on mv_coach_month, mv_daily_branch, mv_coach_week, mv_branch_month, mv_rep_extra from public, anon, authenticated;

-- =====================================================================
-- 3. ACCESSORS
-- =====================================================================
-- the two 0002 accessors the drop took with it, unchanged
create or replace function fn_dashboard_daily(p_from date, p_to date) returns setof mv_daily_branch language sql stable security definer set search_path = public as $$
  select * from mv_daily_branch where day between p_from and p_to and (is_top_management() or branch_id in (select my_branch_ids()))
$$;
create or replace function fn_dashboard_coaches(p_month text) returns setof mv_coach_month language sql stable security definer set search_path = public as $$
  select * from mv_coach_month where month = p_month and (is_top_management() or membership_id in (select my_membership_ids()) or has_role('head_coach', branch_id))
$$;
create or replace function fn_dashboard_coach_weeks(p_branch uuid default null) returns setof mv_coach_week language sql stable security definer set search_path = public as $$
  select * from mv_coach_week where (p_branch is null or branch_id = p_branch)
    and (is_top_management() or membership_id in (select my_membership_ids()) or has_role('head_coach', branch_id))
  order by full_name, week_start
$$;
create or replace function fn_dashboard_branch_month(p_month text) returns setof mv_branch_month language sql stable security definer set search_path = public as $$
  select * from mv_branch_month where month = p_month and (is_top_management() or has_role('sales_manager', branch_id))
$$;
create or replace function fn_dashboard_rep_extra(p_month text) returns setof mv_rep_extra language sql stable security definer set search_path = public as $$
  select * from mv_rep_extra where month = p_month and (is_top_management() or membership_id in (select my_membership_ids()) or has_role('sales_manager', branch_id))
$$;
-- 12-week trends: mv_daily_branch summed per gym week, per branch.
create or replace function fn_dashboard_weekly(p_weeks int default 12)
returns table(branch_id uuid, week_start date, revenue_booked bigint, revenue_collected bigint, revenue_delivered bigint, sessions_completed bigint, no_shows bigint, new_clients bigint, visits bigint, leads bigint)
language sql stable security definer set search_path = public as $$
  select d.branch_id, d.week_start, sum(d.revenue_booked)::bigint, sum(d.revenue_collected)::bigint, sum(d.revenue_delivered)::bigint, sum(d.sessions_completed)::bigint,
         sum(d.no_shows)::bigint, sum(d.new_clients)::bigint, sum(d.visits)::bigint, sum(d.leads)::bigint
  from mv_daily_branch d
  where d.week_start > week_start_sat(cairo_date(now())) - 7 * greatest(1, least(p_weeks, 52))
    and (is_top_management() or d.branch_id in (select my_branch_ids()) and (has_role('head_coach', d.branch_id) or has_role('sales_manager', d.branch_id)))
  group by 1, 2 order by 1, 2
$$;

-- ---------------------------------------------------------------- who may see what
-- screen 'coach': the coach, their head coach, top management · 'rep': the rep, their sales manager, top management
-- 'sales': a branch (sales manager, top management) · 'admin': a branch or all (top management)
create or replace function fn_dashboard_can(p_screen text, p_scope uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_screen
    when 'coach' then exists (select 1 from memberships m where m.id = p_scope and m.role = 'coach' and (is_top_management() or m.id in (select my_membership_ids()) or has_role('head_coach', m.branch_id)))
    when 'rep' then exists (select 1 from memberships m where m.id = p_scope and m.role = 'sales_rep' and (is_top_management() or m.id in (select my_membership_ids()) or has_role('sales_manager', m.branch_id)))
    when 'sales' then is_top_management() or has_role('sales_manager', p_scope)
    when 'admin' then is_top_management()
    else false end
$$;

-- The next PT tier above a number of sessions (for the tier meter): {up_to, pct} of the current tier and of the next one.
create or replace function fn_pt_tier_meter(p_sessions int) returns jsonb language sql stable security definer set search_path = public as $$
  with t as (select (x->>'up_to')::int up_to, (x->>'pct')::numeric pct, i from jsonb_array_elements(coalesce(fn_setting('commission.pt_tiers'), '[]')) with ordinality as a(x, i))
  select jsonb_build_object('sessions', p_sessions, 'pct', fn_pt_commission_pct(p_sessions),
    'tier_up_to', (select up_to from t where up_to is null or p_sessions <= up_to order by i limit 1),
    'next_pct', (select pct from t where t.i = (select i from t where up_to is null or p_sessions <= up_to order by i limit 1) + 1),
    'tiers', (select jsonb_agg(jsonb_build_object('up_to', up_to, 'pct', pct) order by i) from t))
$$;

-- ---------------------------------------------------------------- the rows behind every tile
-- One place defines each metric's rows; fn_dashboard_tiles reads the matching materialized view. The predicates are the
-- views' own, so after a refresh the list's count (or total) equals the tile. Live metrics ("now") compute both here.
create or replace function fn_metric_rows(p_metric text, p_month text, p_scope uuid, p_extra jsonb default '{}')
returns table(row_id uuid, at timestamptz, label text, detail text, amount numeric, flag boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_branch_all boolean := p_scope is null; v_threshold int := fn_setting_int('risk.at_risk_threshold', 60);
        v_reps uuid[]; v_ext_dow int := (p_extra->>'dow')::int; v_ext_hr int := (p_extra->>'hr')::int;
begin
  if p_metric like 'sales.%' then v_reps := array(select id from memberships where role = 'sales_rep' and branch_id = p_scope); end if;
  case p_metric
  -- coach (scope = coach membership)
  when 'coach.burned', 'coach.commission' then return query
    select s.id, s.scheduled_at, c.full_name, s.status::text, l.net_per_session_value_piastres::numeric, s.is_walk_in
    from sessions s join clients c on c.id = s.client_id join credit_lots l on l.id = s.lot_id
    where s.coach_membership_id = p_scope and s.credit_consumed and to_char(cairo_date(s.scheduled_at), 'YYYY-MM') = p_month;
  when 'coach.sessions' then return query
    select s.id, s.scheduled_at, c.full_name, s.status::text, null::numeric, s.is_walk_in
    from sessions s join clients c on c.id = s.client_id
    where s.coach_membership_id = p_scope and s.status = 'completed' and to_char(cairo_date(s.scheduled_at), 'YYYY-MM') = p_month;
  when 'coach.no_show_pct' then return query
    select s.id, s.scheduled_at, c.full_name, s.status::text, null::numeric, s.status = 'no_show'
    from sessions s join clients c on c.id = s.client_id
    where s.coach_membership_id = p_scope and s.status in ('completed','no_show') and to_char(cairo_date(s.scheduled_at), 'YYYY-MM') = p_month;
  when 'coach.active_clients' then return query
    select c.id, c.joined_at, c.full_name, c.status::text, fn_credit_balance(c.id, p_scope)::numeric, false
    from clients c where c.coach_membership_id = p_scope and c.status in ('active','frozen');
  when 'coach.unpaid' then return query
    select s.id, s.scheduled_at, c.full_name, 'unpaid', null::numeric, true
    from sessions s join clients c on c.id = s.client_id where s.coach_membership_id = p_scope and s.unpaid and s.settled_at is null;
  when 'coach.at_risk' then return query
    select c.id, c.last_visit_at, c.full_name, coalesce((select string_agg(x, ', ') from jsonb_array_elements_text(c.risk_reasons) x), ''), c.risk_score::numeric, true
    from clients c where c.coach_membership_id = p_scope and coalesce(c.risk_score, 0) >= v_threshold;
  when 'coach.retention' then return query
    with ended as (select l.client_id, max(cl.created_at) ended_at from credit_lots l join credit_ledger cl on cl.lot_id = l.id and cl.entry_type in ('consume','expire')
                   where l.status in ('exhausted','expired') and l.coach_membership_id = p_scope group by l.client_id, l.id)
    select e.client_id, max(e.ended_at), c.full_name, null::text, null::numeric,
           bool_or(exists (select 1 from credit_lots n where n.client_id = e.client_id and n.issued_at > e.ended_at and n.issued_at <= e.ended_at + interval '30 days'))
    from ended e join clients c on c.id = e.client_id where to_char(cairo_date(e.ended_at), 'YYYY-MM') = p_month group by e.client_id, c.full_name;
  -- rep (scope = rep membership) and sales branch (scope = branch: every rep of the branch)
  when 'rep.won_revenue', 'sales.won_revenue' then return query
    select d.id, d.first_paid_at, coalesce(c.full_name, l.full_name), d.status::text, d.total_piastres::numeric, d.is_renewal
    from deals d left join clients c on c.id = d.client_id left join leads l on l.id = d.lead_id
    where d.status in ('partially_paid','paid') and to_char(cairo_date(d.first_paid_at), 'YYYY-MM') = p_month
      and (d.rep_membership_id = p_scope or d.rep_membership_id = any(v_reps))
      and (not d.is_renewal or fn_setting_text('attribution.renewal_owner','closer') = 'rep' or d.closer_membership_id = d.rep_membership_id);
  when 'rep.leads', 'rep.conversion', 'sales.leads', 'sales.conversion' then return query
    select l.id, l.created_at, l.full_name, l.status::text, null::numeric, l.status = 'won'
    from leads l where (l.owner_membership_id = p_scope or l.owner_membership_id = any(v_reps)) and to_char(cairo_date(l.created_at), 'YYYY-MM') = p_month;
  when 'rep.response' then return query
    select l.id, l.created_at, l.full_name, l.status::text, (extract(epoch from (l.first_contact_at - l.created_at)) / 60)::numeric, l.first_contact_at > l.first_contact_due_at
    from leads l where l.owner_membership_id = p_scope and l.first_contact_at is not null and to_char(cairo_date(l.created_at), 'YYYY-MM') = p_month;
  when 'sales.response' then return query
    select l.id, l.created_at, l.full_name, l.status::text, (extract(epoch from (l.first_contact_at - l.created_at)) / 60)::numeric, l.first_contact_at > l.first_contact_due_at
    from leads l where l.branch_id = p_scope and l.first_contact_at is not null and to_char(cairo_date(l.created_at), 'YYYY-MM') = p_month;
  when 'rep.membership_collected', 'rep.commission', 'sales.membership_collected', 'sales.commission' then return query
    select p.id, p.received_at, coalesce(c.full_name, l.full_name), p.method::text,
           case when p_metric like '%.commission'
                then p.amount_piastres * (fn_line_share(d.id, 'membership') * fn_setting_num('commission.sales_membership_pct', 0)
                                        + fn_line_share(d.id, 'nutrition') * fn_setting_num('commission.sales_nutrition_pct', 0)) / 100.0
                else p.amount_piastres * fn_line_share(d.id, 'membership') end,
           false
    from payments p join deals d on d.id = p.deal_id left join clients c on c.id = d.client_id left join leads l on l.id = d.lead_id
    where p.voided_at is null and to_char(cairo_date(p.received_at), 'YYYY-MM') = p_month and (d.rep_membership_id = p_scope or d.rep_membership_id = any(v_reps));
  when 'rep.overdue', 'sales.overdue' then return query
    select f.id, f.due_at, f.title, f.status::text, null::numeric, true
    from follow_ups f where (f.assigned_to_membership_id = p_scope or f.assigned_to_membership_id = any(v_reps)) and f.status = 'open' and f.due_at < now();
  when 'rep.open_flags', 'sales.open_flags' then return query
    select f.id, f.created_at, f.title, f.status::text, null::numeric, true
    from follow_ups f where (f.assigned_to_membership_id = p_scope or f.assigned_to_membership_id = any(v_reps)) and f.status = 'open' and f.title like 'FLAG:%';
  -- admin (scope = branch, or null for both branches)
  when 'admin.booked', 'admin.collected_on_booked', 'admin.outstanding' then return query
    select d.id, d.first_paid_at, coalesce(c.full_name, l.full_name), d.status::text,
           case p_metric when 'admin.booked' then d.total_piastres when 'admin.collected_on_booked' then d.paid_piastres else d.total_piastres - d.paid_piastres end::numeric, d.is_renewal
    from deals d left join clients c on c.id = d.client_id left join leads l on l.id = d.lead_id
    where d.status in ('partially_paid','paid') and to_char(cairo_date(d.first_paid_at), 'YYYY-MM') = p_month and (v_branch_all or d.branch_id = p_scope);
  when 'admin.collected' then return query
    select p.id, p.received_at, coalesce(c.full_name, l.full_name), p.method::text, p.amount_piastres::numeric, false
    from payments p join deals d on d.id = p.deal_id left join clients c on c.id = d.client_id left join leads l on l.id = d.lead_id
    where p.voided_at is null and to_char(cairo_date(p.received_at), 'YYYY-MM') = p_month and (v_branch_all or d.branch_id = p_scope);
  when 'admin.delivered', 'admin.delivered_net' then return query
    select s.id, s.scheduled_at, c.full_name, (select pr.full_name from memberships m join profiles pr on pr.id = m.profile_id where m.id = s.coach_membership_id),
           (case when p_metric = 'admin.delivered' then l.per_session_value_piastres else l.net_per_session_value_piastres end)::numeric, s.unpaid
    from sessions s join credit_lots l on l.id = s.lot_id join clients c on c.id = s.client_id
    where s.credit_consumed and to_char(cairo_date(s.scheduled_at), 'YYYY-MM') = p_month and (v_branch_all or s.branch_id = p_scope);
  when 'admin.deferred' then return query
    select l.id, l.expires_at, c.full_name, (select pr.full_name from memberships m join profiles pr on pr.id = m.profile_id where m.id = c.coach_membership_id),
           (l.qty_remaining * l.per_session_value_piastres)::numeric, l.expires_at < now() + interval '30 days'
    from clients c join credit_lots l on l.client_id = c.id and l.status = 'active' and l.expires_at > now() where v_branch_all or c.home_branch_id = p_scope;
  when 'admin.coach_commission' then return query
    select v.membership_id, null::timestamptz, v.full_name, v.credits_burned || ' × ' || v.commission_pct || '%', v.commission_piastres::numeric, false
    from mv_coach_month v where v.month = p_month and (v_branch_all or v.branch_id = p_scope) and v.commission_piastres > 0;
  when 'admin.rep_commission' then return query
    select v.membership_id, null::timestamptz, v.full_name, null::text, v.commission_piastres::numeric, false
    from mv_rep_month v where v.month = p_month and (v_branch_all or v.branch_id = p_scope) and v.commission_piastres > 0;
  when 'admin.new_clients' then return query
    select c.id, c.joined_at, c.full_name, c.status::text, null::numeric, false
    from clients c where to_char(cairo_date(c.joined_at), 'YYYY-MM') = p_month and (v_branch_all or c.home_branch_id = p_scope);
  when 'admin.lapsed' then return query
    select e.subject_id, e.occurred_at, c.full_name, 'lapsed', null::numeric, true
    from events e left join clients c on c.id = e.subject_id where e.type = 'client.lapsed' and to_char(cairo_date(e.occurred_at), 'YYYY-MM') = p_month and (v_branch_all or e.branch_id = p_scope);
  when 'admin.net_clients' then return query
    select c.id, c.joined_at, c.full_name, 'new', 1::numeric, false
    from clients c where to_char(cairo_date(c.joined_at), 'YYYY-MM') = p_month and (v_branch_all or c.home_branch_id = p_scope)
    union all
    select e.subject_id, e.occurred_at, c.full_name, 'lapsed', -1::numeric, true
    from events e left join clients c on c.id = e.subject_id where e.type = 'client.lapsed' and to_char(cairo_date(e.occurred_at), 'YYYY-MM') = p_month and (v_branch_all or e.branch_id = p_scope);
  when 'admin.sessions' then return query
    select s.id, s.scheduled_at, c.full_name, (select pr.full_name from memberships m join profiles pr on pr.id = m.profile_id where m.id = s.coach_membership_id), null::numeric, s.is_walk_in
    from sessions s join clients c on c.id = s.client_id
    where s.status = 'completed' and to_char(cairo_date(s.scheduled_at), 'YYYY-MM') = p_month and (v_branch_all or s.branch_id = p_scope);
  when 'admin.no_show_pct' then return query
    select s.id, s.scheduled_at, c.full_name, s.status::text, null::numeric, s.status = 'no_show'
    from sessions s join clients c on c.id = s.client_id
    where s.status in ('completed','no_show') and to_char(cairo_date(s.scheduled_at), 'YYYY-MM') = p_month and (v_branch_all or s.branch_id = p_scope);
  when 'admin.unpaid' then return query
    select s.id, s.scheduled_at, c.full_name, (select pr.full_name from memberships m join profiles pr on pr.id = m.profile_id where m.id = s.coach_membership_id), null::numeric, true
    from sessions s join clients c on c.id = s.client_id where s.unpaid and s.settled_at is null and (v_branch_all or s.branch_id = p_scope);
  -- heatmap cell (scope = branch; extra = {dow, hr}): the last 8 weeks' sessions and visits in that weekday-hour
  when 'heatmap.cell' then return query
    select s.id, s.scheduled_at, c.full_name, 'session · ' || s.status::text, null::numeric, false
    from sessions s join clients c on c.id = s.client_id
    where s.branch_id = p_scope and s.scheduled_at > now() - interval '8 weeks' and s.status in ('completed','booked') and cairo_dow(s.scheduled_at) = v_ext_dow and cairo_hour(s.scheduled_at) = v_ext_hr
    union all
    select v.id, v.checked_in_at, c.full_name, 'visit · ' || v.method::text, null::numeric, true
    from visits v join clients c on c.id = v.client_id
    where v.branch_id = p_scope and v.checked_in_at > now() - interval '8 weeks' and cairo_dow(v.checked_in_at) = v_ext_dow and cairo_hour(v.checked_in_at) = v_ext_hr;
  else
    raise exception 'unknown metric %', p_metric using errcode = 'check_violation';
  end case;
end $$;

-- The tile's own measure over its rows (what the list's footer shows and what equals the tile).
create or replace function fn_metric_total(p_metric text, p_month text, p_scope uuid, p_extra jsonb default '{}') returns numeric
language sql stable security definer set search_path = public as $$
  with r as (select * from fn_metric_rows(p_metric, p_month, p_scope, p_extra))
  select case
    when p_metric = 'coach.commission' then (select round(coalesce(sum(amount), 0) * fn_pt_commission_pct(count(*)::int) / 100.0) from r)
    when p_metric in ('coach.no_show_pct', 'admin.no_show_pct') then (select case when count(*) > 0 then round(100.0 * count(*) filter (where flag) / count(*), 1) else 0 end from r)
    when p_metric in ('rep.conversion', 'sales.conversion') then (select case when count(*) > 0 then round(100.0 * count(*) filter (where flag) / count(*), 1) else 0 end from r)
    when p_metric = 'coach.retention' then (select case when count(*) > 0 then round(100.0 * count(*) filter (where flag) / count(*), 0) end from r)
    when p_metric in ('rep.response', 'sales.response') then (select round((percentile_cont(0.5) within group (order by amount))::numeric, 0) from r)
    when p_metric in ('rep.membership_collected', 'sales.membership_collected') then (select round(coalesce(sum(amount), 0)) from r)
    when p_metric in ('rep.commission', 'sales.commission') then (select round(coalesce(sum(amount), 0)) from r)
    when p_metric in ('rep.won_revenue', 'sales.won_revenue', 'admin.booked', 'admin.collected_on_booked', 'admin.outstanding', 'admin.collected', 'admin.delivered',
                      'admin.delivered_net', 'admin.deferred', 'admin.coach_commission', 'admin.rep_commission', 'admin.net_clients') then (select coalesce(sum(amount), 0) from r)
    else (select count(*) from r)::numeric end
$$;

-- The drill-down list: {metric, count, total, rows[]} (rows capped at 500, count and total over all of them).
create or replace function fn_dashboard_rows(p_metric text, p_month text, p_scope uuid default null, p_extra jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_screen text := split_part(p_metric, '.', 1);
begin
  if not (case when v_screen = 'heatmap' then is_top_management() or has_role('head_coach', p_scope) or has_role('sales_manager', p_scope)
               else fn_dashboard_can(v_screen, p_scope) end) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object('metric', p_metric, 'month', p_month,
    'count', (select count(*) from fn_metric_rows(p_metric, p_month, p_scope, p_extra)),
    'total', fn_metric_total(p_metric, p_month, p_scope, p_extra),
    'rows', coalesce((select jsonb_agg(to_jsonb(x) order by x.at desc nulls last, x.label) from (select * from fn_metric_rows(p_metric, p_month, p_scope, p_extra) limit 500) x), '[]'));
end $$;

-- ---------------------------------------------------------------- tiles
-- Every StatTile of a screen: {key (the metric fn_dashboard_rows lists), value, unit, target?, sub?}. Month values come
-- from the materialized views (up to 5 minutes old); "now" values are live. Targets from the targets table.
create or replace function fn_dashboard_tiles(p_screen text, p_month text, p_scope uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c mv_coach_month; r mv_rep_month; v_threshold int := fn_setting_int('risk.at_risk_threshold', 60); v jsonb;
        v_target_scope target_scope; v_rep_pct numeric := fn_setting_num('commission.sales_membership_pct', 0);
begin
  if not fn_dashboard_can(p_screen, p_scope) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  if p_screen = 'coach' then
    select * into c from mv_coach_month where membership_id = p_scope and month = p_month;
    return jsonb_build_object('tiles', jsonb_build_array(
      jsonb_build_object('key', 'coach.burned', 'value', coalesce(c.credits_burned, 0), 'unit', 'count'),
      jsonb_build_object('key', 'coach.commission', 'value', coalesce(c.commission_piastres, 0), 'unit', 'money', 'sub', jsonb_build_object('net', coalesce(c.revenue_delivered_net, 0), 'pct', coalesce(c.commission_pct, 0))),
      jsonb_build_object('key', 'coach.sessions', 'value', coalesce(c.sessions_completed, 0), 'unit', 'count',
                         'target', (select value from targets where period = p_month and scope_type = 'membership' and scope_id = p_scope and metric = 'sessions_completed')),
      jsonb_build_object('key', 'coach.no_show_pct', 'value', coalesce(c.no_show_pct, 0), 'unit', 'pct'),
      jsonb_build_object('key', 'coach.active_clients', 'value', coalesce(c.active_clients_now, 0), 'unit', 'count'),
      jsonb_build_object('key', 'coach.unpaid', 'value', (select count(*) from sessions s where s.coach_membership_id = p_scope and s.unpaid and s.settled_at is null), 'unit', 'count', 'live', true),
      jsonb_build_object('key', 'coach.at_risk', 'value', (select count(*) from clients x where x.coach_membership_id = p_scope and coalesce(x.risk_score, 0) >= v_threshold), 'unit', 'count', 'live', true),
      jsonb_build_object('key', 'coach.retention', 'value', c.retention_pct, 'unit', 'pct', 'sub', jsonb_build_object('ended', coalesce(c.clients_ended, 0), 'renewed', coalesce(c.clients_renewed, 0)))),
      'meter', fn_pt_tier_meter(coalesce(c.credits_burned, 0)::int),
      'name', (select full_name from mv_coach_month where membership_id = p_scope limit 1));
  elsif p_screen = 'rep' then
    select * into r from mv_rep_month where membership_id = p_scope and month = p_month;
    return jsonb_build_object('tiles', jsonb_build_array(
      jsonb_build_object('key', 'rep.won_revenue', 'value', coalesce(r.won_revenue, 0), 'unit', 'money',
                         'target', (select value from targets where period = p_month and scope_type = 'membership' and scope_id = p_scope and metric = 'won_revenue')),
      jsonb_build_object('key', 'rep.leads', 'value', coalesce(r.leads, 0), 'unit', 'count'),
      jsonb_build_object('key', 'rep.conversion', 'value', coalesce(r.conversion_pct, 0), 'unit', 'pct', 'sub', jsonb_build_object('won', coalesce(r.won, 0), 'leads', coalesce(r.leads, 0))),
      jsonb_build_object('key', 'rep.response', 'value', r.median_response_min, 'unit', 'minutes'),
      jsonb_build_object('key', 'rep.membership_collected', 'value', coalesce(r.membership_collected, 0), 'unit', 'money'),
      jsonb_build_object('key', 'rep.commission', 'value', coalesce(r.commission_piastres, 0), 'unit', 'money', 'sub', jsonb_build_object('pct', v_rep_pct)),
      jsonb_build_object('key', 'rep.overdue', 'value', (select count(*) from follow_ups f where f.assigned_to_membership_id = p_scope and f.status = 'open' and f.due_at < now()), 'unit', 'count', 'live', true),
      jsonb_build_object('key', 'rep.open_flags', 'value', (select count(*) from follow_ups f where f.assigned_to_membership_id = p_scope and f.status = 'open' and f.title like 'FLAG:%'), 'unit', 'count', 'live', true)),
      'name', (select full_name from mv_rep_month where membership_id = p_scope limit 1));
  elsif p_screen = 'sales' then
    select jsonb_build_object('tiles', jsonb_build_array(
      jsonb_build_object('key', 'sales.won_revenue', 'value', coalesce(sum(x.won_revenue), 0), 'unit', 'money'),
      jsonb_build_object('key', 'sales.leads', 'value', coalesce(sum(x.leads), 0), 'unit', 'count'),
      jsonb_build_object('key', 'sales.conversion', 'value', case when coalesce(sum(x.leads), 0) > 0 then round(100.0 * sum(x.won) / sum(x.leads), 1) else 0 end, 'unit', 'pct',
                         'sub', jsonb_build_object('won', coalesce(sum(x.won), 0), 'leads', coalesce(sum(x.leads), 0))),
      jsonb_build_object('key', 'sales.response', 'value', (select median_response_min from mv_branch_month b where b.branch_id = p_scope and b.month = p_month), 'unit', 'minutes'),
      jsonb_build_object('key', 'sales.membership_collected', 'value', (select membership_collected from mv_branch_month b where b.branch_id = p_scope and b.month = p_month), 'unit', 'money'),
      jsonb_build_object('key', 'sales.commission', 'value', (select sales_commission from mv_branch_month b where b.branch_id = p_scope and b.month = p_month), 'unit', 'money', 'sub', jsonb_build_object('pct', v_rep_pct)),
      jsonb_build_object('key', 'sales.overdue', 'value', (select count(*) from follow_ups f join memberships m on m.id = f.assigned_to_membership_id
                          where m.role = 'sales_rep' and m.branch_id = p_scope and f.status = 'open' and f.due_at < now()), 'unit', 'count', 'live', true),
      jsonb_build_object('key', 'sales.open_flags', 'value', (select count(*) from follow_ups f join memberships m on m.id = f.assigned_to_membership_id
                          where m.role = 'sales_rep' and m.branch_id = p_scope and f.status = 'open' and f.title like 'FLAG:%'), 'unit', 'count', 'live', true)))
      into v from mv_rep_month x where x.branch_id = p_scope and x.month = p_month;
    return v;
  elsif p_screen = 'admin' then
    v_target_scope := 'branch';
    select jsonb_build_object('tiles', jsonb_build_array(
      jsonb_build_object('key', 'admin.booked', 'value', (select coalesce(sum(booked), 0) from mv_branch_month b where b.month = p_month and (p_scope is null or b.branch_id = p_scope)), 'unit', 'money',
                         'target', (select sum(value) from targets t where t.period = p_month and t.scope_type = v_target_scope and t.metric = 'won_revenue' and (p_scope is null or t.scope_id = p_scope))),
      jsonb_build_object('key', 'admin.collected_on_booked', 'value', (select coalesce(sum(collected_on_booked), 0) from mv_branch_month b where b.month = p_month and (p_scope is null or b.branch_id = p_scope)), 'unit', 'money'),
      jsonb_build_object('key', 'admin.outstanding', 'value', (select coalesce(sum(outstanding), 0) from mv_branch_month b where b.month = p_month and (p_scope is null or b.branch_id = p_scope)), 'unit', 'money'),
      jsonb_build_object('key', 'admin.collected', 'value', coalesce(sum(d.revenue_collected), 0), 'unit', 'money'),
      jsonb_build_object('key', 'admin.delivered', 'value', coalesce(sum(d.revenue_delivered), 0), 'unit', 'money'),
      jsonb_build_object('key', 'admin.delivered_net', 'value', coalesce(sum(d.revenue_delivered_net), 0), 'unit', 'money'),
      jsonb_build_object('key', 'admin.deferred', 'value', (select coalesce(sum(liability_piastres), 0) from mv_liability l where p_scope is null or l.branch_id = p_scope), 'unit', 'money'),
      jsonb_build_object('key', 'admin.coach_commission', 'value', (select coalesce(sum(commission_piastres), 0) from mv_coach_month m where m.month = p_month and (p_scope is null or m.branch_id = p_scope)), 'unit', 'money'),
      jsonb_build_object('key', 'admin.rep_commission', 'value', (select coalesce(sum(commission_piastres), 0) from mv_rep_month m where m.month = p_month and (p_scope is null or m.branch_id = p_scope)), 'unit', 'money'),
      jsonb_build_object('key', 'admin.new_clients', 'value', coalesce(sum(d.new_clients), 0), 'unit', 'count',
                         'target', (select sum(value) from targets t where t.period = p_month and t.scope_type = v_target_scope and t.metric = 'new_clients' and (p_scope is null or t.scope_id = p_scope))),
      jsonb_build_object('key', 'admin.lapsed', 'value', coalesce(sum(d.clients_lapsed), 0), 'unit', 'count'),
      jsonb_build_object('key', 'admin.net_clients', 'value', coalesce(sum(d.new_clients), 0) - coalesce(sum(d.clients_lapsed), 0), 'unit', 'count'),
      jsonb_build_object('key', 'admin.sessions', 'value', coalesce(sum(d.sessions_completed), 0), 'unit', 'count',
                         'target', (select sum(value) from targets t where t.period = p_month and t.scope_type = v_target_scope and t.metric = 'sessions_completed' and (p_scope is null or t.scope_id = p_scope))),
      jsonb_build_object('key', 'admin.no_show_pct', 'value', case when coalesce(sum(d.sessions_completed + d.no_shows), 0) > 0 then round(100.0 * sum(d.no_shows) / sum(d.sessions_completed + d.no_shows), 1) else 0 end, 'unit', 'pct'),
      jsonb_build_object('key', 'admin.unpaid', 'value', (select count(*) from sessions s where s.unpaid and s.settled_at is null and (p_scope is null or s.branch_id = p_scope)), 'unit', 'count', 'live', true)))
      into v from mv_daily_branch d where d.month = p_month and (p_scope is null or d.branch_id = p_scope);
    return v;
  end if;
  raise exception 'unknown screen %', p_screen using errcode = 'check_violation';
end $$;

-- ---------------------------------------------------------------- targets
-- Target vs actual for a period. Actuals come from the views: a rep's won revenue (mv_rep_month), a coach's completed
-- sessions (mv_coach_month), a branch's booked revenue / new clients / completed sessions (mv_daily_branch).
-- p_all (top management): every branch, rep and coach, with or without a target (the /admin/targets grid).
create or replace function fn_dashboard_targets(p_period text, p_all boolean default false) returns jsonb
language sql stable security definer set search_path = public as $$
  with scopes as (
    select 'branch'::target_scope scope_type, b.id scope_id, b.name, null::text role, b.id branch_id, m.metric
      from branches b cross join (values ('won_revenue'), ('new_clients'), ('sessions_completed')) m(metric)
    union all
    select 'membership', m.id, p.full_name, m.role::text, m.branch_id, case m.role when 'sales_rep' then 'won_revenue' else 'sessions_completed' end
      from memberships m join profiles p on p.id = m.profile_id where m.is_active and m.role in ('sales_rep','coach')
  ),
  visible as (
    select s.* from scopes s
    where is_top_management()
       or (s.scope_type = 'membership' and s.scope_id in (select my_membership_ids()))
       or (s.scope_type = 'membership' and ((s.role = 'sales_rep' and has_role('sales_manager', s.branch_id)) or (s.role = 'coach' and has_role('head_coach', s.branch_id))))
       or (s.scope_type = 'branch' and (has_role('sales_manager', s.branch_id) or has_role('head_coach', s.branch_id)))
  )
  select coalesce(jsonb_agg(jsonb_build_object('scope_type', v.scope_type, 'scope_id', v.scope_id, 'name', v.name, 'role', v.role, 'branch_id', v.branch_id, 'metric', v.metric,
           'unit', case v.metric when 'won_revenue' then 'money' else 'count' end,
           'target', t.value,
           'actual', case
             when v.scope_type = 'membership' and v.metric = 'won_revenue' then (select won_revenue from mv_rep_month r where r.membership_id = v.scope_id and r.month = p_period)
             when v.scope_type = 'membership' then (select sessions_completed from mv_coach_month c where c.membership_id = v.scope_id and c.month = p_period)
             when v.metric = 'won_revenue' then (select sum(revenue_booked) from mv_daily_branch d where d.branch_id = v.scope_id and d.month = p_period)
             when v.metric = 'new_clients' then (select sum(new_clients) from mv_daily_branch d where d.branch_id = v.scope_id and d.month = p_period)
             else (select sum(sessions_completed) from mv_daily_branch d where d.branch_id = v.scope_id and d.month = p_period) end)
         order by v.scope_type, v.role nulls first, v.name, v.metric), '[]')
  from visible v left join targets t on t.period = p_period and t.scope_type = v.scope_type and t.scope_id = v.scope_id and t.metric = v.metric
  where p_all or t.value is not null
$$;

-- Top management sets a target; an empty value removes it (a target is configuration, not history).
create or replace function fn_save_target(p_period text, p_scope_type target_scope, p_scope_id uuid, p_metric text, p_value numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_top_management() then raise exception 'only top management sets targets' using errcode = 'insufficient_privilege'; end if;
  if p_period !~ '^\d{4}-\d{2}$' then raise exception 'period must be YYYY-MM' using errcode = 'check_violation'; end if;
  if p_metric not in ('won_revenue','new_clients','sessions_completed') then raise exception 'unknown metric' using errcode = 'check_violation'; end if;
  if p_value is not null and p_value < 0 then raise exception 'a target cannot be negative' using errcode = 'check_violation'; end if;
  if p_value is null then
    delete from targets where period = p_period and scope_type = p_scope_type and scope_id = p_scope_id and metric = p_metric;
  else
    insert into targets(period, scope_type, scope_id, metric, value, created_by) values (p_period, p_scope_type, p_scope_id, p_metric, p_value, auth.uid())
    on conflict (period, scope_type, scope_id, metric) do update set value = excluded.value, created_by = excluded.created_by;
  end if;
  perform fn_emit_event('target.saved', 'targets', p_scope_id,
    case when p_scope_type = 'branch' then p_scope_id else (select branch_id from memberships where id = p_scope_id) end,
    jsonb_build_object('period', p_period, 'scope_type', p_scope_type, 'metric', p_metric, 'value', p_value));
end $$;

-- ---------------------------------------------------------------- audit explorer
-- events and audit_log for top management, filtered by table / type, actor, date range and free text; with the actor's
-- name and (audit_log) the old and new row for the diff view.
create or replace function fn_audit_explorer(p_source text default 'events', p_table text default null, p_actor uuid default null,
  p_from date default null, p_to date default null, p_search text default null, p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_top_management() then raise exception 'the audit explorer is top management''s' using errcode = 'insufficient_privilege'; end if;
  if p_source = 'audit' then
    return jsonb_build_object(
      'tables', (select coalesce(jsonb_agg(distinct table_name), '[]') from audit_log),
      'rows', coalesce((select jsonb_agg(x order by x.occurred_at desc) from (
        select a.id, a.occurred_at, a.table_name as kind, a.action, a.row_id, a.branch_id, (select full_name from profiles where id = a.actor_profile_id) actor, a.old_row, a.new_row
        from audit_log a
        where (p_table is null or a.table_name = p_table) and (p_actor is null or a.actor_profile_id = p_actor)
          and (p_from is null or cairo_date(a.occurred_at) >= p_from) and (p_to is null or cairo_date(a.occurred_at) <= p_to)
          and (p_search is null or a.new_row::text ilike '%' || p_search || '%' or a.old_row::text ilike '%' || p_search || '%')
        order by a.occurred_at desc limit least(greatest(p_limit, 1), 500)) x), '[]'));
  end if;
  return jsonb_build_object(
    'tables', (select coalesce(jsonb_agg(distinct split_part(type, '.', 1)), '[]') from events),
    'rows', coalesce((select jsonb_agg(x order by x.occurred_at desc) from (
      select e.id, e.occurred_at, e.type as kind, e.subject_table as action, e.subject_id as row_id, e.branch_id, (select full_name from profiles where id = e.actor_profile_id) actor, null::jsonb old_row, e.payload new_row
      from events e
      where (p_table is null or split_part(e.type, '.', 1) = p_table) and (p_actor is null or e.actor_profile_id = p_actor)
        and (p_from is null or cairo_date(e.occurred_at) >= p_from) and (p_to is null or cairo_date(e.occurred_at) <= p_to)
        and (p_search is null or e.type ilike '%' || p_search || '%' or e.payload::text ilike '%' || p_search || '%')
      order by e.occurred_at desc limit least(greatest(p_limit, 1), 500)) x), '[]'));
end $$;

-- =====================================================================
-- 4. REFRESH: everything in the 5-minute run except the retention cohorts
-- =====================================================================
create or replace function fn_refresh_views(p_heavy boolean default false) returns void language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view concurrently mv_daily_branch;
  refresh materialized view concurrently mv_coach_month;
  refresh materialized view concurrently mv_rep_month;
  refresh materialized view concurrently mv_client_adherence;
  refresh materialized view concurrently mv_liability;
  refresh materialized view concurrently mv_heatmap;
  refresh materialized view concurrently mv_source_roi;
  refresh materialized view concurrently mv_coach_week;
  refresh materialized view concurrently mv_branch_month;
  refresh materialized view concurrently mv_rep_extra;
  if p_heavy then
    refresh materialized view concurrently mv_retention_cohort;
  end if;
end $$;

-- =====================================================================
-- 5. REALTIME: the admin "today" strip listens to events (RLS: top management, branch heads)
-- =====================================================================
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events') then
    alter publication supabase_realtime add table events;
  end if;
end $$;

-- =====================================================================
-- 6. PRIVILEGES (see 0006: every migration revokes anon/PUBLIC on its functions)
-- =====================================================================
revoke execute on function fn_line_share(uuid, product_type), fn_dashboard_daily(date, date), fn_dashboard_coaches(text), fn_dashboard_coach_weeks(uuid), fn_dashboard_branch_month(text), fn_dashboard_rep_extra(text),
  fn_dashboard_weekly(int), fn_dashboard_can(text, uuid), fn_pt_tier_meter(int), fn_metric_rows(text, text, uuid, jsonb), fn_metric_total(text, text, uuid, jsonb),
  fn_dashboard_rows(text, text, uuid, jsonb), fn_dashboard_tiles(text, text, uuid), fn_dashboard_targets(text, boolean), fn_save_target(text, target_scope, uuid, text, numeric),
  fn_audit_explorer(text, text, uuid, date, date, text, int), fn_refresh_views(boolean) from public, anon;
revoke execute on function fn_line_share(uuid, product_type), fn_dashboard_can(text, uuid), fn_metric_rows(text, text, uuid, jsonb), fn_metric_total(text, text, uuid, jsonb), fn_refresh_views(boolean) from authenticated;
grant execute on function fn_dashboard_daily(date, date), fn_dashboard_coaches(text), fn_dashboard_coach_weeks(uuid), fn_dashboard_branch_month(text), fn_dashboard_rep_extra(text),
  fn_dashboard_weekly(int), fn_pt_tier_meter(int), fn_dashboard_rows(text, text, uuid, jsonb), fn_dashboard_tiles(text, text, uuid), fn_dashboard_targets(text, boolean),
  fn_save_target(text, target_scope, uuid, text, numeric), fn_audit_explorer(text, text, uuid, date, date, text, int) to authenticated;
