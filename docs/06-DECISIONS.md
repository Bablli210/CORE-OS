# 06 — Decisions

Seif's answers to the open questions (2026-09-24), each mapped to how the system implements it and which `settings` key controls it. The defaults live in the `settings` table (inserted at the bottom of `supabase/migrations/0001_init.sql`). To change one before the first deploy, edit that insert; after that, use the admin Settings screen or a migration with `update settings set value = ... where key = ...`. Every rule reads its setting at runtime through `fn_setting_*`.

Items marked **fill in later** ship with a placeholder value that is easy to change; nothing in the build depends on the exact number.

| # | Question | Decision | How it works in the system | Setting key |
|---|---|---|---|---|
| 1 | General members and group classes? | Memberships exist (time-based). Group classes are not a product in v1; a coach can put a class on their weekly schedule as a non-client slot. | `products.type = membership`; `schedule_slots.kind = class` for schedule visibility only | `products.enable_group_classes = false` |
| 2 | How are payments recorded? | Manually, at the front desk, by the sales rep. The rep records the payment and the service. A PT pack is recorded under the coach it is sold for. | `deal_items.provider_membership_id` is required for PT packs (`fn_price_deal` refuses a PT pack without an active coach of the branch). On payment, credits are issued as a lot bound to that coach and the coach becomes the client's coach automatically. Installments allowed. | `payments.installments_enabled = true`, `payments.min_first_payment_pct = 30` |
| 3 | Session scheduling? | No client booking. The coach schedules their clients' week (client at 08:00 Sat/Mon/Wed, class at 11:00, blocked hour), the head coach sees every coach's schedule. Attendance is taken on the day and deducts one session. | `schedule_slots` (weekly, recurring, with skips); `fn_materialize_sessions` creates the day's sessions from the slots; `fn_coach_day` returns the day as the UI shows it; `fn_record_attendance` burns a credit with that coach. One-off sessions via `fn_add_session`. Scheduling a client requires credits with that coach. | `scheduling.slot_minutes = 60` |
| 4 | Nutrition owner? | There is a nutritionist role. | `nutritionist` membership; a nutrition item can be recorded under a nutritionist (`provider_membership_id`), which sets `clients.nutritionist_membership_id`. Nutrition commission is counted for sales for now. **Fill in later:** the rate and whether it belongs to sales. | `commission.sales_nutrition_pct = 5` (placeholder) |
| 5 | Train at both branches? | A membership works at both branches. A session pack belongs to one coach and cannot be used at the other branch. | `fn_check_in` admits a membership at either branch; PT credits alone admit only at the coach's branch. `credit_lots.coach_membership_id` binds the pack; `fn_consume_credit` only burns lots of the session's coach. | `clients.cross_branch_checkin = true` |
| 6 | Commissions? | Memberships → sales team. PT sessions → the coach, on sessions **burned** (not sold), tiered by the month's total: 0–160 sessions = 30%, 161–200 = 40%, 201+ = 50%. Per-session value = (pack price − 14% tax) ÷ sessions. The tier reached applies to the whole month. | `credit_lots.net_per_session_value_piastres` = gross × 0.86 (tax snapshot on the lot). `mv_coach_month.commission_piastres` = Σ net value of sessions burned in the calendar month × `fn_pt_commission_pct(sessions burned)`. `mv_rep_month.commission_piastres` = membership money collected (pro-rata per payment) × rate. Reports only; payroll stays outside. Calendar month confirmed. **Fill in later:** the sales commission rate on memberships. | `commission.pt_tiers = [{160:30},{200:40},{∞:50}]`, `commission.tax_pct = 14`, `commission.sales_membership_pct = 5` (placeholder) |
| 7 | No-shows? | A no-show is recorded in the client's history and shows in the coach's analytics (who is slacking, who adheres). No deduction. | `session_status = no_show`, no credit movement; `mv_client_adherence` per client (30-day scheduled / completed / no-shows / adherence %); `mv_coach_month.no_show_pct`. Switchable if policy changes. | `attendance.no_show_deducts = false` |
| 7b | Late cancellation? | No such concept. | Only `cancelled` exists, never costs a session. | — |
| 8 | Migration? | Start fresh at the beginning of the month. No importer. | M1 has no CSV importer. Existing members are entered as deals on day one. | — |
| 9 | Round robin | Per branch, only for unattributed inbound leads; rep-sourced leads stay with the rep; reps can be paused. | `fn_round_robin_next`, `memberships.rotation_paused`. Manager assigns manually or with "round robin all"; automatic assignment on creation is off. | `leads.round_robin_enabled = true`, `leads.round_robin_auto = false` |
| 10 | Sales manager review | Leads: no review by default. Deals: approval only for discounts over the rep's allowance, installments, refunds, transfers, freezes, expiry extensions. | `memberships.discount_allowance_pct`, `approvals` | `leads.review_required = false`, `deals.auto_approve_list_price = true`, `deals.installments_need_approval = true` |
| 11 | Credit expiry | Packs expire; only the sales team can extend. Exact periods: **fill in later** (per pack, in the products catalog). | `fn_extend_expiry`: sales manager extends directly, a rep's extension goes to the manager for approval; an already-expired lot is revived with its unused sessions. Coaches cannot extend. | `credits.expiry_days_small = 90`, `credits.expiry_days_large = 180` (placeholders; the product's own `expiry_days` wins) |
| 12 | Freezes | Max days and count: **fill in later**; cases needing approval go to the sales manager. | `fn_request_freeze` → approval → `fn_end_freeze` extends expiry by the frozen days. | `freeze.max_days = 30`, `freeze.max_count = 2` (placeholders) |
| 13 | Governance | Everything transparent so nobody can cheat. | Column-level write protection (state changes only through `fn_*`), audit log on every money/credit/schedule/attendance table with actor and branch, attendance edits after 24h need head-coach approval, waivers are visible to the head coach, `events` for every state change. | `attendance.edit_window_hours = 24` |
| 14 | Client login | Phone + OTP (WhatsApp, SMS fallback); staff email + password. Phone input always carries the country code (default +20). | `fn_normalize_phone` stores E.164; the app's `PhoneInput` shows a country picker defaulting to Egypt. | `auth.client_otp_channel = "whatsapp"` |
| 3b | Low credits / zero credits | Coach is told when a client is down to ≤ 2 sessions. A coach cannot schedule a client with no credits. A coach can still deliver a session to a client with zero credits and the sales team is flagged the same second, so they catch the client on the way out. | `fn_consume_credit` notifies coach + rep immediately at ≤ threshold. `fn_upsert_schedule_slot` refuses without credits. `fn_record_attendance` with zero credits marks the session `unpaid`, creates a FLAG task for the rep and notifies rep + sales manager (Realtime → instant on their screen). The next paid pack settles unpaid sessions automatically. | `risk.low_credit_threshold = 2` |
| 15 | "At risk" flag (was: risk score) | In plain words: a badge on a client that says "this person may quit". It lights up when they have not visited in 10 days, have an active program but logged fewer than 4 workouts in 2 weeks, or are down to ≤ 2 sessions / expiring within 7 days. Coaches see it on their client list; the head coach sees the branch list. Nothing is automatic beyond the badge. | `fn_compute_risk_scores` nightly and on check-in; `clients.risk_score`, `clients.risk_reasons`. | `risk.*` |
| 16 | Head coach capacity (was: capacity factor) | Dropped. The head coach also coaches; their client capacity is simply a number top management sets, like any coach. | `memberships.capacity`; `fn_rank_coaches` uses it for load. | — |
| 17 | Timezone and week | Africa/Cairo; week starts Saturday. | All analytics use Cairo dates; `week_start_sat`. | `analytics.week_start = "saturday"` |
| 18 | Data retention | Never delete or archive client data. | No anonymization job, no archived status. Lost leads and lapsed clients are kept in full. | — |
| 19 | Opening hours | 06:00 to midnight, both branches. (Read as 12 am; if noon was meant, change `close` to `12:00`.) | `branches.opening_hours = {"open":"06:00","close":"24:00"}`; `fn_within_opening_hours` pushes a first-contact deadline that lands before 06:00 to 06:00. Per-branch override on the branch row. | `branches.opening_hours` (per branch, not a global setting) |

