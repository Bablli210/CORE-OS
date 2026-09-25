# PROGRESS

Living log. Claude Code updates this at the end of every milestone step. Newest at the top.

## Current milestone

M5 — Client app: **built, awaiting review.** Do not start M6 until M5 is reviewed. (M1–M4 are covered by the same test run.)

Acceptance (docs/05 M5). The SQL tests are in `supabase/tests/007_client.sql` (L1–L24). The e2e tests are in `e2e/client.spec.ts` and run at 390px and 1280px:
- [x] Hassan logs a workout with airplane mode on: the browser goes offline, he logs two back-squat sets and taps Finish, and the screen says "Saved on this phone" while nothing reaches the server. Back online, it syncs once (the workout count goes up by exactly 1) and the PR badge is on the set that beat his history, not on the lighter one (e2e; L5–L7).
- [x] Renew flags Mahmoud (his coach) and Mona (his rep), each with a notification, and Mona gets a FLAG task (e2e; L14–L15).
- [x] The credits screen matches `fn_credit_balances` per coach and shows the next expiry date (e2e compares with SQL). There is no extend button; "Ask Mona on WhatsApp" is the only way (e2e; L13).
- [x] PWA installable: Chrome reports no installability errors (manifest, icons, service worker). First load of `/login` on Lighthouse's throttled 4G (150 ms RTT, 1.6 Mbps) with a 4× slower CPU: **LCP 560 ms, load 1.7 s** (e2e, 390px; see "PWA checks" below).
- [x] Also required by the M5 prompt:
  - After one visit, the app shell and the logger reload with no signal (service worker + IndexedDB, e2e).
  - Offline writes are queued in IndexedDB (`idb-keyval`) and replayed with idempotency keys (ids made on the phone). Unit tests cover the queue order, network vs database failures and duplicates; L6 shows a replay is a no-op.
  - Members see their coach's weekly slots read-only, with no booking controls (e2e).
  - One tap "I'm here" works within the hour of a session, and the kiosk's QR code of the day checks a member in from their phone camera (e2e; L18–L22).
  - Progress shows PRs, the streak and body weight; the profile saves (e2e; L10–L11, L17).
- [x] `pnpm typecheck && pnpm lint && pnpm test` pass (66 unit tests). `scripts/test-db.sh` passes (seven suites; 007_client adds 24 checks). `pnpm test:e2e` passes: 93 tests on a fresh reset and seed, production build (1 skipped: the PWA check runs once, on the phone profile).

**PWA checks:** Lighthouse itself isn't installed in this sandbox. The e2e test uses Chrome's own installability check (`Page.getInstallabilityErrors`, on a normal non-incognito profile) and times the first load under Lighthouse's throttling settings. Worth confirming with a real Lighthouse run on the deployed site.

How to run: `supabase start -x studio,imgproxy,logflare,vector,supavisor && supabase db reset && pnpm seed:auth && pnpm env:local && pnpm dev`. The service worker exists only in a production build (`pnpm build && pnpm start`); `next dev` stays online-only. If client provisioning (M3) fails after a Docker restart, run `docker start supabase_edge_runtime_gymos`.
Local logins: staff `*@gymos.local` / `gymos-dev`. Clients log in by phone with OTP `123456` (Hassan = `01110000001`, Farida = `01110000008`).

## Decisions made during the build

- 2026-09-25 (M5) — **Migration 0010_client_app.sql.**
  - Client read shapes: Today, training, progress, credits.
  - `fn_update_my_profile`, self check-in, the kiosk QR code, and an `app_secrets` table for its key.
  - Reads are RPCs as well, scoped to `my_client_id()`. New event: `client.profile_updated`.
  - Renew and freeze use 0001's `fn_flag_for_sales` (`renewal_request`) and `fn_request_freeze` unchanged. anon still has no access.
