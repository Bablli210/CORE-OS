# 04 — Screens

One job per screen. Each entry: route, who sees it, the job, the data it needs (queries and RPCs), the primary action, and the empty state. Layout is mobile-first; on desktop the same screens gain a left nav and wider tables.

Route groups: `(public)`, `(client)`, `(coach)`, `(sales)`, `(admin)`. A person with several roles gets a role switcher in the header; the last used role is remembered.

Shared components: `AppShell` (header, bottom tab bar on mobile / side nav on desktop, role switcher, notification bell fed by Realtime), `StatTile` (value, label, delta vs target, click-through), `DataTable` (search, one filter, sort, card mode below `md`), `EmptyState` (icon, sentence, primary action), `ClientHeader` (name, branch, coach, credits-per-coach pill, at-risk badge, injuries flag, unpaid-sessions badge), `CreditsPill` (balance with this coach, next expiry), `PhoneInput` (country-code picker defaulting to +20, stores E.164), `WeekGrid` (7 columns × hours, slots as blocks, free gaps visible), `Sheet` (bottom sheet on mobile, dialog on desktop), `ApprovalBadge`, `FlagBanner` (live list of flagged clients on sales screens).

## Public

### `/onboard/[token]` — Onboarding wizard
Who: the lead (no login). Job: answer ≤ 8 one-question screens. Data: `fn_submit_onboarding` per step (returns `advisor` and `contact_by`). Primary: Continue. Saves each step. Done screen names the advisor and when they will call. Expired token → "Ask your advisor to resend the link" with a WhatsApp deep link to the branch number.

