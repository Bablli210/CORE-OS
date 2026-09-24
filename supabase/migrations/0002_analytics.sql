-- GymOS — 0002_analytics.sql
-- Materialized views that every dashboard reads, plus the refresh function and pg_cron schedule.
-- All money in piastres. Weeks start Saturday (Egypt): week_start = date_trunc('week', d + 2) - 2.

-- =====================================================================
-- helpers
-- =====================================================================
create or replace function cairo_date(t timestamptz) returns date language sql immutable as $$ select (t at time zone 'Africa/Cairo')::date $$;
create or replace function cairo_hour(t timestamptz) returns int language sql immutable as $$ select extract(hour from (t at time zone 'Africa/Cairo'))::int $$;
create or replace function cairo_dow(t timestamptz) returns int language sql immutable as $$ select extract(dow from (t at time zone 'Africa/Cairo'))::int $$;
create or replace function week_start_sat(d date) returns date language sql immutable as $$ select (date_trunc('week', d + 2)::date - 2) $$;

-- =====================================================================
-- mv_daily_branch — one row per branch per day (last 400 days)
-- =====================================================================
create materialized view mv_daily_branch as
with days as (
  select b.id as branch_id, (current_date - i)::date as day from branches b cross join generate_series(0, 400) i
),
leads_d as (select branch_id, cairo_date(created_at) as day, count(*) n from leads group by 1,2),
won_d as (select branch_id, cairo_date(first_paid_at) as day, count(*) n, sum(total_piastres) booked from deals where status in ('partially_paid','paid') group by 1,2),
lapsed_d as (select branch_id, cairo_date(occurred_at) as day, count(*) n from events where type = 'client.lapsed' group by 1,2),
collected_d as (select d.branch_id, cairo_date(p.received_at) as day, sum(p.amount_piastres) amt from payments p join deals d on d.id = p.deal_id where p.voided_at is null group by 1,2),
delivered_d as (select branch_id, cairo_date(occurred_at) as day, sum((payload->>'value')::bigint) amt, count(*) n from events where type = 'credit.consumed' group by 1,2),
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
       coalesce(visits_d.n,0) visits, coalesce(visits_d.uniq,0) unique_visitors, coalesce(new_clients_d.n,0) new_clients, coalesce(lapsed_d.n,0) clients_lapsed
from days
left join leads_d using (branch_id, day) left join won_d using (branch_id, day) left join collected_d using (branch_id, day)
left join delivered_d using (branch_id, day) left join sessions_d using (branch_id, day) left join visits_d using (branch_id, day)
left join new_clients_d using (branch_id, day) left join lapsed_d using (branch_id, day);
create unique index on mv_daily_branch (branch_id, day);

-- =====================================================================
-- commission helpers
-- =====================================================================
-- PT tier: the rate for a given number of sessions burned in the period (settings: commission.pt_tiers)
create or replace function fn_pt_commission_pct(p_sessions int) returns numeric language sql stable set search_path = public as $$
  select coalesce((
    select (t->>'pct')::numeric from jsonb_array_elements(coalesce(fn_setting('commission.pt_tiers'), '[]'::jsonb)) with ordinality as x(t, i)
    where (t->>'up_to') is null or p_sessions <= (t->>'up_to')::int
    order by i limit 1), 0)
$$;

-- =====================================================================
-- mv_coach_month — per coach membership per month (delivery, adherence of their book, commission)
-- =====================================================================
create materialized view mv_coach_month as
with months as (select to_char(d, 'YYYY-MM') as month from generate_series(date_trunc('month', current_date) - interval '12 months', current_date, interval '1 month') d),
coaches as (select m.id membership_id, m.branch_id, p.full_name from memberships m join profiles p on p.id = m.profile_id where m.role = 'coach'),
s as (select coach_membership_id, to_char(cairo_date(scheduled_at), 'YYYY-MM') as month,
        count(*) filter (where status = 'completed') completed,
        count(*) filter (where status = 'no_show') no_shows,
        count(*) filter (where status = 'cancelled') cancelled,
        count(*) filter (where unpaid) unpaid_sessions,
        count(*) filter (where credit_consumed) burned,
        count(distinct client_id) filter (where status = 'completed') clients_seen
      from sessions group by 1,2),
