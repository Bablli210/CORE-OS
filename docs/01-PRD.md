# 01 — Product requirements

## 1. What this is

One internal system for a two-branch gym that replaces WhatsApp threads, Excel sheets and memory. It carries a person from first contact to loyal client, gives every role one screen for their job, and gives management a live, trustworthy view of both branches.

Success in plain terms: a lead never gets lost, a paid client never waits for a coach, a coach never guesses who is coming today, a manager never asks "how are we doing this month" in a group chat, and nobody types the same thing twice.

## 2. Roles and org chart

| Role | Count | Reports to | Scope |
|---|---|---|---|
| `top_management` | 2 | — | Both branches, read everything, configure everything |
| `head_coach` | 1 per branch | top management | Own branch coaching team; also coaches own clients |
| `coach` | N per branch | head coach | Own clients only |
| `nutritionist` (optional) | 0–1 per branch | head coach | Clients with nutrition packages in branch |
| `sales_manager` | 1 | top management | Both branches' sales |
| `sales_rep` | N per branch | sales manager | Own leads and clients |
| `front_desk` (optional) | 0–N per branch | sales manager | Check-ins, walk-in lead capture, payment recording |
| `client` | many | — | Own data only |

A person can hold several roles (head coach + coach; a rep who also covers front desk). Roles are memberships in a branch, not a column on the user.

## 3. The core loop

```
Lead captured → Onboarding wizard → (Review) → Rep assigned → Follow-ups
→ Deal quoted (PT pack recorded under a coach) → Deal paid → Credits issued to that coach
→ Client account created → Coach welcome call → Program assigned → Weekly slots on the coach's schedule
→ Client shows up → Attendance → Credit burned → Client logs lifts
→ Credits low (≤ 2) → coach + rep told at once → Renewal → back to Deal
→ Zero credits but trains anyway → session kept as unpaid → sales flagged the same second → next pack settles it
```

Every arrow is an event. Every event notifies the next owner and feeds a dashboard.

## 4. Features by domain

### 4.1 Lead capture (Sales)

- 30-second capture: name, phone, source (walk-in, Instagram, referral, website, event, other), branch, interest tags. Anything else is optional.
- Duplicate detection on phone at entry; if a match exists, show the existing lead/client and offer to attach the touch instead of creating a new record.
- Lead sources are configurable. Referrals capture the referring client.
- Front desk and reps can create leads; a public website form and an Instagram DM link create `inbound` leads with no owner.

### 4.2 Onboarding wizard (Lead, no login)

- Sent as a signed link (WhatsApp/SMS) or filled together on the rep's tablet. Expires in 7 days, can be re-sent.
- Steps (≤ 8 screens, one question per screen, progress bar, save on every step so partial answers survive):
  1. Confirm name, preferred language (EN/AR), date of birth, gender.
  2. Goal (fat loss, muscle, strength, general fitness, rehab, sport-specific, other) and target timeline.
  3. Interested in: membership type (monthly / quarterly / annual), PT (yes/no/maybe), nutrition (yes/no/maybe).
  4. If PT: preferred time (morning/afternoon/evening), preferred days, trainer gender preference (male/female/no preference), sessions per week they can commit to.
  5. Health: injuries or conditions (free text + common checkboxes), medical clearance (yes/no), PAR-Q style yes/no questions. Mandatory acknowledgement.
  6. Experience level and current activity.
  7. How did you hear about us (pre-filled if known), Instagram handle (optional), consent to be tagged in content (yes/no), consent to marketing messages.
  8. Done: "Your advisor {rep} will call you within {SLA}." If unassigned: "We'll be in touch today."
- Answers are structured (`onboarding_responses` jsonb with a versioned schema) so the coach matcher and analytics can read them.

### 4.3 Review and assignment (Sales manager)

- Review queue shows leads needing review (setting-driven; default off for rep-sourced leads, on for inbound with missing phone or suspected duplicate).
- Assignment: rep-sourced stays with the rep. Inbound goes to round robin per branch (simple rotation; paused reps skipped) or manual pick. Manager can reassign any lead with a reason; the old and new rep are notified.
- Response-time SLA: first contact within 2 hours during opening hours. Breaches show on the manager's screen.

