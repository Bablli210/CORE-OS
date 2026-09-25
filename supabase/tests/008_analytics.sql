-- GymOS M6 analytics tests: every tile equals the count/total of the rows it opens (all screens), PT tiers (33 → 30%,
-- 165 → 40% on all 165), a cancelled-after-completed session no longer counts, booked − collected = outstanding,
-- deferred = liability, targets, heatmap cells, scopes, the audit explorer.
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

create or replace function login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p::text,''), false),
         set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, false) $$;
create or replace function ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond then raise notice 'PASS %', msg; else raise exception 'FAIL %', msg; end if; end $$;
-- every tile of a screen compared with the rows it opens; returns the keys that disagree
create or replace function tile_mismatches(p_screen text, p_month text, p_scope uuid) returns text[] language sql as $$
  select coalesce(array_agg(t->>'key' || ' tile=' || coalesce(t->>'value', 'null') || ' rows=' || coalesce(r->>'total', 'null')), '{}')
  from jsonb_array_elements((fn_dashboard_tiles(p_screen, p_month, p_scope))->'tiles') t
  cross join lateral (select fn_dashboard_rows(t->>'key', p_month, p_scope) r) x
  where (t->>'value')::numeric is distinct from (r->>'total')::numeric
$$;

\set CEO '''00000000-0000-0000-0000-000000000001'''
\set KARIM '''00000000-0000-0000-0000-000000000010'''
\set MONA '''00000000-0000-0000-0000-000000000011'''
\set AHMED '''00000000-0000-0000-0000-000000000020'''
\set SARA '''00000000-0000-0000-0000-000000000023'''
\set LAILA '''00000000-0000-0000-0000-000000000025'''
\set MONA_M '''a0000000-0000-0000-0000-000000000011'''
\set SARA_M '''a0000000-0000-0000-0000-000000000023'''
\set MAHMOUD_M '''a0000000-0000-0000-0000-000000000022'''
\set LAILA_M '''a0000000-0000-0000-0000-000000000025'''
\set BRANCH_A '''b0000000-0000-0000-0000-00000000000a'''
\set BRANCH_B '''b0000000-0000-0000-0000-00000000000b'''

reset role;
select to_char(cairo_date(now()), 'YYYY-MM') as month \gset
select fn_refresh_views(true);
set role authenticated;

-- ---------------------------------------------------------------- every tile = its rows
select login(:CEO);
select ok(cardinality(tile_mismatches('admin', :'month', null)) = 0, 'N1 admin (both branches): every tile equals its rows');
select ok(cardinality(tile_mismatches('admin', :'month', :BRANCH_A)) = 0 and cardinality(tile_mismatches('admin', :'month', :BRANCH_B)) = 0, 'N2 admin per branch: every tile equals its rows');
select ok(cardinality(tile_mismatches('sales', :'month', :BRANCH_A)) = 0, 'N3 sales branch: every tile equals its rows');
select ok(cardinality(tile_mismatches('rep', :'month', :MONA_M)) = 0, 'N4 rep: every tile equals its rows');
select ok(cardinality(tile_mismatches('coach', :'month', :MAHMOUD_M)) = 0 and cardinality(tile_mismatches('coach', :'month', :SARA_M)) = 0, 'N5 coach: every tile equals its rows');

-- ---------------------------------------------------------------- money reconciles
select fn_dashboard_tiles('admin', :'month', null) as adm \gset
select ok((select (select (t->>'value')::bigint from jsonb_array_elements((:'adm'::jsonb)->'tiles') t where t->>'key' = 'admin.booked')
                - (select (t->>'value')::bigint from jsonb_array_elements((:'adm'::jsonb)->'tiles') t where t->>'key' = 'admin.collected_on_booked')
                = (select (t->>'value')::bigint from jsonb_array_elements((:'adm'::jsonb)->'tiles') t where t->>'key' = 'admin.outstanding')), 'N6 booked − collected = outstanding');
reset role;
select sum(qty_remaining * per_session_value_piastres) as liab from credit_lots where status = 'active' and expires_at > now() \gset
set role authenticated; select login(:CEO);
select ok((select (t->>'value')::bigint from jsonb_array_elements((:'adm'::jsonb)->'tiles') t where t->>'key' = 'admin.deferred') = :liab, 'N7 deferred = the liability view (remaining credits × value)');