## Other settings (not tied to a decision above)

| Key | Default | Read by |
|---|---|---|
| `sales.first_contact_sla_hours` | 2 | `fn_create_lead` (deadline, pushed into opening hours) |
| `sales.stale_lead_days` | 14 | manager's stale-leads list (app) |
| `leads.round_robin_weighted` | false | reserved, not read |
| `coaching.consult_sla_hours` | 48 | `fn_set_primary_coach` (welcome-call task due) |
| `nutrition.fallback_to_coach` | true | app: shows the coach as nutrition owner when no nutritionist |
| `attribution.renewal_owner` | "closer" | `mv_rep_month` (renewal credit in sales reports) |
| `credits.expiry_days_small` / `_large` | 90 / 180 | `fn_issue_credits` when the product has no `expiry_days` |
| `risk.at_risk_threshold` | 60 | `fn_compute_risk_scores` notifications |
| `retention` | — | none: nothing is deleted or anonymized |
| `notify.enabled` | true | `fn_notify_claim`: off stops WhatsApp / email / push delivery (in-app still shows) |
| `notify.max_attempts` | 3 | `fn_notify_result`: retries (with 2^n-minute backoff) before a delivery is failed |
| `notify.batch_size` | 50 | reserved: the notify function takes `NOTIFY_BATCH` from its environment |
| `digest.daily_enabled` / `digest.daily_hour` | true / 20 | `fn_queue_digests`: head coach + sales manager, per branch, Cairo hour |
| `digest.weekly_enabled` / `digest.weekly_dow` / `digest.weekly_hour` | true / 6 (Sat) / 9 | `fn_queue_digests`: top management |