### 4.4 Pipeline and follow-ups (Sales rep)

- Stages: `new → contacted → onboarded → quoted → won | lost`. `lost` requires a reason from a fixed list plus optional note.
- Follow-up tasks with due dates; today's list is the rep's home screen. Overdue tasks are the first thing the manager sees per rep.
- Every call, WhatsApp, visit is a `touch` with a type and a note. Reps log touches in two taps.
- Quotes are built from the package catalog; a quote becomes a deal when the client agrees.

### 4.5 Deals, payments and credits (Sales + Finance-lite)

- Package catalog: memberships (time-based), PT packs (credit-based: 8/12/24/36 sessions, with per-session value), nutrition (time-based), bundles with bundle discount. Prices per branch allowed.
- A deal has line items, a discount (amount or %), a payment plan (single or installments) and a status: `draft → pending_approval → approved → partially_paid → paid → cancelled`.
- A PT pack line item is recorded under the coach it is sold for (required). The deal builder suggests coaches from the lead's onboarding preferences (trainer gender, preferred time, injuries) and current load; the rep picks. A nutrition item can be recorded under the nutritionist.
- Approval rules: list price auto-approves; discounts beyond the rep's allowance, installments, transfers, refunds and expiry extensions go to the sales manager.
- Payment recording at the front desk by the rep: method (cash, card, Instapay, transfer), amount, reference/receipt, recorded_by. Multiple payments per deal.
- Credits are issued as a lot bound to the coach when a PT line item is paid (or pro-rata per installment). Each lot carries the gross per-session value, the tax snapshot and the net per-session value (commission base), and an expiry. Balance is computed from the lots per coach, never stored.
- Conversion: the moment a deal reaches `paid` or `partially_paid`, the lead becomes a client with an auth account (phone OTP), the pack's coach becomes their coach (welcome-call task, notifications to coach and head coach), and a welcome message goes out. Membership starts on the payment date.
- Expiry: packs expire; only the sales team extends (a rep's extension needs the manager's approval). An expired pack that is extended gets its unused sessions back.

### 4.6 Coach assignment (automatic) and reassignment (Head coach, branch-scoped)

- Assignment happens at the sale: the coach the pack was recorded under is the client's coach the moment the pack is paid. No queue, no extra step.
- Reassignment by the head coach with a reason (client request, coach left, schedule conflict, performance): the client's remaining sessions move to the new coach, the old coach's weekly slots for that client close, both coaches and the client are notified, history is kept.
- The head coach also coaches and has their own capacity number like any coach.

### 4.7 Coaching (Coach)

- Client profile: onboarding answers, injuries flagged at the top, credits (balance, expiry, next expiring), attendance history, program, logs, notes (private to coaching team), touches.
- Welcome flow: the moment a pack is paid, the coach gets a "Welcome call" task with a 48-hour SLA; completing it logs the call as a touch on the client.
- Program builder: exercise library (seeded with ~150 exercises, tags for muscle/equipment/pattern), templates (personal and gym-wide), day/week structure, sets × reps × tempo/rest, notes per exercise, copy last week, progressive overload suggestion (+2.5% when all sets hit the target twice).
- Weekly schedule: the coach builds their week once — client X at 08:00 Sat/Mon/Wed, client Y at 09:00, a class at 11:00, a blocked hour — and it repeats until changed. Skips for a date (holiday, travel) and one-off sessions (make-up) are the only exceptions. Scheduling a client requires credits with that coach. The head coach sees every coach's week in the branch. Clients see their own slots. Reminders go out 24h and 2h before.
- Today: the day's sessions are created from the schedule automatically; the coach sees who is coming at what time, credits left, injuries flag, and taps an outcome: `completed` (burns one session with this coach), `no_show` (recorded only — no deduction — and shown in adherence analytics), `cancelled` (free). Client gets a push "Session logged, 7 sessions left with your coach."
- Zero credits: the client still appears on the schedule. If the coach delivers the session anyway, it is kept as `unpaid`, the rep and the sales manager are flagged that second, and the next paid pack settles it automatically.
- Walk-in session (not on the schedule): coach taps "Start session" on the client; it creates and completes a session in one step.
- Nutrition: if a nutrition package exists, a simple plan document (targets + notes + attached PDF), owned by the nutritionist or the coach.