- 2026-09-25 (M5) — **Direct writes, idempotent.** Workouts, sets and body weight are written straight to their tables under RLS, as the prompt says. The rows' ids are made on the phone (`crypto.randomUUID`) and double as the idempotency keys, and each send is `INSERT … ON CONFLICT (id) DO NOTHING` (PostgREST `ignore-duplicates`). A replay after a lost response writes nothing twice. PRs stay with 0001's trigger (Epley), so the badge appears once the rows reach the server.
- 2026-09-25 (M5) — **Offline outbox.**
  - Every client write goes to the IndexedDB outbox first (`idb-keyval`), online or not.
  - It is sent right away, on the browser's `online` event, every 15 s while anything waits, and on the next app open. Oldest first.
  - A network failure stops the run; a database refusal parks the item with its reason, and the summary shows it.
  - The workout in progress is also kept in IndexedDB, so a reload keeps the sets.
  - Today and the logger read network-first with an IndexedDB copy as fallback, and the UI says when it is showing the copy.
  - The logger updates its URL with `history.replaceState`, which needs no server round trip; `router.replace` failed without signal.
  - The M4 coach attendance queue stays in localStorage (small, one key).
- 2026-09-25 (M5) — **Service worker (Serwist).**
  - Precaches the build; network-first for pages (so pages opened before work offline); `/offline` as the fallback for pages never opened.
  - Built only for production.
  - Sign-out clears the page caches and the cached data. The outbox is kept so a queued workout is never lost; it is sent the next time that member opens the app.
  - Placeholder icons are rendered by `scripts/make-icons.mjs` (the neutral tokens' colours).
- 2026-09-25 (M5) — **Manifest link in `<head>`.** Next 15 streams generated metadata into `<body>` for real browsers, and Chrome then ignores the manifest: the app wasn't installable. The root layout now writes the manifest link, theme colour and touch icon in `<head>` itself. The manifest colours are literals (a manifest can't reference CSS) kept in `src/lib/pwa.ts` next to the token names they copy.
- 2026-09-25 (M5) — **"I'm here".**
  - One tap works within ±1 hour of a booked session, at that session's branch.
  - Otherwise the member scans the kiosk's QR code. It encodes `/c/here?b=<branch>&k=<code>`, and the code is an HMAC of branch and Cairo date, so a photo of it stops working the next day. Members scan with the phone's camera app; there is no in-app scanner.
  - Admission is `fn_check_in`'s rule (visit method `qr`).
  - Two new dependencies, each with a reason in docs/06: `qrcode` (+ `@types/qrcode`) and `serwist`.
- 2026-09-25 (M5) — **What the member sees.**
  - Today shows the next session (booked, or the next occurrence of a weekly slot), the suggested program day, sessions left per coach and the coach's weekly slots, read-only.
  - The logger prefills each set from last time, else the program's target, and starts the rest timer when a set is marked done.
  - Progress: streak (gym weeks with a workout or a visit), PRs by best estimated 1RM, the top set per session for one exercise, and body weight (line charts with a table view).
  - Credits: per-coach balances and expiry, packs, memberships, payments, session ledger, Renew, Request freeze, and "Ask your advisor" instead of an extension.
  - Profile: training preferences, consents, Instagram, language.

- 2026-09-25 (M4) — **Migration 0009_coaching.sql.**
  - Read shapes: week, day, clients, client, program, templates, Team.
  - Writes as RPCs: weekly slots, working hours, notes, programs, templates, kiosk.
  - New events: `availability.updated`, `client.note_added`, `program.created`, `template.saved`.
  - anon still has no access (the allowlist test passes). Dates are Cairo dates, never the server's `current_date`.
- 2026-09-25 (M4) — **Several days at once.** `fn_add_weekly_slots` adds one slot on several weekdays in one transaction: all or nothing, and the refused weekday is named (DETAIL carries it). The sheet preselects the tapped day plus the client's onboarding days (`pt_prefs.days`). That is what makes "08:00 Sat/Mon/Wed in two taps" possible.
- 2026-09-25 (M4) — **Recurring week.** Any weekday of the week on screen can be tapped. A new slot starts on the later of today and the week's Saturday, so tapping an earlier day of this week starts it next week. Moving, skipping and ending slots use the 0001 functions.
- 2026-09-25 (M4) — **Today.** `fn_coach_today` materializes the day first (today or later) and returns everything one tap needs. `?date=` pages through days; outcomes can be recorded for today and earlier. A zero-credit Completed asks first ("Deliver anyway?").
- 2026-09-25 (M4) — **Bad signal.**
  - A tap updates the row at once (the same credit arithmetic as `fn_record_attendance`).
  - If the database refuses, the row rolls back and the reason shows.
  - If the request can't reach the server, the tap is kept in localStorage and resent when the phone is back online, every 15 s, and on the next open.
  - A late edit shows as "Waiting for head coach".
  - localStorage rather than IndexedDB: `idb-keyval` is planned for M5's workout logger and the queue is tiny. No new dependency.