## To fill in later (placeholders in place; nothing blocks the build)

1. Sales commission rate on memberships (`commission.sales_membership_pct`), and the nutrition rate / owner (`commission.sales_nutrition_pct`).
2. Expiry days per pack (`products.expiry_days` in the catalog; the `credits.expiry_days_*` settings are the fallback).
3. Freeze rules (`freeze.max_days`, `freeze.max_count`).
4. WhatsApp provider (M7). The notify function talks to providers through an interface. Built: the local sandbox and the WhatsApp Cloud API (Meta) directly. A BSP (Twilio, 360dialog, …) is one more adapter. Needs the business number and the approved templates listed in `supabase/functions/_shared/templates.ts` (`gymos_*`: {{1}} first name, {{2}} title, {{3}} detail), in English (Arabic later).
5. Email sender (M7): Resend adapter built. Needs the sending domain and `EMAIL_FROM`.

Confirmed: PT commission tiers are counted per calendar month; opening hours 06:00–24:00.

## Dependencies chosen (and why)

- `@supabase/ssr` — server-side auth in App Router.
- `@serwist/next` — PWA service worker with the least config.
- `libphonenumber-js` — E.164 normalization and the country-code picker.
- `date-fns` + `date-fns-tz` — Cairo timezone math without moment's weight.
- `recharts` — charts that work with Tailwind tokens and SSR.
- `@tanstack/react-query`, `@tanstack/react-table` — server state and tables.
- `zod`, `react-hook-form` — every form.
- `idb-keyval` — offline queue for the client workout logger (M5).
- `@supabase/supabase-js` — the client `@supabase/ssr` wraps; also the admin API in `scripts/seed-auth.ts` and Edge Functions.
- `@hookform/resolvers` — connects zod schemas to react-hook-form.
- `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `tw-animate-css` — what shadcn/ui components import (`cn()`, variants, icons, animations).
- `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom` — unit and component tests.
- `@playwright/test` — e2e tests at 390px and 1280px against the seed.
- `tsx` — runs TypeScript scripts (`pnpm seed:auth`) without a build step.
- `server-only` — makes importing the service-role module from browser code a build error.
- `serwist` — the service-worker runtime `@serwist/next` builds `src/app/sw.ts` against (precache, runtime caching, offline fallback).
- `qrcode` (+ `@types/qrcode`) — draws the kiosk's check-in QR code as SVG; loaded only on `/checkin`.
- M7 added no npm dependency. The Edge Functions use `fetch` and WebCrypto only. The database gains the `pg_net` extension (ships with Supabase) so pg_cron can call the notify function over HTTP.