### `/checkin` — Reception tablet
Who: kiosk mode (front desk account). Job: member types phone or scans QR. Data: `fn_check_in`. Success shows name, credits, next session; failure shows "no active membership" and a "Notify sales" button that calls `fn_flag_for_sales` (follow-up + notification for the client's rep).

### `/login`
Staff: email + password (magic link optional). Client: phone → OTP. After login route by role.

## Client `(client)`

Bottom tabs: Today · Workout · Progress · Credits · Profile.

### `/c` — Today
Job: know what's next and check in. Data: next session (from my slots and sessions), today's program day, `fn_credit_balances` (per coach), active entitlement, unread notifications. Primary: "I'm here" (QR or one tap when a session is within the hour). Empty: "No session this week — your coach sets your slots" / "No program yet — your coach is preparing it".

### `/c/workout` — Today's workout
Job: log sets fast. Data: active program, today's `program_day` (or pick a day), last log per exercise. UI: exercise list; each row expands to sets with weight/reps inputs pre-filled from last time, rest timer, "Done". Offline-first: write to IndexedDB, sync on reconnect. Primary: Finish workout (creates `workout_log` + `set_logs`).

### `/c/progress`
Job: see that it's working. Data: PRs, per-exercise chart (top set weight over time), attendance streak, body metrics chart. Primary: Add body weight.

### `/c/credits`
Job: know balance and expiry, renew. Data: `fn_credit_balances` (sessions left per coach with next expiry), ledger, payments, membership dates. Primary: Renew (`fn_flag_for_sales(me, note, 'renewal_request')` — reaches the rep, the sales manager and the coach). Also: Request freeze (form → `fn_request_freeze`). No self-service extension: "Ask your advisor" with a WhatsApp link.

### `/c/profile`
Preferences from onboarding, editable; Instagram handle; consents; language; logout.

## Coach `(coach)`

Bottom tabs: Today · Clients · Programs · Numbers. Head coach gets a fifth tab: Team.

### `/coach` — Today
Job: run the day from one screen. On open, calls `fn_materialize_sessions(today, me)` then `fn_coach_day(me, today)`: the day as a timeline — client sessions (name, time, sessions left with me, injuries flag, unpaid badge), classes, blocked hours, free gaps. Primary per session row: Completed / No-show / Cancelled (`fn_record_attendance`, optimistic, one tap; a zero-credit client gets a confirm sheet "Deliver anyway? Sales will be flagged now"). "Start walk-in session" (client picker → `fn_start_walkin_session`). Open follow-ups (welcome calls due). Empty: "Nothing scheduled today — open your week" → `/coach/schedule`.

### `/coach/clients`
Job: find a client, spot who is slacking. Data: `fn_dashboard_adherence(me)` (clients whose primary coach is me) — sessions left with me, last visit, adherence % (30 days), no-shows, at-risk badge, unpaid sessions, next expiry; default sort: at-risk and lowest adherence first; search. A client whose primary coach is someone else but who holds a pack with me shows in my schedule and in `fn_credit_balances`, not in this list. Primary: open client. Secondary: Flag for sales (`fn_flag_for_sales`, e.g. "wants to add nutrition"). Empty: "No clients yet — clients appear here the moment a pack is sold under your name".

### `/coach/clients/[id]`
Tabs: Overview (ClientHeader, onboarding summary, injuries, preferences, sessions left with me + expiry, next slot) · Sessions (history with outcomes, unpaid ones marked, add a one-off via `fn_add_session`) · Program (current, assign, edit) · Logs (workouts, PRs, adherence) · Notes (coaching visibility). Primary: Add to my week (opens `/coach/schedule` with the client preselected). Secondary: Assign program, Add note, Record walk-in, Flag for sales (renewal).

### `/coach/clients/[id]/program`
Program builder: weeks × days; add exercise from library (search, filter by muscle/equipment); sets/reps/tempo/rest/target; superset grouping; "copy last week"; "from template"; "save as template". Preview as the client sees it. Primary: Activate.

### `/coach/schedule` — My week
The core coaching screen. `WeekGrid` of my recurring slots: tap a free cell → sheet: Client (picker limited to clients with credits with me, shows sessions left) / Class (label) / Blocked (label), duration, start date → `fn_upsert_schedule_slot`. Tap a slot → move, change, end (`fn_end_schedule_slot`), skip a date (`fn_skip_slot`). Working hours editor (`coach_availability`) defines the visible day range and the free gaps. Today/next-day sessions are created from this grid automatically. Head coach opens the same screen for any coach from Team.

### `/coach/numbers`
StatTiles from `fn_dashboard_coaches(month)`: sessions burned this month with the commission tier meter ("148 / 160 to 40%"), commission this month (net delivered × tier), no-show %, active clients, unpaid sessions awaiting settlement, retention, clients at risk. Each tile clicks through to the rows. Chart: sessions per week (12 weeks). Shows the formula on tap: pack price − 14% tax ÷ sessions = net per session.

### `/coach/team` — Head coach only
Sections: Schedules (every coach's week side by side — who is doing what; open any coach's `/coach/schedule`); Coaches table (active clients / capacity, sessions burned this month, no-show %, delivered net, commission tier, unpaid sessions, retention, utilization) with click-through; Reassign (client picker → `fn_rank_coaches(client)` suggestions → `fn_assign_coach` with reason; shows that packs and slots move); Branch adherence list (`fn_dashboard_adherence()`); Heatmap (weekday × hour, sessions + visits, last 8 weeks); Audit (waivers, late edits, pending attendance-edit approvals).

## Sales `(sales)`

Bottom tabs: Today · Pipeline · Leads · Deals · Numbers. Sales manager gets: Queue · Team.

### `/sales` — Today
Job: do today's follow-ups, respond to new leads within SLA, catch flagged clients before they leave. Data: `FlagBanner` at the top — open FLAG tasks (client, why, when, which coach; arrives live via Realtime on `notifications`), then follow-ups due today + overdue; new leads assigned to me without first contact, with SLA countdown; today's onboarding completions. Primary per row: Call (tel: link + auto-log touch sheet), WhatsApp (wa.me deep link + touch), Done. Empty: "All caught up — add a lead".

### `/sales/leads/new` — Capture (also reachable from the header + button everywhere)
Name, phone (dup check as you type), source, branch (prefilled), interest chips (membership/PT/nutrition), note. Primary: Save → then "Send onboarding link" (WhatsApp) or "Fill together". Calls `fn_create_lead`, `fn_issue_onboarding_token`.

### `/sales/pipeline`
Kanban by stage (mobile: stage tabs). Cards show name, source, days in stage, next follow-up, SLA status. Drag/move calls `fn_set_lead_stage`; moving to Lost opens the reason sheet.

### `/sales/leads/[id]`
Lead detail: header (stage, owner, source, SLA), onboarding answers (nice summary + raw), touches timeline, follow-ups, quotes/deals. Primary: Log touch. Secondary: Create quote, Resend onboarding link, Mark lost, Convert (opens deal).

### `/sales/deals/new?lead=…` and `/sales/deals/[id]`
Deal builder: pick products (catalog by branch), qty; a PT pack line requires a coach — the picker shows `fn_rank_coaches(lead)` suggestions first (why: gender preference, mornings, load) then all coaches of the branch; a nutrition line may pick the nutritionist; discount (shows allowance and whether approval will be needed), payment plan. Summary (subtotal, discount, total; per-session value shown gross and net of tax). Primary: Submit (`fn_submit_deal`). On approved deal: Record payment sheet (amount, method, reference, date → `fn_record_payment`). Status timeline. After first payment: "Client created — coach {name} notified, welcome call due in 48h" banner; if unpaid sessions were settled, "N unpaid sessions settled".

### `/sales/numbers`
StatTiles: won revenue this month vs target, conversion, median response time, pipeline value by stage, overdue follow-ups. Lost reasons bar. Leads by source.

### `/sales/queue` — Sales manager
Sections: Flags (open FLAG tasks across the branch with age — the "who trained without paying" list); Unassigned inbound leads (assign / round robin all); Review queue (approve/reject with note); Approvals (discount, installments, freeze, refund, transfer, expiry extension — attendance edits are the head coach's, not here); SLA breaches; Stale leads.

### `/sales/team` — Sales manager
Reps table (`fn_dashboard_reps`): leads, contacted, onboarded, quoted, won, revenue vs target, membership collected and commission, response time, overdue follow-ups, open flags and time-to-close, rotation toggle (pause/resume). Click-through per rep. Source ROI table. Discount usage. Expiry extensions granted (who, how often).

## Admin `(admin)` — Top management

Side nav: Overview · Branches · Sales · Coaching · Clients · Money · Targets · People · Settings · Audit.

### `/admin` — Overview
Live "today" strip (`fn_today_live`: visits, sessions, leads, collected, unpaid sessions open — refreshed every 30s + Realtime). Branch A vs B tiles: revenue booked, collected, delivered (gross / net), deferred liability; commission accruals (coaches, reps); new / lapsed / net clients; sessions; no-show %. Trend charts (12 weeks). Targets vs actual bars. Everything clicks through.

### `/admin/sales`, `/admin/coaching`
The manager/head-coach team screens, for both branches, read-only, with branch filter.

### `/admin/clients`
All clients: filters (branch, coach, status, at-risk, unpaid sessions), CSV export. No importer (the gym starts fresh); existing members are entered as deals on day one.

### `/admin/money`
Deals, payments, refunds, liability by branch and coach; month close view (collected by method, by product type); commission report per coach (sessions burned, net delivered, tier, amount) and per rep (membership collected, amount) for the payroll run; unpaid sessions ledger.

### `/admin/targets`
Grid: period × scope (branch, rep, coach) × metric. Inline edit.

### `/admin/people`
Profiles and memberships: invite staff (email), assign roles per branch, capacity, specialties, discount allowance, deactivate. Head coach must have coach membership (enforced).

### `/admin/settings`
Every `settings` key grouped (Sales, Deals, Payments, Credits, Attendance, Scheduling, Commission, Risk, Freeze), with description and default; the commission tiers editor is a small table (up to / %). Products catalog editor (branch-specific prices, expiry days per pack).

### `/admin/audit`
`audit_log` and `events` explorer: filter by table, actor, date; diff view.

## Notification center (all roles)
`/notifications`: list, mark read, deep links to the subject. Bell badge in header via Realtime on `notifications`.

## Screen count
Public 3 · Client 5 · Coach 7 (+1 head coach) · Sales 7 (+2 manager) · Admin 10 · Shared 2. About 37 screens; M1–M4 need 21 of them.