### 4.8 Client app (Client)

- Today: next session (time, coach, location), today's workout if scheduled, credits left, one-tap "I'm here" check-in with a QR at reception.
- Workout: the program for today; per exercise, enter weight × reps per set with last time's numbers shown; rest timer; mark done. Works offline and syncs.
- Progress: PR list, per-exercise chart, attendance streak, body metrics (weight, optional measurements) the client enters themselves.
- Credits and membership: balance, expiry, payment history, renew button (creates a renewal lead for the rep/coach).
- Messages: in-app thread with the coach (M7).
- Profile: preferences from onboarding, editable.

### 4.9 Front desk and check-in

- QR at reception; client scans with the app or types the phone number on a tablet. Creates a `visit` row for any member, PT or not. Foot-traffic analytics come from visits, not from PT sessions. A membership admits the client at both branches; PT credits alone admit them at their coach's branch.
- Front desk can record payments, create walk-in leads and flag a client for sales ("membership expired, wants to renew").

### 4.10 Analytics

Per role, only their scope. All numbers come from the `events` table and materialized views refreshed every 5 minutes (nightly for heavy ones).

- Sales rep: my pipeline by stage, conversion %, response time, won revenue this month vs target, membership money collected and my commission on it, overdue follow-ups, open flags, lost reasons.
- Sales manager: same per rep and per branch; lead source ROI (leads → won revenue by source); SLA breaches; discount usage; approval queue age; open flags and how fast they were handled.
- Coach: active clients, sessions burned this month and where that puts me in the commission tier (e.g. "148 of 160 to the next tier"), no-show rate, delivered revenue (net) and commission, per-client adherence (who is slacking), retention (clients renewed / clients whose packs ended), clients at risk, unpaid sessions awaiting settlement.
- Head coach: same per coach; every coach's weekly schedule; sessions per coach per week; branch heatmap (hour × weekday of sessions and visits); coach utilization (sessions / working hours); credit liability by coach; waivers and late edits.
- Top management: branch comparison of everything above; revenue booked vs collected vs delivered vs deferred (unburned credits); commission accruals per coach and per rep; new clients, lapsed clients, net; retention cohort by join month; targets vs actual per branch, per rep, per coach; live "today" panel (visits so far, sessions so far, leads captured, payments recorded, unpaid sessions open).

### 4.11 Governance and automations

- Audit log of every write that changes money, credits, assignment, schedule or attendance, with before/after, actor and branch. State-carrying columns cannot be edited directly from the app at all (column-level grants); they change only inside the rule functions.
- Approvals table for discounts, installments, freezes, refunds, transfers, expiry extensions, late attendance edits.
- Notifications: in-app always (Realtime, so a flag reaches the rep's screen in the same second); WhatsApp templates for client-facing events (welcome, session reminder, credits low, expiry soon), email for staff digests. All driven by `events`.
- Nightly job: expire credits, mark lapsed, recompute the at-risk badge, materialize the next day's sessions, refresh heavy views, send digests. Nothing is ever deleted or anonymized.
- Targets: monthly per rep, coach and branch, set by management; every dashboard shows actual vs target.

## 5. Non-goals for v1

- Group class booking and capacity (a class can sit on a coach's schedule, nothing more).
- Client self-booking of sessions.
- Online payments and invoicing to tax authority.
- Payroll and commission payout (the system computes the accruals; payment happens outside).
- Data migration (the gym starts fresh at the beginning of a month).
- Access-control hardware (turnstiles).
- Wearable integrations.
- Multi-tenant SaaS. This is one company; build it as one company (a `branches` table is enough).

## 6. Quality bar

- Any staff action that happens 10+ times a day takes ≤ 2 taps from the role's home screen.
- Every list view has search, one obvious filter, and sane default sort.
- Numbers on any dashboard can be clicked to see the rows behind them.
- No screen without a loading state, an empty state with a next action, and an error state that says what to do.
- p95 page load under 2s on a mid-range Android on 4G.
