# PROGRESS

Living log. Claude Code updates this at the end of every milestone step. Newest at the top.

## Current milestone

M1 — Foundation: **built, awaiting review.** Do not start M2 until M1 is reviewed.

Acceptance (docs/05 M1) — each box is covered by an automated test (e2e at 390px and 1280px unless noted):
- [x] All six seed staff log in and land on the correct home (`e2e/auth.spec.ts`, one test per role)
- [x] Karim switches between branch A and B; the choice is remembered across reloads (`auth.spec.ts`)
- [x] Ahmed sees the Coach tabs and Team; as plain coach Team disappears; a Team link switches him back (`auth.spec.ts`)
- [x] Hassan logs in with phone OTP and sees `/c` with his name and sessions left with Mahmoud (`auth.spec.ts`)
- [x] Bell updates live when a notification is inserted via SQL; opening it marks it read (`notifications.spec.ts`)
- [x] `/admin/people` creates a branch-B sales rep who accepts the invite email, sets a password and logs in (`admin-people.spec.ts`)
- [x] Settings edit persists and `fn_setting_int('attendance.edit_window_hours', 24)` reflects it (`admin-settings.spec.ts`; also SQL test A2)
- [x] `01011112222` stores `+201011112222`; Saudi with the picker stores `+966…` (`src/components/phone-input.test.tsx`, `src/lib/phone.test.ts`; the +20 case also in the invite e2e)
- [x] `pnpm typecheck && pnpm lint && pnpm test` pass; `scripts/test-db.sh` passes (rule, admin and security suites)

How to run: `supabase start && supabase db reset && pnpm seed:auth && pnpm env:local && pnpm dev`. E2E: `pnpm test:e2e` (builds and starts the app; run on a freshly reset + seeded database).
Local logins: staff `*@gymos.local` / `gymos-dev`; clients by phone (`01110000001` = Hassan Ibrahim) with OTP `123456`.

## Decisions made during the build

- 2026-09-24 (M1) — **Staff invite uses the service role in a server action.** docs/05 M1 asks for "admin API via a server action"; CLAUDE.md rule 2 limits the service role to Edge Functions listed in docs/03 §9. Resolved by keeping the service role to the Auth admin API only (invite, and rollback of a failed invite), after an `is_top_management()` check with the caller's session; the profile and role are written by RPC as the caller. Listed in docs/03 §9. Alternative if you prefer the letter of rule 2: an `invite-staff` Edge Function (needs the edge-runtime container locally).
- 2026-09-24 (M1) — **Admin writes go through RPCs** (definition of done: "writes only through RPC"): `0004_m1_admin.sql` adds `fn_update_setting` (keeps the JSON type; validates commission tiers), `fn_create_staff_profile`, `fn_save_membership`, `fn_set_profile_active`, `fn_mark_notifications_read`; each emits an event (`setting.updated`, `staff.created`, `membership.saved`, `profile.activation_changed`). Also adds `notifications` to the Realtime publication. Tests: `supabase/tests/002_admin.sql`.
- 2026-09-24 (M1) — **Security: internal functions locked down (`0005_internal_functions.sql`).** 0001 granted EXECUTE on every function to `authenticated`, so any signed-in user could call internal helpers over the API — e.g. `fn_issue_credits` to give themselves sessions, `fn_notify` to message anyone, `fn_convert_lead`. EXECUTE is revoked on the internal helpers and jobs; the entry points still reach them (they run as the owner). `fn_end_freeze` stays callable but now checks sales manager / top management. Tests: `supabase/tests/003_security.sql`. docs/03 §9 updated.
- 2026-09-24 (M1) — **Active role.** The acted-as membership (role + branch) is remembered in an httpOnly cookie (`gymos_ctx`) set by `/context/[membershipId]`; default is the broadest role (head coach before coach, so Team shows). Each area (`/c`, `/coach`, `/sales`, `/admin`) resolves its own context; a role-limited page (Team, Queue) switches to the matching membership instead of refusing.
- 2026-09-24 (M1) — **Navigation.** Coach tabs follow docs/04 (Today · Clients · Programs · Numbers, + Team); "My week" is a secondary item in the desktop side nav and linked from Today, since docs/04 doesn't give it a tab. Added `/coach/programs`, `/sales/leads` and `/sales/deals` placeholders because docs/04 names those tabs. Front desk gets Today · New lead · Deals · Check-in. More than 5 tabs → the 5th slot is "More" (sales manager, top management on mobile).
- 2026-09-24 (M1) — **Local auth config.** Public sign-up off (`[auth] enable_signup = false`); `[auth.email] enable_signup` must stay true because the CLI maps it to "email provider enabled". Invites use a token-hash template (`supabase/templates/invite.html` → `/auth/confirm`) so the server verifies them; apply the same template on the hosted project. Site URL `http://localhost:3000`. Local rate limits raised for repeated e2e runs.