- 2026-09-25 (M4) — **Live adherence on the coach's screens.** `/coach/clients` and the client page compute 30-day adherence live (`fn_coach_clients` / `fn_coach_client`, same formula as `mv_client_adherence`). So a new client appears the moment a pack is sold (the docs/04 empty-state promise) and a no-show counts at once, including one recorded earlier the same day. docs/04 names `fn_dashboard_adherence` for this list; Team's branch-wide adherence list still uses it (the materialized view, 5-minute refresh).
- 2026-09-25 (M4) — **Programs.**
  - Written through RPCs. `fn_save_program` autosaves the draft (400 ms debounce, plus a save when the tab is hidden).
  - An active program is never rewritten, because clients log against it: "Edit as new version" makes a draft copy, and activating it archives the old one.
  - Builder state is the route (`?program=`, `?day=`, `?view=preview`, `?add=1`) plus the saved draft, so a refresh lands in the same place (e2e).
  - The schema has no week on `program_days`: weeks is the program's length and the days repeat weekly. "Copy last week" is therefore "Copy this day"; supersets are group letters.
- 2026-09-25 (M4) — **Starter templates.** Two gym-wide templates ("Full body — 2 days", "Upper / lower — 4 days") ship in 0009. They name their exercises, and names are resolved when read, because the exercise library is seeded after migrations. seed.sql is unchanged.
- 2026-09-25 (M4) — **Kiosk.**
  - `/checkin` looks members up by phone (`fn_kiosk_check_in`, visit method `phone`).
  - "Notify sales" uses `fn_kiosk_notify_sales`, so reception at either branch can flag the client's rep (`fn_flag_for_sales` only allows the home branch's staff).
  - The screen resets itself after 12 s. It keeps the app shell (front desk account).
- 2026-09-25 (M4) — **Coach context.** Coaching screens act through the person's coach membership in the active branch (a head coach has one), or `?coach=` when the head coach opens a coach from Team (the database checks the scope). `/coach/programs` lists the templates; `/c` now shows the client's active program ("client sees it"). Workout logging is M5.
- 2026-09-25 (M4) — **Late attendance edits (flagged).** docs/03 §6 says "the first write and edits within 24 h are applied at once". But 0001's `fn_record_attendance` and the provided test `001_rules.sql` (10a) send any write after 24 h, including the first, to the head coach. The code and the provided test were kept, since test files aren't edited without approval. Decide which is right, then update docs/03 or add a migration.

- 2026-09-24 (M3) — **Migration 0008_money.sql.** It adds the deal/approval/client read shapes and the draft, void and catalog writes. Every write emits an event (`deal.created`, `product.saved`, and the existing `approval.requested`). The read shapes are SECURITY DEFINER and mirror the `deals` RLS scope. anon has no access (the allowlist test still passes).
- 2026-09-24 (M3) — **Money in the client.** The only conversion the client does is the rep's EGP input → piastres. Totals, discounts, per-session gross/net, remaining, the minimum first payment and "needs approval" all come from the database. `fn_save_deal_draft` prices through `fn_price_deal`, and `fn_deal_approval_preview` uses the same rules as `fn_submit_deal`. The builder autosaves (400 ms debounce) and always shows what the server returned.
- 2026-09-24 (M3) — **Commission report source.** docs/05 names `fn_dashboard_coaches` / `fn_dashboard_reps` / `fn_dashboard_liability`. The money screen uses one top-management function, `fn_commission_report(month, branch?)`, instead. It reads the same `mv_coach_month` / `mv_rep_month` / `mv_liability` and adds per-session gross/net and the liability total in SQL, so the screen does no arithmetic.
- 2026-09-24 (M3) — **Liability refresh.** `mv_liability` moved from the nightly refresh to the 5-minute refresh, because `/admin/money` shows it. The screen says it can lag up to 5 minutes.
- 2026-09-24 (M3) — **provision-client.** It authorises with the caller's own JWT (`fn_sales_client`) before using the service role. It reuses an existing profile with the same phone, is idempotent and emits `client.provisioned`. The `recordPayment` server action calls it when the paid deal's client has no account. If it fails, the payment still stands and the sheet says the login couldn't be created. The function uses plain `fetch` with no imports so it runs offline. docs/03 §9 is updated.
- 2026-09-24 (M3) — **Expiry extension screen.** docs/04 has no sales-side client screen, so `/sales/clients/[id]` was added. It shows packs (incl. expired ones), entitlements, deals, Extend (manager) and Request extension (rep). It opens from the lead detail and from a paid deal.
- 2026-09-24 (M3) — **Branch prices.** A product row for a branch overrides the all-branches row with the same code, in that branch only (`fn_deal_catalog`). The products editor shows both.
- 2026-09-24 (M3) — **Reserved test phones.** `supabase/config.toml` sets test OTP `123456` for `+201099900001–60` too, so e2e runs can log in as clients they created. No dependencies were added in M3.

