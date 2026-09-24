# 05 — Build plan and Claude Code prompts

Eight milestones. Each has acceptance criteria you check by hand with the seed users, and a prompt to paste into Claude Code. Do not start a milestone until the previous one passes; every later milestone leans on the earlier ones.

Seed logins (local, after `pnpm seed:auth`): `ceo@gymos.local`, `sales.manager@gymos.local`, `rep1.a@gymos.local`, `headcoach.a@gymos.local`, `coach1.a@gymos.local`, `desk.a@gymos.local` (password `gymos-dev` for all). Client login: phone `+201110000001` (Hassan Ibrahim) with the local OTP shown in the Supabase Inbucket/console.

---

## Kickoff prompt (paste once, in the empty repo that contains this folder)

```
Read CLAUDE.md, then docs/01 through docs/06, then supabase/migrations and supabase/seed.sql. Do not write app code yet.

1. Summarize back to me in 15 lines: the roles, the core loop, and the 5 architecture rules you will follow. Flag anything in the docs that contradicts itself.
2. Scaffold the project exactly as CLAUDE.md's folder layout: Next.js 15 App Router + TypeScript strict, Tailwind, shadcn/ui (init with the neutral theme), TanStack Query, react-hook-form + zod, @supabase/ssr, Vitest, Playwright, pnpm. Add `src/styles/tokens.css` with CSS variables for color/spacing/radius (neutral palette; branding comes later) and use only tokens in components.
3. Initialize Supabase locally (`supabase init`, `supabase start`). Keep the migrations I provided untouched. Run `supabase db reset` and confirm seed.sql loads. Run `psql ... -f supabase/tests/001_rules.sql` and confirm it ends with ALL RULE TESTS PASSED. If anything fails, tell me, don't patch the migration.
4. Generate types: `supabase gen types typescript --local > src/lib/database.types.ts`.
5. Write `scripts/seed-auth.ts` (run as `pnpm seed:auth`) that uses the Supabase admin API (service role, local only) to set password `gymos-dev` for every seeded staff email and enable phone auth for seeded clients.
6. Create PROGRESS.md entries for M1 and stop. Show me the tree and the commands to run.
```

---

## M1 — Foundation (auth, roles, shell)

Goal: log in as any seeded user and land on the right home screen with the right navigation.

Build:
- `/login`: staff email+password; client phone+OTP (Supabase phone auth; local dev shows OTP in console). After login, read memberships and route: client → `/c`, coach/head_coach → `/coach`, sales roles → `/sales`, top_management → `/admin`. Multi-role users get the role switcher.
- `AppShell`: header (branch name, role switcher, notification bell with unread count via Realtime on `notifications`), bottom tab bar (mobile) / side nav (desktop) per role from `docs/04-SCREENS.md`.
- `src/lib/supabase/{server,client,middleware}.ts` with cookie-based sessions; a `useMe()` hook exposing profile + memberships + active role + branch ids.
- Empty placeholder pages for every route in `docs/04-SCREENS.md` (title + EmptyState) so navigation is complete.
- `/notifications` list with mark-as-read.
- `/admin/people` (top management): list profiles + memberships, invite staff by email (admin API via a server action), edit role/branch/capacity/specialties/discount allowance, deactivate. Enforce: head coach gets coach membership (the DB trigger does it; the UI should show it).
- `/admin/settings`: list every `settings` row grouped by prefix with inline edit (jsonb value editor with type detection: boolean toggle, number, text, and a small table editor for `commission.pt_tiers`).
- `PhoneInput` with a country-code picker (default Egypt, +20) used everywhere a phone is typed; stores E.164.

Acceptance:
- [ ] All six seed staff log in and land on the correct home. Karim (sales manager) switches between branch A and B contexts. Ahmed (head coach A) sees both Coach tabs and the Team tab.
- [ ] Client Hassan logs in with phone OTP and sees `/c` with his name and credit balance.
- [ ] Notification bell updates live when a notification is inserted for the logged-in user (insert one via SQL to test).
- [ ] `/admin/people` can create a new sales rep in branch B who can then log in.
- [ ] Settings edit persists and `fn_setting_int('attendance.edit_window_hours', 24)` reflects the change.
- [ ] Typing a local number `01011112222` stores `+201011112222`; a Saudi number with the picker stores `+966…`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass; one Playwright test logs in as each role.

Prompt:
```
Milestone M1 from docs/05-BUILD-PLAN.md. Read PROGRESS.md first. Build everything under "M1 — Foundation", in this order: supabase client helpers and useMe(), login + role routing, AppShell with role-specific nav and placeholder pages, notifications (Realtime subscription on the user's own rows), admin people, admin settings, PhoneInput. Follow CLAUDE.md's definition of done for each screen. When all acceptance boxes pass, update PROGRESS.md and stop for my review. Do not start M2.
```