d as (select l.coach_membership_id, to_char(cairo_date(coalesce(se.scheduled_at, cl.created_at)), 'YYYY-MM') as month,
             sum(l.per_session_value_piastres) delivered, sum(l.net_per_session_value_piastres) delivered_net, count(*) burned_net
      from credit_ledger cl join credit_lots l on l.id = cl.lot_id left join sessions se on se.id = cl.session_id
      where cl.entry_type = 'consume' group by 1,2),
w as (select closer_membership_id coach_membership_id, to_char(cairo_date(first_paid_at), 'YYYY-MM') as month, sum(total_piastres) renewals_won, count(*) renewals_n
      from deals where status in ('partially_paid','paid') and is_renewal group by 1,2),
-- retention: clients whose pack with this coach ran out (exhausted/expired) in the month, and how many bought a new pack within 30 days
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
       coalesce(s.clients_seen,0) clients_seen, coalesce(d.delivered,0) revenue_delivered, coalesce(d.delivered_net,0) revenue_delivered_net,
       fn_pt_commission_pct(coalesce(d.burned_net,0)::int) commission_pct,
       round(coalesce(d.delivered_net,0) * fn_pt_commission_pct(coalesce(d.burned_net,0)::int) / 100.0)::bigint commission_piastres,
       coalesce(w.renewals_won,0) renewals_revenue, coalesce(w.renewals_n,0) renewals_count,
       coalesce(ret.ended_clients,0) clients_ended, coalesce(ret.renewed_clients,0) clients_renewed,
       case when coalesce(ret.ended_clients,0) > 0 then round(100.0 * ret.renewed_clients / ret.ended_clients, 0) else null end retention_pct,
       coalesce(active.n,0) active_clients_now,
       case when coalesce(avail.hours_per_week,0) > 0 then round(100.0 * coalesce(s.completed,0) / (avail.hours_per_week * 4.3), 1) else null end utilization_pct
from coaches c cross join months
left join s on s.coach_membership_id = c.membership_id and s.month = months.month
left join d on d.coach_membership_id = c.membership_id and d.month = months.month
left join w on w.coach_membership_id = c.membership_id and w.month = months.month
left join ret on ret.coach_membership_id = c.membership_id and ret.month = months.month
left join avail on avail.membership_id = c.membership_id
left join active on active.coach_membership_id = c.membership_id;
create unique index on mv_coach_month (membership_id, month);

-- =====================================================================
-- mv_rep_month — per sales rep per month
-- =====================================================================
create materialized view mv_rep_month as
with months as (select to_char(d, 'YYYY-MM') as month from generate_series(date_trunc('month', current_date) - interval '12 months', current_date, interval '1 month') d),
reps as (select m.id membership_id, m.branch_id, p.full_name from memberships m join profiles p on p.id = m.profile_id where m.role = 'sales_rep'),
l as (select owner_membership_id, to_char(cairo_date(created_at), 'YYYY-MM') as month,
        count(*) leads, count(*) filter (where first_contact_at is not null) contacted,
        count(*) filter (where onboarding_completed_at is not null) onboarded,
        count(*) filter (where status in ('quoted','won')) quoted,
        count(*) filter (where status = 'won') won, count(*) filter (where status = 'lost') lost,
        count(*) filter (where first_contact_at > first_contact_due_at) sla_breaches,
        percentile_cont(0.5) within group (order by extract(epoch from (first_contact_at - created_at)) / 60) median_response_min
      from leads where owner_membership_id is not null group by 1,2),
-- won = booked at first payment; renewals count for the rep only when attribution.renewal_owner = 'rep' or the rep closed it
r as (select rep_membership_id, to_char(cairo_date(first_paid_at), 'YYYY-MM') as month, sum(total_piastres) won_revenue, count(*) deals, avg(discount_pct) avg_discount_pct
      from deals where status in ('partially_paid','paid')
        and (not is_renewal or fn_setting_text('attribution.renewal_owner','closer') = 'rep' or closer_membership_id = rep_membership_id)
      group by 1,2),
