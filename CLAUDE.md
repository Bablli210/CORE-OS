# GymOS — project instructions for Claude Code

Internal operating system for a two-branch gym: sales pipeline, coaching, credits, attendance, client training logs and role-based analytics. Web first (installable PWA), native mobile later on the same API. Branding is applied at the end; build with neutral design tokens.

Read `docs/` before touching anything. The docs are the source of truth; this file is the summary and the working rules.

- `docs/01-PRD.md` — roles, features, decisions, non-goals
- `docs/02-DATA-MODEL.md` — every table, its purpose and invariants
- `docs/03-BUSINESS-RULES.md` — state machines, credits, attendance, attribution, permissions matrix
- `docs/04-SCREENS.md` — screen inventory per role, one job per screen
- `docs/05-BUILD-PLAN.md` — milestones, acceptance criteria, and the prompt for each milestone
- `docs/06-DECISIONS.md` — defaults chosen for open questions; change here, then propagate
- `supabase/migrations/` — the schema, RLS and core functions. Already written and tested. Extend with new numbered migrations; never edit an applied migration.

## Stack (fixed)

- Next.js 15 (App Router, TypeScript strict, Server Components by default), Tailwind, shadcn/ui, TanStack Query for client-side data, TanStack Table, Recharts for charts, react-hook-form + zod for forms.
- Supabase: Postgres, Auth, Row Level Security, Realtime, Edge Functions, Storage. `supabase` CLI for local dev (`supabase start`), migrations in `supabase/migrations`.
- Deployed on Vercel. PWA via `@serwist/next`. Timezone for all business logic: `Africa/Cairo`. Currency: EGP, stored as integer piastres (`amount_piastres`), displayed as EGP.
- Package manager: pnpm (workspace). Mobile: Expo (SDK 57, expo-router) in `apps/mobile` on the same Supabase and the same `packages/api`. Tests: Vitest (unit), Playwright (e2e), SQL rule tests in `supabase/tests/*.sql` (psql scripts that raise on failure; run with `scripts/test-db.sh`).
- Language: English UI first; all strings go through `t()` from day one so Arabic can be added later. Layout must survive RTL (use logical CSS properties: `ps-`, `pe-`, `start`, `end`).

## Architecture rules

1. Business rules live in the database, not in React. Credits, attendance, deal approval, assignment and audit are Postgres functions (`public.fn_*`) called via RPC. The UI never writes to `credit_ledger`, `sessions`, or `deals.status` directly (column-level grants enforce this; see docs/03 §9). If you need a new rule, write a migration with a function and a test in `supabase/tests/`.
2. RLS is the permission system. Every table has RLS enabled; policies use `public.my_roles()` and `public.my_branch_ids()`. Never use the service-role key in code that runs on behalf of a user. Edge Functions that must bypass RLS (jobs, webhooks) are the only exception and must be listed in `docs/03-BUSINESS-RULES.md` §9.
3. Every state change writes an `events` row (`fn_emit_event`). Dashboards read from `events` and materialized views, never from ad-hoc joins in components.
4. One person, many memberships. `profiles` is the person; `memberships` is (profile, role, branch). A head coach also has a `coach` membership. The sales manager has memberships in both branches. Always check role via membership, never via a column on the profile.
4b. A PT pack belongs to one coach (`credit_lots.coach_membership_id`, set from the deal item's `provider_membership_id`). Balances are per coach; sessions burn only that coach's lots. There is no client booking: coaches keep a weekly schedule (`schedule_slots`) and the day's sessions are materialized from it. A session delivered on zero credits is `unpaid` and flags sales; the next pack settles it. Nothing is ever deleted or anonymized.
5. Money is never computed in the client. Deal totals, discounts and per-session value come from `fn_price_deal` and are stored on the deal at approval time.
6. Leads are not users. A lead gets an `auth.users` row only when `fn_convert_lead` runs (deal paid). The onboarding wizard is a public route protected by a signed token, not a login.
7. Mobile-first layout. Every screen must be usable at 390px wide with one hand. Primary action is a full-width button at the bottom on mobile. Tables become cards below `md`.
8. No dead ends. Every empty state names the next action and links to it. Every error names what to do.
9. Feature flags via a `settings` table (`key`, `value jsonb`), not env vars, so top management can toggle round-robin, no-show deduction, etc. from the admin screen.
10. Do not add a dependency without a one-line reason in `docs/06-DECISIONS.md`.

## Working rules for Claude Code

- Start every session by reading `docs/05-BUILD-PLAN.md` and `PROGRESS.md`. Work on the current milestone only. When a milestone's acceptance criteria pass, update `PROGRESS.md` (what shipped, what's deferred, any decision made) and stop for review.
- Before writing a screen, list the RPCs and queries it needs. If a rule is missing from the database, add the migration first, then the screen.
- Run `pnpm typecheck && pnpm lint && pnpm test && scripts/test-db.sh` before declaring anything done. Run `supabase db reset` after changing migrations and confirm `supabase/seed.sql` still loads.
- When a request conflicts with `docs/`, stop and say so; do not silently pick one.
- Keep components small: a page file composes feature components from `src/features/<domain>/`. No component over ~200 lines. Lay screens out with `apps/web/src/components/layout.tsx` (PageHeader, Section, RowList, SummaryStrip, PageTabs, Facts) so every screen reads the same way. Data access (RPC queries, query hooks) lives in `packages/api` and is shared by both apps; nothing there may import react-dom, next or react-native.
- Naming: tables `snake_case` plural, functions `fn_verb_noun`, enums `*_status` / `*_type`, TS types generated with `pnpm db:types` (→ `packages/api/database.types.ts`) after every migration.
- Seed data (`supabase/seed.sql`) must always produce a working demo: 2 branches, all roles, 6 coaches, 4 reps, 40 clients, weekly slots and 60 days of sessions from them, some clients out of credits. Use it for every screenshot and e2e test.
- Never store phone numbers in more than one format. Normalize to E.164 (`+20...`) on input with `libphonenumber-js`.
- Commit after each milestone step with a message that names the milestone (`M2: deal approval flow`).

