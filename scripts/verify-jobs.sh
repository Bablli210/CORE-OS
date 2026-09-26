#!/usr/bin/env bash
# Confirms the scheduled work is wired on a database (docs/05 M7): pg_cron and pg_net installed, the four GymOS
# schedules present and active (the three from 0002/0007 — refresh, hourly, nightly — plus notify from 0012), their
# recent runs succeeded, the nightly job wrote job.nightly with its counts, and the notify Vault secrets exist.
# Read-only. Usage:
#   scripts/verify-jobs.sh                          # the local stack
#   SUPABASE_DB_URL=postgresql://... scripts/verify-jobs.sh   # the hosted project (Dashboard → Connect → session pooler)
set -euo pipefail
cd "$(dirname "$0")/.."
DB_URL=${SUPABASE_DB_URL:-$(supabase status -o env 2>/dev/null | grep '^DB_URL' | cut -d= -f2- | tr -d '"')}
[ -n "$DB_URL" ] || { echo "No database: set SUPABASE_DB_URL or run supabase start." >&2; exit 2; }

psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q <<'SQL'
\pset footer off
\echo '== extensions'
select extname, extversion from pg_extension where extname in ('pg_cron', 'pg_net', 'supabase_vault') order by 1;

\echo '== schedules (UTC)'
select jobname, schedule, active, command from cron.job where jobname like 'gymos-%' order by jobname;

\echo '== last 24 hours of runs'
select j.jobname, count(d.runid) as runs, count(*) filter (where d.status = 'succeeded') as ok,
       count(*) filter (where d.status = 'failed') as failed, max(d.start_time) as last_run,
       (array_agg(d.return_message order by d.start_time desc) filter (where d.status = 'failed'))[1] as last_error
from cron.job j left join cron.job_run_details d on d.jobid = j.jobid and d.start_time > now() - interval '24 hours'
where j.jobname like 'gymos-%' group by j.jobname order by j.jobname;

\echo '== nightly job (runs at 03:30 Cairo)'
select occurred_at, occurred_at at time zone 'Africa/Cairo' as cairo_time, payload
from events where type = 'job.nightly' order by occurred_at desc limit 3;

\echo '== notify wiring (Vault secret names only; values are never printed)'
select name, created_at from vault.secrets where name in ('notify_url', 'notify_secret') order by name;

\echo '== outbox'
select channel, status, count(*) from notifications where channel <> 'in_app' group by 1, 2 order by 1, 2;

do $$
declare missing text[];
begin
  select array_agg(x) into missing from unnest(array['pg_cron', 'pg_net']) x where not exists (select 1 from pg_extension where extname = x);
  if missing is not null then raise exception 'MISSING extensions: %', missing; end if;
  select array_agg(x) into missing from unnest(array['gymos-refresh-5min', 'gymos-hourly-notifications', 'gymos-nightly', 'gymos-notify']) x
   where not exists (select 1 from cron.job where jobname = x and active);
  if missing is not null then raise exception 'MISSING or inactive schedules: %', missing; end if;
  if (select count(*) from vault.secrets where name in ('notify_url', 'notify_secret')) < 2 then
    raise exception 'notify is not configured: add the notify_url and notify_secret Vault secrets (docs/03 §9)';
  end if;
  raise notice 'OK: pg_cron, pg_net, 4 active schedules, notify configured';
end $$;
SQL