-- collected money attributed to item types pro-rata by line total (a 9400 deal = 4000 membership + 5400 PT; a 4700 payment counts 2000 membership, 2700 PT)
col as (select d.rep_membership_id, to_char(cairo_date(p.received_at), 'YYYY-MM') as month,
               sum(p.amount_piastres * coalesce(mi.membership_share, 0)) membership_collected,
               sum(p.amount_piastres * coalesce(mi.nutrition_share, 0)) nutrition_collected,
               sum(p.amount_piastres * coalesce(mi.pt_share, 0)) pt_collected
        from payments p join deals d on d.id = p.deal_id
        left join (select deal_id,
                          sum(line_total_piastres) filter (where product_type = 'membership')::numeric / nullif(sum(line_total_piastres),0) membership_share,
                          sum(line_total_piastres) filter (where product_type = 'nutrition')::numeric / nullif(sum(line_total_piastres),0) nutrition_share,
                          sum(line_total_piastres) filter (where product_type = 'pt_pack')::numeric / nullif(sum(line_total_piastres),0) pt_share
                   from deal_items group by deal_id) mi on mi.deal_id = d.id
        where p.voided_at is null group by 1,2),
f as (select assigned_to_membership_id, count(*) filter (where status = 'open' and due_at < now()) overdue from follow_ups group by 1)
select reps.membership_id, reps.branch_id, reps.full_name, months.month,
       coalesce(l.leads,0) leads, coalesce(l.contacted,0) contacted, coalesce(l.onboarded,0) onboarded, coalesce(l.quoted,0) quoted, coalesce(l.won,0) won, coalesce(l.lost,0) lost,
       case when coalesce(l.leads,0) > 0 then round(100.0 * coalesce(l.won,0) / l.leads, 1) else 0 end conversion_pct,
       coalesce(l.sla_breaches,0) sla_breaches, round(l.median_response_min::numeric, 0) median_response_min,
       coalesce(r.won_revenue,0) won_revenue, coalesce(r.deals,0) deals_paid, round(coalesce(r.avg_discount_pct,0), 1) avg_discount_pct,
       round(coalesce(col.membership_collected,0))::bigint membership_collected, round(coalesce(col.nutrition_collected,0))::bigint nutrition_collected, round(coalesce(col.pt_collected,0))::bigint pt_collected,
       round(coalesce(col.membership_collected,0) * fn_setting_num('commission.sales_membership_pct', 0) / 100.0 + coalesce(col.nutrition_collected,0) * fn_setting_num('commission.sales_nutrition_pct', 0) / 100.0)::bigint commission_piastres,
       coalesce(f.overdue,0) overdue_follow_ups_now
from reps cross join months
left join l on l.owner_membership_id = reps.membership_id and l.month = months.month
left join r on r.rep_membership_id = reps.membership_id and r.month = months.month
left join col on col.rep_membership_id = reps.membership_id and col.month = months.month
left join f on f.assigned_to_membership_id = reps.membership_id;
create unique index on mv_rep_month (membership_id, month);

-- =====================================================================
-- mv_heatmap — branch × weekday × hour, last 8 weeks
-- =====================================================================
create materialized view mv_heatmap as
with grid as (
  select b.id as branch_id, g.dow, g.hr from branches b cross join (select d as dow, h as hr from generate_series(0,6) d cross join generate_series(5,23) h) g
),
s as (select branch_id, cairo_dow(scheduled_at) as dow, cairo_hour(scheduled_at) as hr, count(*) as n from sessions where scheduled_at > now() - interval '8 weeks' and status in ('completed','booked') group by 1,2,3),
v as (select branch_id, cairo_dow(checked_in_at) as dow, cairo_hour(checked_in_at) as hr, count(*) as n from visits where checked_in_at > now() - interval '8 weeks' group by 1,2,3)
select grid.branch_id, grid.dow, grid.hr, coalesce(s.n,0) as sessions, coalesce(v.n,0) as visits
from grid left join s using (branch_id, dow, hr) left join v using (branch_id, dow, hr);
create unique index on mv_heatmap (branch_id, dow, hr);