## Folder layout

pnpm workspace since M8 (`pnpm-workspace.yaml`: `apps/*`, `packages/*`). Root scripts run every package (`pnpm typecheck`, `pnpm lint`, `pnpm test`); CI (`.github/workflows/ci.yml`) runs them plus the SQL and e2e suites on every commit.

```
apps/
  web/                      # Next.js app (@gymos/web)
    src/app/                # routes (App Router). Route groups per role: (client) (coach) (sales) (admin)
    src/features/<domain>/  # components/ and web-only hooks (me-context, media queries, program builder draft)
    src/components/ui/      # shadcn
    src/lib/                # supabase (server.ts, client.ts → registers with @gymos/api), platform.ts (web storage/IndexedDB)
    src/styles/tokens.css   # the ONLY design tokens (mobile's theme is generated from it)
  mobile/                   # Expo app (@gymos/mobile, SDK 57, expo-router): client app + coach Today/Clients/Schedule
    app/                    # routes: login, (coach) today/clients/schedule, (client) home/workout/credits
    src/                    # auth/session, lib (supabase, platform, push), theme (tokens.ts generated), ui, features
packages/
  api/                      # @gymos/api — shared by web and mobile, zero React-DOM: supabase.ts (client registry),
                            # database.types.ts, platform.ts, and per domain the RPC queries, query hooks, zod schemas
  i18n/                     # @gymos/i18n — t(), en.json, ar.json (empty until later)
supabase/
  migrations/               # numbered, immutable once applied
  functions/                # Edge Functions: provision-client, notify, whatsapp-webhook (+ _shared providers)
  seed.sql
  tests/                    # SQL rule tests (001_rules.sql covers the core loop)
e2e/                        # Playwright: web (390/1280) and e2e/mobile (the Expo app's web build)
docs/                       # the spec
PROGRESS.md                 # living log, updated at every milestone
```

## Definition of done for any screen

- Works at 390px and 1280px. Keyboard accessible. Loading, empty and error states present.
- Reads only through RLS-scoped queries; writes only through RPC or an Edge Function.
- Has at least one Playwright test that runs against seed data.
- Strings through `t()`. No hard-coded colors; use tokens from `apps/web/src/styles/tokens.css` (the Expo app reads `apps/mobile/src/theme/tokens.ts`, generated from it with `pnpm --filter @gymos/mobile tokens`).