---

## M2 — Sales

Goal: a rep captures a lead in 30 seconds, the lead completes onboarding on their phone, the manager assigns, the rep works the pipeline.

Build: `/sales` Today, `/sales/leads/new` (dup check as you type via `fn_normalize_phone` + a lookup RPC), `/sales/pipeline` (kanban, stage tabs on mobile), `/sales/leads/[id]` (touches timeline, follow-ups, resend link, mark lost with reason sheet), `/onboard/[token]` public wizard (8 steps, saves each step through `fn_submit_onboarding`, Arabic-ready layout, works on 360px), `/sales/queue` and `/sales/team` for the manager (assign, round robin, review, rotation pause, SLA breaches, stale leads), `/sales/numbers` (basic tiles from `fn_dashboard_reps`). WhatsApp deep links (`wa.me/<E.164>?text=`) with a prefilled onboarding link template.

Acceptance:
- [ ] Mona creates a lead with a duplicate phone → sees the existing record, no duplicate created.
- [ ] Front desk creates a lead → appears in Karim's queue; "Round robin all" assigns alternately to Mona and Youssef; pausing Youssef makes the next one go to Mona.
- [ ] Onboarding link opens on a phone with no login, survives a refresh mid-way (progress kept), completes, and Mona gets a notification; the lead shows `onboarded` with a readable summary of answers.
- [ ] Moving a card to Lost without a reason is impossible.
- [ ] Today screen shows overdue follow-ups first; completing one takes one tap.
- [ ] Reassigning a lead requires a reason and both reps get notified.

Prompt:
```
Milestone M2 from docs/05-BUILD-PLAN.md. Read PROGRESS.md. Build the sales screens and the public onboarding wizard as specified in docs/04-SCREENS.md and docs/03-BUSINESS-RULES.md §1–2. All writes go through the fn_* RPCs; if you need a new read shape, add a view or a SECURITY DEFINER function in migration 0003_sales_views.sql, never a client-side join across leads and memberships. The wizard must be usable one-handed at 360px and keep partial progress on refresh. Write Playwright tests for the acceptance list. Update PROGRESS.md and stop.
```

---

## M3 — Money

Goal: quote → approval → payment → client exists with credits, without anyone touching a spreadsheet.