- 2026-09-24 (M2) — **Migration name.** The M2 prompt asks for `0003_sales_views.sql`; 0003–0005 already existed, so the sales read shapes are `0006_sales_views.sql`.
- 2026-09-24 (M2) — **Read shapes are SECURITY DEFINER functions** that apply the same scope as the leads RLS policy (`fn_can_see_lead`), so screens never join leads with memberships/profiles on the client. Detail and Today/Queue return one JSON document each (one round trip per screen).
- 2026-09-24 (M2) — **Touches and follow-ups are written through RPCs** (`fn_log_touch`, `fn_add_follow_up`, `fn_complete_follow_up`), per "all writes go through fn_*"; each emits an event. The direct table grants from 0001 are still there (RLS-protected); the app doesn't use them.
- 2026-09-24 (M2) — **Wizard resume.** `fn_onboarding_state(token)` (anon) returns only the token holder's own answers + name/source/advisor first name. The wizard saves each step on Continue and resumes at the first unsaved step; the current step's unsaved inputs are also kept in localStorage. 7 question screens + done (docs/01 ≤ 8): PT preferences are skipped when PT = "no". PAR-Q = the standard 7 questions.
- 2026-09-24 (M2) — **anon function allowlist.** Functions created after 0001's one-time revoke (all of 0002, 0004's helpers…) were executable by `anon` through Supabase's default grants. 0006 resets anon to the wizard functions + `fn_normalize_phone` (tested). Default privileges are unchanged because the provided SQL tests create helpers and call them as anon; every new migration revokes anon on its own functions.
- 2026-09-24 (M2) — **pg_cron installed (`0007_schedule_jobs.sql`).** 0002 only scheduled its jobs if pg_cron existed, so the dashboard views were never refreshed; Numbers/Team read `mv_rep_month`. Now the 5-minute refresh, hourly notifications and nightly job run locally too (same schedules as 0002). Numbers can lag up to 5 minutes; the screens say so.
- 2026-09-24 (M2) — **Pipeline moves** use a "Move to…" menu on every card (keyboard and one-thumb friendly) plus drag-and-drop between columns on desktop. Mobile shows one stage per tab. Only forward moves and Lost are offered (the DB enforces it too).
- 2026-09-24 (M2) — **Round robin all** assigns the unassigned leads one by one in arrival order (`fn_assign_lead(lead, null)` each), so the rotation advances per lead.

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

- M5: Lighthouse wasn't run (not installable here); installability and first load were measured with Chrome DevTools in e2e. Run Lighthouse on the Vercel preview.
- M5: offline covers the client app: Today, the logger, workouts and body weight. Credits, progress and profile need signal (they say so and offer Try again). Push notifications (Web Push) are the `notify` Edge Function, M7.
- M5: no in-app QR scanner (the phone camera opens the link). A signed-out member who scans goes to login and then back to the check-in link.
- M5: the language switch is saved, but Arabic strings (`ar.json`) are still empty.
- M5: free workouts without a program, and editing a logged workout, aren't built.
- M4: on the coach side only attendance taps survive no signal (localStorage queue). The M5 service worker now keeps pages opened before.
- M4: the kiosk has no QR scan and no chrome-less kiosk mode yet. QR check-in ("I'm here") is M5.
- M4: program builder:
  - no per-week progression ("copy last week"), because the schema has no week per day;
  - exercises reorder with up/down buttons, not drag;
  - the library is the 36 seeded exercises.
