# PROGRESS

Living log. Claude Code updates this at the end of every milestone step. Newest at the top.

## Current milestone

M1 — Foundation. Kickoff done (scaffold, local database, types, seed logins); the M1 build itself (docs/05 "M1 — Foundation") has not started.

M1 build order (from the M1 prompt), each step committed as `M1: …`:
- [ ] Supabase client helpers `src/lib/supabase/{server,client,middleware}.ts` and `useMe()` (profile + memberships + active role + branch ids)
- [ ] `/login`: staff email + password, client phone + OTP; route by role (client → `/c`, coach/head_coach → `/coach`, sales roles → `/sales`, top_management → `/admin`); role switcher for multi-role users
- [ ] `AppShell` with role-specific nav (bottom tabs on mobile, side nav on desktop) and placeholder pages for every route in docs/04
- [ ] `/notifications` with mark-as-read; bell badge via Realtime on the user's own `notifications` rows
- [ ] `/admin/people` (list, invite staff by email via server action, edit memberships, deactivate; show the auto-created coach membership for head coaches)
- [ ] `/admin/settings` (every `settings` row grouped by prefix, typed inline editors, table editor for `commission.pt_tiers`)
- [ ] `PhoneInput` (country picker, default +20, stores E.164 via `libphonenumber-js`)
- [ ] Playwright: one login test per role on seed data; all M1 acceptance boxes in docs/05

M1 acceptance (docs/05): all six seed staff land on the right home · Karim switches branch A/B · Ahmed sees Coach tabs + Team · Hassan logs in by OTP and sees `/c` with his balance · bell updates live · `/admin/people` creates a branch-B rep who can log in · settings edit persists and `fn_setting_int` reflects it · `01011112222` → `+201011112222`, Saudi → `+966…` · `pnpm typecheck && pnpm lint && pnpm test` pass.

Local logins after `supabase db reset && pnpm seed:auth`: staff `*@gymos.local` / `gymos-dev`; clients by phone (`+201110000001` = Hassan Ibrahim) with OTP `123456`.

## Decisions made during the build

- 2026-09-24 — **Postgres 17 search_path.** Supabase runs Postgres 17 (the spec was tested on 16). PG 17 builds and refreshes materialized views with `search_path = pg_catalog, pg_temp`, so `0002_analytics.sql` failed to apply. Added `set search_path = public` to `fn_setting_int/bool/text/num` (0001) and `fn_pt_commission_pct` (0002). Edited in place with approval: neither migration had been applied to any hosted database.
- 2026-09-24 — **pgcrypto lives in `extensions` on Supabase.** `fn_issue_onboarding_token` now calls `extensions.gen_random_bytes` (0001:1068). Same reasoning as above.
- 2026-09-24 — **`0003_supabase_privileges.sql`.** Supabase's default privileges grant ALL on new `public` tables to `anon` and `authenticated`, which gave anon table access and overrode the column-level UPDATE protection of docs/03 §9. 0003 resets `public` to exactly the grants 0001 §19 / 0002 declare and stops future tables and sequences being auto-granted. **Every later migration must grant its new tables explicitly.**
- 2026-09-24 — **Seeded auth rows.** `seed.sql` inserts bare `auth.users` rows that Supabase Auth cannot see (NULL `instance_id`/`aud`/`role`/tokens, phone stored with `+`). `pnpm seed:auth` repairs them locally before using the admin API. seed.sql is unchanged.
- 2026-09-24 — **Local phone OTP.** `supabase/config.toml` enables phone login with a dummy Twilio provider (the CLI disables phone login without one) and test OTP `123456` for all 41 seeded client phones; nothing is ever sent. The real channel (WhatsApp, SMS fallback) is configured on the hosted project.
- 2026-09-24 — **shadcn/ui configured by hand** (components.json style new-york, base colour neutral, CSS variables from `src/styles/tokens.css`) because the build sandbox could not reach `ui.shadcn.com`. `pnpm dlx shadcn@latest add <component>` works normally on a developer machine.
- 2026-09-24 — **Tokens are enforced by lint.** ESLint rejects hex/rgb/oklch literals, Tailwind palette classes and arbitrary colours in `src/`.

## Deferred

- Doc inconsistencies found at kickoff, not yet resolved in `docs/` (decide, then propagate):
  - CLAUDE.md rule 6 says `fn_convert_lead` creates the `auth.users` row; docs/03 §9 and the SQL have `provision-client` do it.
  - "Nothing is ever deleted" vs `fn_upsert_schedule_slot` / `fn_end_schedule_slot` deleting future *booked* sessions.
  - docs/01 §4.3 (review inbound leads with missing phone / suspected duplicate) vs docs/06 #10 and `fn_create_lead` (one global `leads.review_required`, default off).
  - docs/05 says the local OTP appears in Inbucket/console; it doesn't — see the test-OTP decision above.
  - CLAUDE.md folder layout puts `database.types.ts` in `lib/supabase/`; the naming rule and kickoff put it in `src/lib/`. It is in `src/lib/`.
  - Seed has 41 clients (40 + Adel Nasser for the kiosk case); CLAUDE.md says 40.
  - M6 prompt refers to "dataviz guidance in CLAUDE.md's tokens file", which doesn't exist.
- `scripts/test-db.sh` leaves its test data in the database; run `supabase db reset && pnpm seed:auth` afterwards to get back to the clean demo.

## Shipped

- 2026-09-24 — **M1 kickoff.** Next.js 15 (App Router, TS strict), Tailwind v4, shadcn/ui config, TanStack Query provider, react-hook-form + zod, `@supabase/ssr`, Vitest, Playwright (390px + 1280px), pnpm. `src/styles/tokens.css` (neutral colour/spacing/radius/type/motion). `t()` with en/ar catalogs and RTL `dir()`. Folder layout per CLAUDE.md. Local Supabase: 0001 + 0002 + 0003 apply, seed loads, `scripts/test-db.sh` → 156 assertions, ALL RULE TESTS PASSED. `src/lib/database.types.ts` generated. `pnpm seed:auth` sets staff passwords and client phone login; verified staff password login, client OTP login and RLS scoping over the REST API.