-- =====================================================================
-- mv_liability — deferred revenue: unburned credits × value, per branch and coach
-- =====================================================================
create materialized view mv_liability as
select c.home_branch_id branch_id, c.coach_membership_id, count(distinct c.id) clients,
       sum(l.qty_remaining) credits_remaining, sum(l.qty_remaining * l.per_session_value_piastres) liability_piastres,
       sum(l.qty_remaining) filter (where l.expires_at < now() + interval '30 days') credits_expiring_30d
from clients c join credit_lots l on l.client_id = c.id and l.status = 'active' and l.expires_at > now()
group by 1,2;
create unique index on mv_liability (branch_id, coach_membership_id) nulls not distinct;

-- =====================================================================
-- mv_client_adherence — per client, trailing 30 days: scheduled vs completed vs no-shows, last visit, credits
-- =====================================================================
create materialized view mv_client_adherence as
select c.id client_id, c.home_branch_id branch_id, c.coach_membership_id, c.full_name, c.status,
       count(s.id) filter (where s.status in ('completed','no_show')) scheduled_30d,
       count(s.id) filter (where s.status = 'completed') completed_30d,
       count(s.id) filter (where s.status = 'no_show') no_shows_30d,
       count(s.id) filter (where s.status = 'cancelled') cancelled_30d,
       case when count(s.id) filter (where s.status in ('completed','no_show')) > 0
            then round(100.0 * count(s.id) filter (where s.status = 'completed') / count(s.id) filter (where s.status in ('completed','no_show')), 0) else null end adherence_pct,
       count(s.id) filter (where s.unpaid) unpaid_sessions,
       (select count(distinct cairo_date(w.performed_at)) from workout_logs w where w.client_id = c.id and w.performed_at > now() - interval '30 days') workouts_logged_30d,
       c.last_visit_at, fn_credit_balance(c.id, c.coach_membership_id) credits_left_with_coach, fn_credit_balance(c.id) credits_left,
       (select min(l.expires_at) from credit_lots l where l.client_id = c.id and l.status = 'active' and l.qty_remaining > 0) next_expiry,
       c.risk_score
from clients c left join sessions s on s.client_id = c.id and s.scheduled_at > now() - interval '30 days' and s.scheduled_at <= now()
group by c.id;
create unique index on mv_client_adherence (client_id);

-- =====================================================================
-- mv_source_roi — lead source → won revenue, last 12 months
-- =====================================================================
create materialized view mv_source_roi as
select l.branch_id, coalesce(ls.name,'Unknown') as source, to_char(cairo_date(l.created_at), 'YYYY-MM') as month,
       count(*) leads, count(*) filter (where l.status = 'won') won,
       coalesce(sum(d.total_piastres), 0) won_revenue
from leads l left join lead_sources ls on ls.id = l.source_id
left join deals d on d.lead_id = l.id and d.status in ('partially_paid','paid')
where l.created_at > now() - interval '12 months'
group by 1,2,3;
create unique index on mv_source_roi (branch_id, source, month);

-- =====================================================================
-- retention: cohort by join month per branch (materialized nightly)
-- =====================================================================
create materialized view mv_retention_cohort as
with cohort as (select id client_id, home_branch_id branch_id, to_char(cairo_date(joined_at), 'YYYY-MM') as join_month from clients),
activity as (select client_id, to_char(cairo_date(checked_in_at), 'YYYY-MM') as month from visits group by 1,2)
select c.branch_id, c.join_month, count(distinct c.client_id) cohort_size,
       count(distinct a.client_id) filter (where a.month = to_char((to_date(c.join_month,'YYYY-MM') + interval '1 month'), 'YYYY-MM')) active_m1,
       count(distinct a.client_id) filter (where a.month = to_char((to_date(c.join_month,'YYYY-MM') + interval '2 month'), 'YYYY-MM')) active_m2,
       count(distinct a.client_id) filter (where a.month = to_char((to_date(c.join_month,'YYYY-MM') + interval '3 month'), 'YYYY-MM')) active_m3,
       count(distinct a.client_id) filter (where a.month = to_char((to_date(c.join_month,'YYYY-MM') + interval '6 month'), 'YYYY-MM')) active_m6
