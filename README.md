# GymOS spec package — start here

This folder is everything Claude Code needs to build the gym system. Drop it into an empty repo and run the kickoff prompt from `docs/05-BUILD-PLAN.md`.

## What's in the box

| File | What it is | When Claude Code uses it |
|---|---|---|
| `CLAUDE.md` | Project rules: stack, architecture, working rules, definition of done | Every session, automatically |
| `PROGRESS.md` | Living log of what's shipped and what's next | Start of every session |
| `docs/01-PRD.md` | Product requirements: roles, features, non-goals | Milestone planning |
| `docs/02-DATA-MODEL.md` | Every table with purpose, key columns, invariants | Any data work |
| `docs/03-BUSINESS-RULES.md` | State machines, credit rules, attendance, attribution, permissions matrix | Any rule or permission work |
| `docs/04-SCREENS.md` | Screen inventory per role, one job per screen | Any UI work |
| `docs/05-BUILD-PLAN.md` | Milestones with acceptance criteria and a ready prompt for each | Every milestone |
| `docs/06-DECISIONS.md` | Your answers to the open questions, mapped to settings; 3 numbers to fill in later | Before M1 |
| `supabase/migrations/0001_init.sql` | Full schema, enums, RLS, column-level write protection, ~45 rule functions (schedule, attendance, coach-bound packs, unpaid sessions, approvals). Tested on Postgres 16 | M1 onward, applied as-is |
| `supabase/migrations/0002_analytics.sql` | Materialized views, dashboard accessors, hourly + nightly jobs, pg_cron schedule | M6 |
| `supabase/seed.sql` | Demo data: 2 branches, all roles, clients, sessions | Local dev and e2e tests |
| `supabase/tests/001_rules.sql` | 157 assertions covering the whole core loop, RLS and write protection, run with `scripts/test-db.sh` | CI and after any migration |
| `scripts/test-db.sh` | Resets the local database and runs the SQL tests | CI and after any migration |

## Setup in 10 minutes

1. Create an empty GitHub repo `gymos`, clone it, copy this folder's contents into it.
2. Open `docs/06-DECISIONS.md`. It records your answers and the three numbers to fill in later (sales commission rate, expiry days per pack, freeze rules). The migrations encode the same values in the `settings` table; the file says which key to change.
3. Install: Node 20+, pnpm, Docker Desktop, Supabase CLI (`brew install supabase/tap/supabase` or `npm i -g supabase`).
4. In the repo root, run `claude` and paste the **Kickoff prompt** from `docs/05-BUILD-PLAN.md`. It scaffolds the app, applies the migrations, loads the seed, and stops for review.
5. Then work milestone by milestone with the prompts in the same file. Do not skip M1–M3 review; everything after depends on them.

## How the build is staged

- M1 Foundation: auth, roles, branches, layout shell, seed. You can log in as every role.
- M2 Sales: lead capture, onboarding wizard, review, assignment, follow-ups, pipeline.
- M3 Money: packages, deals with the PT pack recorded under a coach, approval, payments, credits, expiry extension, commission report.
- M4 Coaching: the coach's weekly schedule, Today with attendance, unpaid sessions → instant sales flag, program builder, head coach view of every schedule.
- M5 Client app: today, program, logging, credits, progress.
- M6 Analytics: dashboards per role, heatmap, targets, risk scores.
- M7 Automations: notifications, WhatsApp, renewal loop, freezes, audit.
- M8 Mobile: PWA hardening, then Expo shell reusing the API.

Each milestone ends with acceptance criteria that you can check by hand with the seed users. If it doesn't pass, don't move on.

## Things only you can do

- Create the Supabase project and the Vercel project (Claude Code can do both through the CLIs if you log in first).
- Get a WhatsApp Business API provider account (M7). Until then, notifications are in-app only.
- Decide the package catalog, prices and expiry days (M3 seed has placeholders).
- Fill in the three placeholder numbers in `docs/06-DECISIONS.md` when you have them (the admin Settings screen can change them later without code).