- M4: the working-hours editor edits one block per day; the database accepts several.
- M4: the Team heatmap reads `mv_heatmap`, which refreshes nightly (heavy refresh), so it is empty on a fresh reset until the nightly job runs.
- M4: `/coach/numbers` is still the M6 placeholder. Nutritionists have no schedule screen (no coach membership).
- M3: bundles can be edited in the products editor but aren't offered in the deal builder. 0001's `fn_record_payment` doesn't expand a bundle into its items, so a sold bundle would issue nothing. Fix: a migration that expands bundles at pricing or payment time.
- M3: cancelling a deal that has payments isn't possible (0001 refuses). Refunds (`refund` approval) have no screen yet. Voids cover a payment recorded by mistake.
- M3: the `notify` Edge Function, which retries `provision-client` and delivers the WhatsApp welcome, is not built (the welcome sits `pending`). That is M7 (notifications).
- M3: `/admin/money` has no CSV export and no month-over-month chart; neither is in the M3 list.
- M2: editing a lead's editorial fields (name, email, tags, handle) has no screen yet; not in the M2 list.
- M2: branches have no phone in the seed, so the expired-link screen can't offer the WhatsApp button yet (set `branches.phone`; the Branches admin screen is M6).
- M2: drag-and-drop in the pipeline is not covered by e2e (the "Move to" menu is); Arabic strings (`ar.json`) are still empty — the wizard layout uses logical properties and is RTL-ready.
- M1: the live bell subscribes to rows addressed to the profile; client rows queued on `client_id` before provisioning show in the list but don't push live (provision-client backfills `recipient_profile_id`, M3).
- M1: editing a person's name/phone and resending an invite are not in the People screen yet (not in the M1 list); invite again after deleting nothing — an existing email is refused with a clear message.
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

- 2026-09-25 — **M5 Client app.**
  - `/c` Today: next session and "I'm here", today's workout, sessions left per coach, the coach's weekly slots (read-only), the program.
  - `/c/workout` logger: day tabs, prefilled sets, last time, rest timer, IndexedDB draft, offline outbox, and a summary with PR badges after sync.
  - `/c/progress`: streak, PRs, top-set and body-weight charts, add weight.
  - `/c/credits`: balances and expiry per coach, packs, memberships, freezes, payments, ledger, Renew, Request freeze, Ask your advisor.
  - `/c/profile`.
  - `/c/here`: QR check-in.
  - Kiosk QR on `/checkin`.
  - PWA: manifest, icons, Serwist service worker, `/offline`.
  - Migration 0010. Tests: 007_client.sql, unit tests for the outbox and the workout draft, e2e for every M5 box including offline-then-sync.
- 2026-09-25 — **M4 Coaching.**
  - `/coach/schedule`:
    - WeekGrid: 7 days on desktop, one day per tab on a phone, working hours shaded, free cells tappable.
    - Slot sheet: client / class / blocked, several days at once, duration.
    - Slot detail: move or change, skip a date, end.
    - Working-hours editor; head coach can open any coach (`?coach=`).
  - `/coach` Today:
    - timeline with sessions, classes, blocked hours and free gaps;
    - one-tap outcomes, optimistic with rollback, and the offline retry queue;
    - zero-credit confirm, walk-in, follow-ups (welcome calls), day paging.
  - `/coach/clients`: live adherence, at-risk and lowest adherence first, search.
  - `/coach/clients/[id]`:
    - header with sessions left per coach, injuries and unpaid;
    - tabs in the URL: overview, sessions (plus one-off), program, logs, notes;
    - Add to my week, Flag for sales.
  - `/coach/clients/[id]/program`: builder from a template or blank, exercise library, preview, activate, save as template.
  - `/coach/programs`: templates.
  - `/coach/team`:
    - late attendance edits to approve, waivers, decided edits, unpaid sessions;
    - coaches with this month's numbers and their weeks;
    - reassignment with ranked suggestions;
    - lowest adherence; busy-hours heatmap.
  - `/checkin` kiosk.
  - `/c` shows the active program.
  - Migration 0009. Tests: 006_coaching.sql, unit tests for week maths and the outcome queue, and e2e for every M4 box.
