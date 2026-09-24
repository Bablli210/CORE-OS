-- GymOS — 0003_supabase_privileges.sql
-- Supabase's default privileges grant ALL on every table and sequence created in `public` to `anon` and `authenticated`.
-- 0001/0002 were written for stock Postgres, where a new table has no grants, and they rely on that:
--   * anon must have no table access at all (the onboarding wizard goes through fn_submit_onboarding only);
--   * authenticated gets table-wide INSERT/UPDATE only where 0001 §19 says so, and column-level UPDATE on the
--     state-carrying tables (leads, clients, deals, deal_items, sessions, profiles, notifications) — docs/03 §9.
-- With Supabase's defaults, a table-level UPDATE grant overrides those column grants and RLS alone is left.
-- This migration resets `public` to exactly the grants 0001 §19 and 0002 declare, and stops later migrations'
-- tables and sequences from being auto-granted (grant them explicitly in the migration that creates them).
-- Function EXECUTE is left as 0001/0002 set it (Supabase's function default matches stock Postgres' PUBLIC execute).
-- service_role keeps its grants: it is used only by the Edge Functions listed in docs/03 §9.

-- 1. future tables and sequences created by migrations (run as postgres) get no automatic grants
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- 2. reset existing tables, views, materialized views and sequences
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- 3. re-apply 0001 §19 (verbatim)
grant select on all tables in schema public to authenticated;
grant insert, update, delete on memberships, settings, lead_sources, products, bundle_items, touches, follow_ups, coach_availability, exercises, program_templates, programs, program_days, program_exercises, workout_logs, set_logs, body_metrics, nutrition_plans, client_notes, targets, branches to authenticated;
grant insert on leads, deals, deal_items, profiles to authenticated;
grant delete on deal_items to authenticated;
grant update (full_name, email, phone, gender, date_of_birth, preferred_language, avatar_url) on profiles to authenticated;
grant update (full_name, email, source_id, interest_tags, referred_by_client_id, instagram_handle, consent_marketing, consent_content) on leads to authenticated;
grant update (full_name, email, gender, date_of_birth, injuries, instagram_handle, onboarding_responses, nutritionist_membership_id) on clients to authenticated;
grant update (discount_pct, discount_fixed_piastres, payment_plan, installments_count, notes, is_renewal, closer_membership_id) on deals to authenticated;
grant update (product_id, qty, provider_membership_id) on deal_items to authenticated;
grant update (notes) on sessions to authenticated;
grant update (read_at, status) on notifications to authenticated;
grant insert on notifications to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- 4. re-apply 0002: materialized views are read only through the fn_dashboard_* accessors
revoke select on mv_daily_branch, mv_coach_month, mv_rep_month, mv_heatmap, mv_liability, mv_source_roi, mv_retention_cohort, mv_client_adherence from authenticated;