-- ---------------------------------------------------------------- PT tiers: 33 → 30%, 165 → 40% applied to all 165
reset role;
insert into clients(id, home_branch_id, full_name, phone, coach_membership_id) values ('00000000-0000-0000-0009-000000000001', :BRANCH_B, 'Tier Fixture', '+201099999001', :LAILA_M);
insert into credit_lots(id, client_id, coach_membership_id, qty_issued, qty_remaining, per_session_value_piastres, tax_pct, net_per_session_value_piastres, expires_at)
values ('00000000-0000-0000-0009-00000000000a', '00000000-0000-0000-0009-000000000001', :LAILA_M, 400, 400, 40000, 14, 34400, now() + interval '90 days');
select count(*) as laila_now from sessions where coach_membership_id = :LAILA_M::uuid and credit_consumed and to_char(cairo_date(scheduled_at), 'YYYY-MM') = :'month' \gset
insert into sessions(client_id, coach_membership_id, branch_id, scheduled_at, status, credit_consumed, lot_id, outcome_recorded_at)
select '00000000-0000-0000-0009-000000000001', :LAILA_M, :BRANCH_B, now() - make_interval(mins => i), 'completed', true, '00000000-0000-0000-0009-00000000000a', now()
from generate_series(1, 33 - :laila_now) i;
select fn_refresh_views(false);
set role authenticated; select login(:LAILA);
select fn_dashboard_tiles('coach', :'month', :LAILA_M) as t33 \gset
select ok((:'t33'::jsonb)#>>'{meter,sessions}' = '33' and (:'t33'::jsonb)#>>'{meter,pct}' = '30', 'N8 33 sessions burned: tier 30%');
reset role;
insert into sessions(client_id, coach_membership_id, branch_id, scheduled_at, status, credit_consumed, lot_id, outcome_recorded_at)
select '00000000-0000-0000-0009-000000000001', :LAILA_M, :BRANCH_B, now() - make_interval(mins => 200 + i), 'completed', true, '00000000-0000-0000-0009-00000000000a', now()
from generate_series(1, 132) i;
select fn_refresh_views(false);
set role authenticated; select login(:LAILA);
select fn_dashboard_tiles('coach', :'month', :LAILA_M) as t165 \gset
select ok((:'t165'::jsonb)#>>'{meter,sessions}' = '165' and (:'t165'::jsonb)#>>'{meter,pct}' = '40'
          and (select (t->>'value')::bigint = round(((t->'sub'->>'net')::numeric) * 0.40) from jsonb_array_elements((:'t165'::jsonb)->'tiles') t where t->>'key' = 'coach.commission'),
          'N9 165 sessions burned: 40% applied to the whole month''s net delivered');
select ok(cardinality(tile_mismatches('coach', :'month', :LAILA_M)) = 0, 'N10 the commission tile equals its 165 rows × 40%');

-- ---------------------------------------------------------------- a session undone no longer counts (0002 counted consume rows)
select login(:AHMED);
reset role;
select id as undo from sessions where client_id = '00000000-0000-0000-0002-000000000001' and credit_consumed and to_char(cairo_date(scheduled_at), 'YYYY-MM') = :'month' order by scheduled_at desc limit 1 \gset
select credits_burned as before from mv_coach_month where membership_id = :MAHMOUD_M::uuid and month = :'month' \gset
set role authenticated; select login(:AHMED);
select fn_record_attendance(:'undo', 'cancelled');
reset role;
select fn_refresh_views(false);
select ok((select credits_burned = :before - 1 from mv_coach_month where membership_id = :MAHMOUD_M::uuid and month = :'month'), 'N11 completed → cancelled: the restored credit leaves the burned count');
select ok((select count(*) from credit_ledger where session_id = :'undo' and entry_type = 'consume') >= 1, 'N12 (the consume ledger row is still there: the ledger stays append-only)');

-- ---------------------------------------------------------------- targets
set role authenticated; select login(:MONA);
do $$ begin
  perform fn_save_target(to_char(cairo_date(now()), 'YYYY-MM'), 'membership', 'a0000000-0000-0000-0000-000000000011', 'won_revenue', 1);
  raise exception 'FAIL N13 a rep set a target';
exception when insufficient_privilege then raise notice 'PASS N13 only top management sets targets'; end $$;
select login(:CEO);
select fn_save_target(:'month', 'membership', :MONA_M, 'won_revenue', 7500000);
select fn_save_target(:'month', 'membership', :SARA_M, 'sessions_completed', 90);
select login(:MONA);
select ok((select (x->>'target')::numeric = 7500000 and x->>'name' = 'Mona Samir' and x ? 'actual' from jsonb_array_elements(fn_dashboard_targets(:'month')) x where x->>'scope_id' = :MONA_M),
          'N14 the rep sees her target with the actual');
select ok((select (t->>'target')::numeric = 7500000 from jsonb_array_elements((fn_dashboard_tiles('rep', :'month', :MONA_M))->'tiles') t where t->>'key' = 'rep.won_revenue'), 'N15 her won-revenue tile carries the target');
select ok(not exists (select 1 from jsonb_array_elements(fn_dashboard_targets(:'month')) x where x->>'scope_id' = :SARA_M), 'N16 a rep does not see a coach''s target');
select login(:SARA);
select ok((select (t->>'target')::numeric = 90 from jsonb_array_elements((fn_dashboard_tiles('coach', :'month', :SARA_M))->'tiles') t where t->>'key' = 'coach.sessions'), 'N17 the coach''s sessions tile carries her target');
select login(:CEO);
select ok(jsonb_array_length(fn_dashboard_targets(:'month', true)) >= 6 + 4 + 6, 'N18 the grid lists every branch metric, rep and coach');
select fn_save_target(:'month', 'membership', :SARA_M, 'sessions_completed', null);
select ok(not exists (select 1 from targets where scope_id = :SARA_M::uuid and period = :'month' and metric = 'sessions_completed'), 'N19 an empty value removes the target');

-- ---------------------------------------------------------------- heatmap cell = its rows
select login(:AHMED);
select dow, hr, sessions + visits as n from fn_dashboard_heatmap() where branch_id = :BRANCH_A order by sessions + visits desc limit 1 \gset
select ok(:n > 0 and ((fn_dashboard_rows('heatmap.cell', :'month', :BRANCH_A, jsonb_build_object('dow', :dow, 'hr', :hr)))->>'count')::int = :n,
          'N20 the busiest heatmap cell lists exactly its sessions and visits');

-- ---------------------------------------------------------------- scopes
select login(:SARA);
do $$ begin
  perform fn_dashboard_tiles('coach', to_char(cairo_date(now()), 'YYYY-MM'), 'a0000000-0000-0000-0000-000000000022');
  raise exception 'FAIL N21 a coach read another coach''s numbers';
exception when insufficient_privilege then raise notice 'PASS N21 a coach sees only her own numbers'; end $$;
select login(:AHMED);
select ok((fn_dashboard_tiles('coach', :'month', :SARA_M)) ? 'tiles', 'N22 the head coach sees his coaches'' numbers');
select login(:MONA);
do $$ begin
  perform fn_dashboard_rows('admin.booked', to_char(cairo_date(now()), 'YYYY-MM'), null);
  raise exception 'FAIL N23 a rep opened admin rows';
exception when insufficient_privilege then raise notice 'PASS N23 admin numbers are top management''s'; end $$;
select login(:KARIM);
select ok((fn_dashboard_tiles('sales', :'month', :BRANCH_B)) ? 'tiles', 'N24 the sales manager sees each branch he manages');
do $$ begin
  perform fn_audit_explorer();
  raise exception 'FAIL N25 the sales manager opened the audit explorer';
exception when insufficient_privilege then raise notice 'PASS N25 the audit explorer is top management''s'; end $$;
select login(:CEO);
select ok(jsonb_array_length((fn_audit_explorer('events', 'target'))->'rows') >= 3 and jsonb_array_length((fn_audit_explorer('audit', null, null, null, null, null, 5))->'rows') = 5,
          'N26 the audit explorer filters events by kind and lists audit rows');

-- ---------------------------------------------------------------- the weekly trend and the week per coach
select ok((select count(distinct week_start) = 12 from fn_dashboard_weekly(12)), 'N27 12-week trends per branch');
select login(:AHMED);
select ok((select count(*) = 12 * 3 from fn_dashboard_coach_weeks(:BRANCH_A)), 'N28 sessions per coach per week: 3 branch-A coaches × 12 weeks');

reset role;
drop function tile_mismatches(text, text, uuid); drop function login(uuid); drop function ok(boolean, text);
select 'ALL ANALYTICS TESTS PASSED' as result;
