-- GymOS — 0016_daily_month_window.sql
-- mv_daily_branch covered the 400 days up to today, while the rows behind each tile (fn_metric_rows) take the whole
-- month. A session dated later this month that already has an outcome was in the rows but not on the tile, so "every
-- tile equals its rows" broke for most of each month (seen on 2026-10-01: admin.sessions tile 3, rows 4). The view now
-- runs through the last day of the current month. Same columns, same index, same privileges; fn_dashboard_daily, which
-- the drop takes with it, is recreated unchanged. The 12-week trend (fn_dashboard_weekly) stops at the current week.

drop materialized view mv_daily_branch cascade;
create materialized view mv_daily_branch as
with days as (
  -- 400 days back through the last day of the current month: a session dated later this month that already has an
  -- outcome counts on the tile, as it does in the rows behind the tile (fn_metric_rows buckets by month)
  select b.id as branch_id, d::date as day from branches b
  cross join generate_series(cairo_date(now()) - 400, (date_trunc('month', cairo_date(now())) + interval '1 month - 1 day')::date, interval '1 day') d
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

revoke all on mv_daily_branch from public, anon, authenticated;

create or replace function fn_dashboard_daily(p_from date, p_to date) returns setof mv_daily_branch language sql stable security definer set search_path = public as $$
  select * from mv_daily_branch where day between p_from and p_to and (is_top_management() or branch_id in (select my_branch_ids()))
$$;
revoke execute on function fn_dashboard_daily(date, date) from public, anon;
grant execute on function fn_dashboard_daily(date, date) to authenticated;

create or replace function fn_dashboard_weekly(p_weeks int default 12)
returns table(branch_id uuid, week_start date, revenue_booked bigint, revenue_collected bigint, revenue_delivered bigint, sessions_completed bigint, no_shows bigint, new_clients bigint, visits bigint, leads bigint)
language sql stable security definer set search_path = public as $$
  select d.branch_id, d.week_start, sum(d.revenue_booked)::bigint, sum(d.revenue_collected)::bigint, sum(d.revenue_delivered)::bigint, sum(d.sessions_completed)::bigint,
         sum(d.no_shows)::bigint, sum(d.new_clients)::bigint, sum(d.visits)::bigint, sum(d.leads)::bigint
  from mv_daily_branch d
  where d.week_start > week_start_sat(cairo_date(now())) - 7 * greatest(1, least(p_weeks, 52))
    and d.week_start <= week_start_sat(cairo_date(now()))   -- the view runs to month end (0016); trends stop at this week
    and (is_top_management() or d.branch_id in (select my_branch_ids()) and (has_role('head_coach', d.branch_id) or has_role('sales_manager', d.branch_id)))
  group by 1, 2 order by 1, 2
$$;