Build: `/sales/deals/new` and `/sales/deals/[id]` (deal builder from catalog; PT line requires a coach with `fn_rank_coaches(lead)` suggestions; discount with live "needs approval" indicator computed from the rep's allowance; installments; submit; record payment sheet; status timeline; payments list), approvals in `/sales/queue` (incl. expiry extensions), `/admin/settings` products editor (catalog with per-branch prices, expiry days, bundles), `/admin/money` (deals, payments, voids, liability from `fn_dashboard_liability`, commission report from `fn_dashboard_coaches` / `fn_dashboard_reps`), client provisioning Edge Function `provision-client` (called from the server action after `fn_record_payment`; creates the auth user with the phone, the profile, the client membership, sets `clients.profile_id`, sends the welcome notification), expiry extension UI on the client's credits (sales only: rep → request, manager → apply).

Acceptance:
- [ ] A PT pack cannot be submitted without a coach; the picker shows Sara first for a lead who asked for a female morning trainer.
- [ ] A list-price deal submits straight to approved; a 20% discount by Mona goes to Karim's queue; Karim approves; Mona records 50% cash → deal `partially_paid`, client created, 6 of 12 credits visible **with Sara**, Sara has the welcome-call task and Ahmed (head coach A) a "client → Sara" notification.
- [ ] Recording more than the remaining amount is rejected with a clear message.
- [ ] After full payment the client can log in with phone OTP and sees "12 sessions with Sara" and their membership end date.
- [ ] Voiding a payment requires approval and refunds unconsumed credits.
- [ ] Mona extending an expiry creates an approval; Karim extending applies at once; an expired pack comes back with its unused sessions.
- [ ] `/admin/money` liability equals Σ remaining credits × value in the DB; the commission report shows per-session net = gross × 0.86.

Prompt:
```
Milestone M3 from docs/05-BUILD-PLAN.md. Read PROGRESS.md. Build deals (with the coach picker for PT packs), approvals, payments, expiry extension, the products editor, the money admin screen with the commission report, and the provision-client Edge Function (service role, listed in docs/03 §9). Money is never computed in the client; show what fn_price_deal returns and what mv_coach_month / mv_rep_month compute. Add Playwright tests for the acceptance list including the partial-payment → pro-rata credits case. Update PROGRESS.md and stop.
```

---

## M4 — Coaching

Goal: the coach builds their week once, runs every day from one screen, and credits burn correctly; the head coach sees every schedule.

Build: `/coach/schedule` (WeekGrid with slot sheet → `fn_upsert_schedule_slot`, skips, end slot, working-hours editor), `/coach` Today (`fn_materialize_sessions` + `fn_coach_day`, outcome buttons, zero-credit confirm sheet, walk-in, welcome-call follow-ups), `/coach/clients` (adherence list from `fn_dashboard_adherence`, flag for sales), `/coach/clients/[id]` (tabs, one-off session via `fn_add_session`), `/coach/clients/[id]/program` (builder with exercise library search, templates, copy week, activate), `/coach/team` for head coach (all schedules, coaches table from `fn_dashboard_coaches`, reassignment with `fn_rank_coaches(client)` and `fn_assign_coach`, branch adherence, audit list), `/checkin` kiosk with "Notify sales".

Acceptance:
- [ ] Sara adds the M3 client at 08:00 Sat/Mon/Wed in two taps; an overlapping slot and a slot for a client with no credits with her are refused with the reason. Ahmed sees the slot on Sara's week from Team.
- [ ] Opening Today on a Saturday shows the 08:00 session; Completed deducts one session with Sara and the balance updates live; changing to Cancelled restores it; No-show records without deducting and the client's adherence drops.
- [ ] A client with zero credits still shows on Today; tapping Completed asks to confirm, keeps the session as unpaid, and Mona's Today screen shows the flag within a second (no refresh).
- [ ] Editing a 3-day-old session outcome as Sara creates an approval; Ahmed approves it from Team; the outcome and credit apply.
- [ ] Ahmed reassigns the client to Mahmoud with a reason: the sessions left move, Sara's slots for the client close, both coaches are notified.
- [ ] Program builder: create 2 days × 4 exercises from a template in under 2 minutes; activate; client gets the push and sees it.
- [ ] Kiosk: Farida's phone checks her in at either branch; Adel Nasser (PT sessions left, membership expired) is admitted only at branch A; a lapsed client sees "no active membership" and "Notify sales" flags her rep.

Prompt:
```
Milestone M4 from docs/05-BUILD-PLAN.md. Read PROGRESS.md. Build the coach, head coach and kiosk screens per docs/04-SCREENS.md and docs/03 §5–6. Build /coach/schedule first — everything else reads from it. The Today screen is the most used screen in the app: one tap per outcome, optimistic UI with rollback on RPC error, works on a phone in a gym with bad signal (retry queue). The sales Today screen must show a new flag without a refresh (Realtime on notifications). Program builder state lives in the URL/route so a refresh doesn't lose work. Add Playwright tests for the acceptance list. Update PROGRESS.md and stop.
```

---

## M5 — Client app

Goal: the client's daily companion. Fast, offline-tolerant, no dead ends.

Build: `/c` Today (next slot/session, today's workout, sessions left per coach, "I'm here" via QR scan of the kiosk code or one-tap when a session is within the hour), `/c/workout` (log sets, last time shown, rest timer, offline queue in IndexedDB with sync), `/c/progress` (PRs, exercise chart, streak, body weight), `/c/credits` (`fn_credit_balances`, expiry, payments, Renew → `fn_flag_for_sales`, Request freeze), `/c/profile`. PWA manifest + service worker (installable, offline shell).

Acceptance:
- [ ] Hassan logs a workout with airplane mode on; turning data back on syncs it; the PR badge appears on the set that beat his history.
- [ ] Renew flags Mahmoud (his coach) and Mona (his rep) with a notification and a FLAG task.
- [ ] Credits screen matches `fn_credit_balances` per coach and shows the next expiry date; there is no self-service extension.
- [ ] Lighthouse PWA installable; first load under 2s on throttled 4G.

Prompt:
```
Milestone M5 from docs/05-BUILD-PLAN.md. Read PROGRESS.md. Build the client route group and PWA. Clients write workout_logs/set_logs/body_metrics directly under RLS (no RPC needed); everything else through RPC. No booking UI for clients — they see their coach's slots for them, read-only. Offline: queue writes in IndexedDB (idb-keyval) and replay on reconnect with idempotency keys. Add Playwright tests including an offline-then-sync test. Update PROGRESS.md and stop.
```

---

## M6 — Analytics

Goal: every role sees their numbers, every number clicks through to rows, everything has a target.

Build: `/coach/numbers` (with the commission tier meter), `/sales/numbers` (with membership commission), `/coach/team` charts (heatmap weekday × hour from `fn_dashboard_heatmap`, sessions per coach per week), `/sales/team` (source ROI, discount usage, response time, flags handled), `/admin` overview (live today strip via `fn_today_live` refreshed every 30s + Realtime on `events`, branch comparison tiles, commission accruals, 12-week trends, targets vs actual), `/admin/sales`, `/admin/coaching`, `/admin/targets` grid, `/admin/audit` explorer. Charts with Recharts, tokens only, RTL-safe.

Acceptance:
- [ ] Every StatTile links to a filtered list whose count equals the tile.
- [ ] Heatmap shows the seed's busiest hours; clicking a cell lists the sessions.
- [ ] Targets entered in `/admin/targets` appear as progress bars on the rep's and coach's own screens.
- [ ] Admin overview "today" strip updates within 30s of a check-in at the kiosk.
- [ ] Booked vs collected vs delivered vs deferred reconcile: booked − collected = outstanding; deferred = liability view.
- [ ] A coach with 33 sessions burned shows tier 30%; seeding 165 burned sessions for one coach (test fixture) shows 40% applied to all 165.

Prompt:
```
Milestone M6 from docs/05-BUILD-PLAN.md. Read PROGRESS.md. Build the analytics screens using only the fn_dashboard_* accessors and events; if a number needs a new shape, add it to 0004_analytics_more.sql as a materialized view + accessor, refreshed in fn_refresh_views. Every tile must click through to rows. Read the dataviz guidance in CLAUDE.md's tokens file for colors. Update PROGRESS.md and stop.
```

---

## M7 — Automations and governance

Goal: the system nudges people so nobody has to remember.

Build: `notify` Edge Function (delivers pending notifications: WhatsApp via the chosen provider's template API, email via Resend, push via Web Push; marks sent/failed with error), scheduled invocation every 5 minutes via pg_cron → `net.http_post` or the Supabase dashboard's cron, `whatsapp-webhook` for delivery status, daily/weekly digests (email templates rendered by `notify` from `fn_dashboard_*`), freeze flow UI (client request, manager approve, auto-end by `fn_nightly`), refunds/transfers UI in `/admin/money` and `/sales/queue` (through `fn_request_approval`), verification that pg_cron runs `fn_nightly` and `fn_hourly_notifications` on the hosted project, audit explorer polish.

Acceptance:
- [ ] Booking a session for tomorrow produces a −24h reminder row within the hour and it is delivered (sandbox number).
- [ ] A client with 2 credits gets one "time to renew" message per week, not one per hour.
- [ ] Freeze: request → approve → client frozen → auto-end at date → expiry extended by the frozen days.
- [ ] Nightly job runs at 03:30 Cairo and its `job.nightly` event shows counts.

Prompt:
```
Milestone M7 from docs/05-BUILD-PLAN.md. Read PROGRESS.md. Build the notify and whatsapp-webhook Edge Functions (service role only, listed in docs/03 §9), provider adapters behind an interface (WhatsAppProvider with a sandbox/log implementation for local dev), the freeze/refund/transfer UIs, the digests, and confirm pg_cron is enabled on the hosted project with the three schedules from 0002_analytics.sql. Every outbound message must be idempotent by notification id. Update PROGRESS.md and stop.
```

---

## M8 — Mobile

Goal: the same product in the store, without a second backend.

Build: PWA hardening first (icons, splash, install prompt, iOS quirks). Then an Expo (React Native) app in `apps/mobile` (convert to a pnpm monorepo: `apps/web`, `apps/mobile`, `packages/api` with the Supabase client + shared zod schemas + query hooks). Mobile scope for v1: client app and coach Today/Clients/Schedule. Push notifications via Expo Push → stored as `channel = push`.

Acceptance:
- [ ] Coach Today works in the Expo app against the same local Supabase, including attendance outcomes and walk-ins.
- [ ] Client workout logging works offline in the app.
- [ ] Shared package has zero React-DOM imports.

Prompt:
```
Milestone M8 from docs/05-BUILD-PLAN.md. Read PROGRESS.md. Convert to a monorepo without breaking the web app (CI must stay green at every commit), extract packages/api, then build the Expo app for the client and coach scopes. Reuse the RPC layer verbatim. Update PROGRESS.md and stop.
```

---

## After M8: branding

Replace `src/styles/tokens.css` values, the logo slot in AppShell, the PWA icons and the WhatsApp templates' sign-off. Nothing else should need to change; if it does, that was a rule violation in an earlier milestone — fix the component to use tokens.

## Working rhythm that keeps Claude Code honest

- One milestone per session. Start each session with `Read PROGRESS.md and docs/05-BUILD-PLAN.md; continue the current milestone.`
- When it proposes a schema change, ask it to write the migration and the test first, run `supabase db reset` and the tests, then build UI.
- Use `/review` (or ask for a self-review) before you test by hand: "List every acceptance criterion for this milestone and how you verified each."
- When it wants to invent a business rule that isn't in `docs/03`, say: "Add it to docs/03 and docs/06 first, then implement."
- Keep `PROGRESS.md` as the memory between sessions; it's cheaper than re-explaining.