from cohort c left join activity a on a.client_id = c.client_id
group by 1,2;
create unique index on mv_retention_cohort (branch_id, join_month);

-- =====================================================================
-- refresh + schedule
-- =====================================================================
create or replace function fn_refresh_views(p_heavy boolean default false) returns void language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view concurrently mv_daily_branch;
  refresh materialized view concurrently mv_coach_month;
  refresh materialized view concurrently mv_rep_month;
  refresh materialized view concurrently mv_client_adherence;
  if p_heavy then
    refresh materialized view concurrently mv_heatmap;
    refresh materialized view concurrently mv_liability;
    refresh materialized view concurrently mv_source_roi;
    refresh materialized view concurrently mv_retention_cohort;
  end if;
end $$;

create or replace function fn_nightly() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_expired int; v_lapsed int; v_risk int; v_mat int;
begin
  -- nothing is ever deleted or anonymized: client and lead history is kept in full (decision 18)
  v_expired := fn_expire_credits();
  v_lapsed := fn_mark_lapsed();
  v_risk := fn_compute_risk_scores();
  v_mat := fn_materialize_sessions(cairo_date(now())) + fn_materialize_sessions(cairo_date(now()) + 1);
  perform fn_refresh_views(true);
  perform fn_emit_event('job.nightly', null, null, null, jsonb_build_object('expired', v_expired, 'lapsed', v_lapsed, 'risk_scored', v_risk, 'sessions_materialized', v_mat));
  return jsonb_build_object('expired', v_expired, 'lapsed', v_lapsed, 'risk_scored', v_risk, 'sessions_materialized', v_mat);
end $$;