- 2026-09-24 — **M3 Money.**
  - `/sales/deals`: a list with status filter and search.
  - `/sales/deals/new` → `/sales/deals/[id]`: the deal builder. It picks from the catalog with per-session gross/net, has a coach picker for PT packs (`fn_rank_coaches` suggestions + all branch coaches), discount % or EGP with a live "needs approval" indicator and its reasons, single or installments, notes, autosave and submit. It also shows the approved/paid view: payments with Void / Void pending / Voided, the record-payment sheet (method, reference, remaining, minimum first payment), "X of Y sessions released", the status timeline and cancel.
  - The Queue approvals section decides discounts, installments, voids, freezes and expiry extensions, with the subject detail.
  - `/sales/clients/[id]`: packs, expiry extension (manager applies, rep requests) and deals.
  - `/admin/settings` Products tab: catalog editor with per-branch prices, expiry days and bundle items.
  - `/admin/money`: month and branch filter; booked, collected, voided, by method and by type (pro-rata), unpaid sessions, the commission report for coaches (sessions burned, tier, per-session gross/net, commission) and reps, liability per branch and total, recent deals and payments.
  - The `provision-client` Edge Function.
  - Tests: 005_money.sql, unit tests for labels/EGP input, e2e for every M3 box.
- 2026-09-24 — **M2 Sales.** `/sales` Today (flag banner live via Realtime, follow-ups overdue-first with one-tap Done, new leads with SLA countdown, today's onboardings; Call/WhatsApp open the app and the touch sheet), `/sales/leads/new` (30-second capture, live duplicate check, source, interests, note → send onboarding link on WhatsApp or fill together), `/sales/pipeline` (stage tabs on mobile, columns + drag on desktop, Move-to menu, lost-reason sheet), `/sales/leads` (search + stage filter), `/sales/leads/[id]` (stage/owner/SLA, onboarding summary + raw, touches, follow-ups, deals; log touch, resend link, mark lost, assign/reassign for the manager), `/onboard/[token]` public wizard (7 steps, saves each, resumes on refresh, 360px one-handed), `/sales/queue` (flags, unassigned + round robin all, review, SLA breaches, stale; approvals count), `/sales/team` (reps' month, open flags, rotation pause/resume), `/sales/numbers` (tiles from `fn_dashboard_reps`, leads by source, lost reasons). Migrations 0006 (sales read shapes, touch/follow-up RPCs, wizard state, anon allowlist) and 0007 (pg_cron). Tests: 004_sales.sql, unit tests for steps/moves/format, e2e for every M2 box.
- 2026-09-24 — **M1 Foundation.** Supabase helpers (`src/lib/supabase/{client,server,middleware,admin}.ts`), session middleware, `getMe()` / `useMe()` (profile, memberships, active role + branch, branch ids). `/login` (member phone + OTP, staff email + password), role routing from `/`, `/auth/confirm` + `/welcome` for invites, `/no-access`. `AppShell` (header with branch, role switcher, live bell, sign out; side nav ≥ md, bottom tabs + More below md) and a placeholder for every docs/04 route (title, job, milestone, onward link). `/notifications` with mark-as-read and deep links. `/c` shows the member's name, sessions left per coach and membership end. `/admin/people` (search, role filter, table/cards, invite, add/edit/deactivate roles, auto coach role for head coaches). `/admin/settings` (grouped, typed editors, commission tier table). `PhoneInput` (+20 default, E.164). UI primitives in `src/components/ui` (shadcn-style, tokens only). Migrations 0004 (admin RPCs, Realtime) and 0005 (security). Tests: 188 SQL assertions, Vitest units + PhoneInput component test, Playwright e2e for every acceptance box at 390px and 1280px.
- 2026-09-24 — **M1 kickoff.** Next.js 15 (App Router, TS strict), Tailwind v4, shadcn/ui config, TanStack Query provider, react-hook-form + zod, `@supabase/ssr`, Vitest, Playwright (390px + 1280px), pnpm. `src/styles/tokens.css` (neutral colour/spacing/radius/type/motion). `t()` with en/ar catalogs and RTL `dir()`. Folder layout per CLAUDE.md. Local Supabase: 0001 + 0002 + 0003 apply, seed loads, `scripts/test-db.sh` → 156 assertions, ALL RULE TESTS PASSED. `src/lib/database.types.ts` generated. `pnpm seed:auth` sets staff passwords and client phone login; verified staff password login, client OTP login and RLS scoping over the REST API.