- 2026-09-24 — **Postgres 17 search_path.** Supabase runs Postgres 17 (the spec was tested on 16). PG 17 builds and refreshes materialized views with `search_path = pg_catalog, pg_temp`, so `0002_analytics.sql` failed to apply. Added `set search_path = public` to `fn_setting_int/bool/text/num` (0001) and `fn_pt_commission_pct` (0002). Edited in place with approval: neither migration had been applied to any hosted database.
- 2026-09-24 — **pgcrypto lives in `extensions` on Supabase.** `fn_issue_onboarding_token` now calls `extensions.gen_random_bytes` (0001:1068). Same reasoning as above.
- 2026-09-24 — **`0003_supabase_privileges.sql`.** Supabase's default privileges grant ALL on new `public` tables to `anon` and `authenticated`, which gave anon table access and overrode the column-level UPDATE protection of docs/03 §9. 0003 resets `public` to exactly the grants 0001 §19 / 0002 declare and stops future tables and sequences being auto-granted. **Every later migration must grant its new tables explicitly.**
- 2026-09-24 — **Seeded auth rows.** `seed.sql` inserts bare `auth.users` rows that Supabase Auth cannot see (NULL `instance_id`/`aud`/`role`/tokens, phone stored with `+`). `pnpm seed:auth` repairs them locally before using the admin API. seed.sql is unchanged.
- 2026-09-24 — **Local phone OTP.** `supabase/config.toml` enables phone login with a dummy Twilio provider (the CLI disables phone login without one) and test OTP `123456` for all 41 seeded client phones; nothing is ever sent. The real channel (WhatsApp, SMS fallback) is configured on the hosted project.
- 2026-09-24 — **shadcn/ui configured by hand** (components.json style new-york, base colour neutral, CSS variables from `src/styles/tokens.css`) because the build sandbox could not reach `ui.shadcn.com`. `pnpm dlx shadcn@latest add <component>` works normally on a developer machine.
- 2026-09-24 — **Tokens are enforced by lint.** ESLint rejects hex/rgb/oklch literals, Tailwind palette classes and arbitrary colours in `src/`.

## Deferred

- M1: the live bell subscribes to rows addressed to the profile; client rows queued on `client_id` before provisioning show in the list but don't push live (provision-client backfills `recipient_profile_id`, M3).
- M1: editing a person's name/phone and resending an invite are not in the People screen yet (not in the M1 list); invite again after deleting nothing — an existing email is refused with a clear message.
- M1: `/checkin` is a signed-in placeholder in the sales area (kiosk mode is M4).
- M1: `libphonenumber-js` metadata adds ~140 kB to pages with a phone field (login, people); revisit with the PWA budget in M5/M8.
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

- 2026-09-24 — **M1 Foundation.** Supabase helpers (`src/lib/supabase/{client,server,middleware,admin}.ts`), session middleware, `getMe()` / `useMe()` (profile, memberships, active role + branch, branch ids). `/login` (member phone + OTP, staff email + password), role routing from `/`, `/auth/confirm` + `/welcome` for invites, `/no-access`. `AppShell` (header with branch, role switcher, live bell, sign out; side nav ≥ md, bottom tabs + More below md) and a placeholder for every docs/04 route (title, job, milestone, onward link). `/notifications` with mark-as-read and deep links. `/c` shows the member's name, sessions left per coach and membership end. `/admin/people` (search, role filter, table/cards, invite, add/edit/deactivate roles, auto coach role for head coaches). `/admin/settings` (grouped, typed editors, commission tier table). `PhoneInput` (+20 default, E.164). UI primitives in `src/components/ui` (shadcn-style, tokens only). Migrations 0004 (admin RPCs, Realtime) and 0005 (security). Tests: 188 SQL assertions, Vitest units + PhoneInput component test, Playwright e2e for every acceptance box at 390px and 1280px.
- 2026-09-24 — **M1 kickoff.** Next.js 15 (App Router, TS strict), Tailwind v4, shadcn/ui config, TanStack Query provider, react-hook-form + zod, `@supabase/ssr`, Vitest, Playwright (390px + 1280px), pnpm. `src/styles/tokens.css` (neutral colour/spacing/radius/type/motion). `t()` with en/ar catalogs and RTL `dir()`. Folder layout per CLAUDE.md. Local Supabase: 0001 + 0002 + 0003 apply, seed loads, `scripts/test-db.sh` → 156 assertions, ALL RULE TESTS PASSED. `src/lib/database.types.ts` generated. `pnpm seed:auth` sets staff passwords and client phone login; verified staff password login, client OTP login and RLS scoping over the REST API.