-- Reminders and low-credit warnings: creates pending notifications; the notify Edge Function delivers them.
create or replace function fn_hourly_notifications() returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  perform fn_materialize_sessions(cairo_date(now()));
  perform fn_materialize_sessions(cairo_date(now()) + 1);
  -- session reminders at -24h and -2h (idempotent via notifications.data->>'session_id' + type)
  for r in
    select s.id, s.scheduled_at, c.profile_id, p.full_name coach_name,
           case when s.scheduled_at between now() + interval '23 hours' and now() + interval '25 hours' then 'session.reminder_24h'
                when s.scheduled_at between now() + interval '1 hour' and now() + interval '3 hours' then 'session.reminder_2h' end as kind
    from sessions s join clients c on c.id = s.client_id join memberships m on m.id = s.coach_membership_id join profiles p on p.id = m.profile_id
    where s.status = 'booked' and c.profile_id is not null
  loop
    if r.kind is not null and not exists (select 1 from notifications x where x.type = r.kind and x.data->>'session_id' = r.id::text) then
      perform fn_notify(r.profile_id, r.kind, 'Session ' || case when r.kind like '%24h' then 'tomorrow' else 'in 2 hours' end,
        to_char(r.scheduled_at at time zone 'Africa/Cairo', 'Dy DD Mon HH24:MI') || ' with ' || r.coach_name, jsonb_build_object('session_id', r.id), 'whatsapp');
      n := n + 1;
    end if;
  end loop;
  -- 14-day expiry heads-up (once per lot)
  for r in
    select l.id lot_id, l.client_id, l.qty_remaining, l.expires_at, c.profile_id, c.full_name, c.coach_membership_id
    from credit_lots l join clients c on c.id = l.client_id
    where l.status = 'active' and l.qty_remaining > 0 and l.expires_at between now() + interval '13 days' and now() + interval '15 days'
      and not exists (select 1 from notifications x where x.type = 'credits.expiring_14d' and x.data->>'lot_id' = l.id::text)
  loop
    if r.profile_id is not null then perform fn_notify(r.profile_id, 'credits.expiring_14d', r.qty_remaining || ' sessions expire in 2 weeks', 'Book them in or ask about a freeze', jsonb_build_object('lot_id', r.lot_id, 'client_id', r.client_id), 'whatsapp'); end if;
    perform fn_notify((select profile_id from memberships where id = r.coach_membership_id), 'credits.expiring_14d', r.full_name || ': ' || r.qty_remaining || ' sessions expire in 2 weeks', null, jsonb_build_object('lot_id', r.lot_id, 'client_id', r.client_id));
    n := n + 1;
  end loop;
  -- credits low / expiring within risk.expiring_days (one per client per week)
  for r in
    select c.id, c.profile_id, c.full_name, c.coach_membership_id, c.rep_membership_id, fn_credit_balance(c.id) bal,
           (select min(expires_at) from credit_lots l where l.client_id = c.id and l.status = 'active' and l.qty_remaining > 0) next_exp
    from clients c where c.status = 'active'
  loop
    if (r.bal between 1 and fn_setting_int('risk.low_credit_threshold', 2)) or (r.next_exp is not null and r.next_exp < now() + make_interval(days => fn_setting_int('risk.expiring_days', 7))) then
      if not exists (select 1 from notifications x where x.type = 'credits.low' and x.data->>'client_id' = r.id::text and x.created_at > now() - interval '7 days') then
        if r.profile_id is not null then perform fn_notify(r.profile_id, 'credits.low', 'Time to renew', r.bal || ' sessions left', jsonb_build_object('client_id', r.id), 'whatsapp'); end if;
        perform fn_notify((select profile_id from memberships where id = r.coach_membership_id), 'credits.low', r.full_name || ': ' || r.bal || ' credits left', 'Open the renewal conversation', jsonb_build_object('client_id', r.id));
        perform fn_notify((select profile_id from memberships where id = r.rep_membership_id), 'credits.low', r.full_name || ': ' || r.bal || ' credits left', 'Renewal opportunity', jsonb_build_object('client_id', r.id));
        n := n + 1;
      end if;
    end if;
  end loop;
  -- SLA breaches
  for r in select l.id, l.full_name, l.branch_id, m.profile_id from leads l join memberships m on m.id = l.owner_membership_id
           where l.first_contact_at is null and l.first_contact_due_at < now() and l.status = 'new'
             and not exists (select 1 from notifications x where x.type = 'lead.sla_breach' and x.data->>'lead_id' = l.id::text) loop
    perform fn_notify(r.profile_id, 'lead.sla_breach', 'SLA breached: ' || r.full_name, 'No first contact yet', jsonb_build_object('lead_id', r.id));
    perform fn_notify_role('sales_manager', r.branch_id, 'lead.sla_breach', 'SLA breached: ' || r.full_name, null, jsonb_build_object('lead_id', r.id));
    n := n + 1;
  end loop;
  return n;
end $$;

-- grants: views readable by staff (RLS does not apply to matviews; scope in the app by branch/membership)
revoke all on mv_daily_branch, mv_coach_month, mv_rep_month, mv_heatmap, mv_liability, mv_source_roi, mv_retention_cohort, mv_client_adherence from anon;
revoke execute on function fn_refresh_views(boolean), fn_nightly(), fn_hourly_notifications() from authenticated, anon;

-- Scoped accessors (SECURITY DEFINER) so the app never queries matviews directly with a user token.
create or replace function fn_dashboard_daily(p_from date, p_to date) returns setof mv_daily_branch language sql stable security definer set search_path = public as $$
  select * from mv_daily_branch where day between p_from and p_to and (is_top_management() or branch_id in (select my_branch_ids()))
$$;
create or replace function fn_dashboard_coaches(p_month text) returns setof mv_coach_month language sql stable security definer set search_path = public as $$
  select * from mv_coach_month where month = p_month and (is_top_management() or membership_id in (select my_membership_ids()) or has_role('head_coach', branch_id))
$$;
create or replace function fn_dashboard_reps(p_month text) returns setof mv_rep_month language sql stable security definer set search_path = public as $$
  select * from mv_rep_month where month = p_month and (is_top_management() or membership_id in (select my_membership_ids()) or has_role('sales_manager', branch_id))
