-- GymOS — 0007_schedule_jobs.sql
-- 0002 schedules its jobs only "if pg_cron is installed", and nothing installed it, so the dashboards' materialized
-- views were never refreshed (M2's /sales/numbers and /sales/team read mv_rep_month). Install pg_cron and register the
-- same three schedules as 0002 (idempotent: re-running replaces them by name).
create extension if not exists pg_cron;

do $$
declare j text;
begin
  foreach j in array array['gymos-refresh-5min', 'gymos-hourly-notifications', 'gymos-nightly'] loop
    if exists (select 1 from cron.job where jobname = j) then perform cron.unschedule(j); end if;
  end loop;
  perform cron.schedule('gymos-refresh-5min', '*/5 * * * *', $c$ select public.fn_refresh_views(false) $c$);
  perform cron.schedule('gymos-hourly-notifications', '5 * * * *', $c$ select public.fn_hourly_notifications() $c$);
  perform cron.schedule('gymos-nightly', '30 0 * * *', $c$ select public.fn_nightly() $c$);   -- 00:30 UTC = 03:30 Cairo (summer)
end $$;