$$;
create or replace function fn_dashboard_heatmap() returns setof mv_heatmap language sql stable security definer set search_path = public as $$
  select * from mv_heatmap where is_top_management() or (branch_id in (select my_branch_ids()) and (has_role('head_coach', branch_id) or has_role('sales_manager', branch_id)))
$$;
create or replace function fn_dashboard_liability() returns setof mv_liability language sql stable security definer set search_path = public as $$
  select * from mv_liability where is_top_management() or (branch_id in (select my_branch_ids()) and has_role('head_coach', branch_id)) or coach_membership_id in (select my_membership_ids())
$$;
create or replace function fn_dashboard_adherence(p_coach_membership_id uuid default null) returns setof mv_client_adherence language sql stable security definer set search_path = public as $$
  select * from mv_client_adherence
  where (p_coach_membership_id is null or coach_membership_id = p_coach_membership_id)
    and (is_top_management() or coach_membership_id in (select my_membership_ids()) or has_role('head_coach', branch_id) or has_role('sales_manager', branch_id))
$$;
create or replace function fn_dashboard_sources(p_month text) returns setof mv_source_roi language sql stable security definer set search_path = public as $$
  select * from mv_source_roi where month = p_month and (is_top_management() or has_role('sales_manager', branch_id))
$$;
create or replace function fn_dashboard_retention() returns setof mv_retention_cohort language sql stable security definer set search_path = public as $$
  select * from mv_retention_cohort where is_top_management() or (branch_id in (select my_branch_ids()) and (has_role('head_coach', branch_id) or has_role('sales_manager', branch_id)))
$$;
revoke select on mv_daily_branch, mv_coach_month, mv_rep_month, mv_heatmap, mv_liability, mv_source_roi, mv_retention_cohort, mv_client_adherence from authenticated;

-- live "today" panel for top management (Realtime-friendly, cheap)
create or replace function fn_today_live() returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_top_management() or has_role('head_coach') or has_role('sales_manager') then jsonb_build_object(
    'visits', (select count(*) from visits where cairo_date(checked_in_at) = cairo_date(now()) and (is_top_management() or branch_id in (select my_branch_ids()))),
    'sessions_completed', (select count(*) from sessions where cairo_date(scheduled_at) = cairo_date(now()) and status = 'completed' and (is_top_management() or branch_id in (select my_branch_ids()))),
    'sessions_booked_today', (select count(*) from sessions where cairo_date(scheduled_at) = cairo_date(now()) and (is_top_management() or branch_id in (select my_branch_ids()))),
    'unpaid_sessions_open', (select count(*) from sessions where unpaid and (is_top_management() or branch_id in (select my_branch_ids()))),
    'leads', (select count(*) from leads where cairo_date(created_at) = cairo_date(now()) and (is_top_management() or branch_id in (select my_branch_ids()))),
    'collected', (select coalesce(sum(p.amount_piastres),0) from payments p join deals d on d.id = p.deal_id where cairo_date(p.received_at) = cairo_date(now()) and p.voided_at is null and (is_top_management() or d.branch_id in (select my_branch_ids())))
  ) else '{}'::jsonb end
$$;

-- pg_cron schedule (extension available on Supabase; enable in the dashboard or via `create extension pg_cron`).
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('gymos-refresh-5min', '*/5 * * * *', $c$ select fn_refresh_views(false) $c$);
    perform cron.schedule('gymos-hourly-notifications', '5 * * * *', $c$ select fn_hourly_notifications() $c$);
    perform cron.schedule('gymos-nightly', '30 0 * * *', $c$ select fn_nightly() $c$);   -- 00:30 UTC = 03:30 Cairo in summer, 02:30 in winter (pg_cron runs in UTC)
    -- Delivery of pending notifications is done by the `notify` Edge Function. Schedule it from the Supabase dashboard
    -- (Integrations → Cron → HTTP request to the function URL every 5 minutes) or with pg_net:
    --   select cron.schedule('gymos-notify', '*/5 * * * *', $c$ select net.http_post(url := '<project>/functions/v1/notify', headers := '{"Authorization":"Bearer <service key from vault>"}'::jsonb) $c$);
  end if;
end $$;
