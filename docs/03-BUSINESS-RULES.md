# 03 — Business rules

These rules are implemented as Postgres functions and triggers in `supabase/migrations/0001_init.sql` and tested in `supabase/tests/`. The UI calls them via RPC and never re-implements them. Settings referenced as `setting:key` come from the `settings` table (defaults in `docs/06-DECISIONS.md`).

## 1. Lead lifecycle

```
new ──contacted──▶ contacted ──onboarding done──▶ onboarded ──quote sent──▶ quoted ──deal paid──▶ won
 │                    │                              │                        │
 └────────────────────┴──────────────────────────────┴────────────────────────┴──▶ lost (reason required)
```

- `fn_create_lead(branch_id, full_name, phone, source, ...)`: normalizes phone to E.164; if a non-lost lead or a client with that phone exists, returns `{duplicate: true, lead_id|client_id}` and does not insert (caller shows the existing record). Sets `first_contact_due_at` = SLA hours after creation, pushed into opening hours by `fn_within_opening_hours` (branches open 06:00–24:00, so a lead captured at 23:30 is due at 06:00 + 2h = 08:00; one captured at 02:00 online is due 08:00). If the creator is a `sales_rep`, the lead is owned by them; otherwise `owner_membership_id` is null and the lead enters the inbound queue, where the sales manager is notified, or, if `setting:leads.round_robin_auto`, it is assigned immediately by round robin. If `setting:leads.review_required`, `review_status = pending` (decided with `fn_review_lead`), else `not_required`. Emits `lead.created`.
- `fn_assign_lead(lead_id, membership_id?, reason?)`: sales manager only (or the system for round robin). If `membership_id` is null and `setting:leads.round_robin_enabled`, calls `fn_round_robin_next(branch_id)`. Reassignment (owner already set) requires a reason and notifies both reps. Emits `lead.assigned`.
- `fn_round_robin_next(branch_id)`: active `sales_rep` memberships in the branch, `rotation_paused = false`, ordered by membership id; picks the one after `round_robin_state.last_membership_id` (wraps). Not weighted in v1 (`setting:leads.round_robin_weighted` reserved). `fn_assign_lead` with no rep refuses when `setting:leads.round_robin_enabled` is false. The sales manager pauses/resumes a rep with `fn_set_rotation_paused(membership, paused)`.
- Stage transitions only forward, except `lost` which is allowed from any non-won stage, and `contacted ← new` is set automatically by the first outbound touch. `won` is set only by `fn_record_payment` via `fn_convert_lead`. `fn_set_lead_stage` rejects anything else.
- A lead untouched for `setting:sales.stale_lead_days` (default 14) is flagged `stale` in views (not a status) and appears on the manager's list.

## 2. Onboarding wizard

- `fn_issue_onboarding_token(lead_id)`: generates a token, sets expiry `now() + 7 days`, emits `lead.onboarding_sent`. Re-issuing invalidates the previous token.
- `fn_submit_onboarding(token, step, answers jsonb, complete bool)`: callable by `anon`. Validates token and expiry, merges `answers` into `onboarding_responses` under the step key, bumps `onboarding_schema_version` to the current version constant (`1`). When `complete = true`, sets `onboarding_completed_at`, moves status `new/contacted → onboarded`, copies `instagram_handle` and consents, and emits `lead.onboarded`. Returns only `{ok, advisor, contact_by}` (advisor's first name and the SLA deadline for the "done" screen) or `{ok:false, reason}` to the anonymous caller. The onboarding link itself is sent by the rep from the app (WhatsApp deep link); leads have no account, so nothing is queued in `notifications` for them.
- Schema for `onboarding_responses` v1:
  ```json
  {
    "identity": {"full_name","preferred_language","date_of_birth","gender"},
    "goal": {"primary","timeline_weeks","notes"},
    "interest": {"membership":"monthly|quarterly|annual|none","pt":"yes|no|maybe","nutrition":"yes|no|maybe"},
    "pt_prefs": {"time":"morning|afternoon|evening","days":["sat",...],"trainer_gender":"male|female|any","sessions_per_week":2},
    "health": {"injuries":"text","conditions":["knee","back",...],"medical_clearance":true,"parq":{"q1":false,...},"acknowledged":true},
    "experience": {"level":"beginner|intermediate|advanced","current_activity":"text"},
    "social": {"heard_from":"instagram","instagram_handle":"@x","consent_content":true,"consent_marketing":true}
  }
  ```


## 3. Deals, approval, payments

- Every PT pack line item is recorded under a coach (`deal_items.provider_membership_id`). The deal builder calls `fn_rank_coaches(p_lead_id => …)` (named argument — the first positional parameter is `p_client_id`) to suggest coaches from the onboarding answers (trainer gender is a hard filter; preferred time vs the coach's working hours, specialties vs injuries/goals, and current load score the rest); the rep picks. A nutrition item may be recorded under a nutritionist.
- `fn_price_deal(deal_id)`: recomputes `subtotal`, `discount_piastres` (from `discount_pct` or a fixed amount, whichever is larger, capped at the subtotal), `total`, and snapshots product fields into `deal_items`. Refuses a PT pack without an active coach of the deal's branch. Only in `draft`.
- `fn_submit_deal(deal_id)`: rep, sales manager or coach (renewals). Rejects installments outright when `setting:payments.installments_enabled` is false. Approval is required if any of: effective discount % > the submitter's `memberships.discount_allowance_pct`; `payment_plan = installments` and `setting:deals.installments_need_approval`; deal total is 0 (always, for everyone); `setting:deals.auto_approve_list_price` is false. Apart from the zero-total case, sales managers and top management never need approval for their own deals. If required: status `pending_approval`, an `approvals` row of type `discount`/`installments`, notification `deal.needs_approval` to the sales manager. Else `approved`. Emits `deal.submitted` / `deal.approved`.
- `fn_decide_approval(approval_id, approve, note)`: sales manager (or top management); `attendance_edit` is decided by the head coach instead. Applies the side effect by type; the UI creates requests with `fn_request_approval(type, subject_table, subject_id, branch_id, reason, payload)` using these contracts:

  | type | subject | payload | effect on approve |
  |---|---|---|---|
  | `discount`, `installments` | `deals`.id | (set by `fn_submit_deal`) | deal `approved`; on reject `cancelled` |
  | `freeze` | `freezes`.id | (set by `fn_request_freeze`) | freeze `active`, client `frozen`, client notified |
  | `refund`, `payment_void` | `payments`.id | `{}` | payment voided, deal paid amount reduced, unconsumed lots of that deal `refunded` |
  | `transfer` | `credit_lots`.id | `{"to_client_id": uuid}` | lot moved to the target client (ledger out/in) |
  | `attendance_edit` | `sessions`.id | `{"outcome","waive","waive_reason"}` (set by `fn_record_attendance`) | outcome applied via `fn_apply_attendance` |
  | `lead_reassign` | `leads`.id | `{"to_membership_id": uuid}` | `fn_assign_lead` |
  | `expiry_extension` | `credit_lots`.id | `{"new_expires_at": timestamptz, "client_id"}` (set by `fn_extend_expiry`) | `fn_apply_expiry_extension` |

  The requester is notified with `approval.decided`; emits `approval.decided`.
- `fn_record_payment(deal_id, amount, method, reference, received_at)`: the rep, sales manager or front desk of the deal's branch. Deal must be `approved` or `partially_paid`. Inserts the payment, updates `paid_piastres`; status becomes `paid` when `paid ≥ total`, else `partially_paid`. Then, in order:
  1. If the deal has a `lead_id` and no client yet → `fn_convert_lead` (client row, lead `won`).
  2. For each `pt_pack` item: sessions to release = `floor(session_count × paid/total) − credits_issued` (everything on full payment); if > 0 → `fn_issue_credits` under the item's coach, then `fn_set_primary_coach` (the pack's coach becomes the client's coach if they have none or a different one: assignment row, welcome-call task due in `setting:coaching.consult_sla_hours`, notifications to the coach, the client and the head coach), then `fn_settle_unpaid_sessions` for that coach.
  3. For each `membership`/`nutrition` item on first payment: create an `entitlement` starting on the payment date; a nutrition item with a provider sets `clients.nutritionist_membership_id`.
  `deals.first_paid_at` is set on the first payment (booked revenue is dated here); `paid_at` when fully paid. Emits `payment.recorded`, and `deal.paid` when fully paid. Overpayment is rejected; a first payment below `setting:payments.min_first_payment_pct` (30%) is rejected unless it completes the deal.
- Messages to a client who has no account yet (first payment, first coach) are queued with `fn_notify_client` on the client row (`notifications.client_id`, `recipient_profile_id` null); `provision-client` backfills `recipient_profile_id` when it creates the account, and `notify` delivers them by phone.

## 4. Credits (packs)

- A pack belongs to one coach. `fn_issue_credits(client, item, qty, gross_value, expiry_days, coach)`: creates a `credit_lots` row with `coach_membership_id`, `per_session_value` (gross), `tax_pct` snapshot (`setting:commission.tax_pct`, 14) and `net_per_session_value` = gross × (100 − tax) ÷ 100 — for a 7,500 EGP / 10-session pack: gross 750, net 645. `expires_at = now() + expiry_days` (the product's own `expiry_days`, else `setting:credits.expiry_days_small/large`). Ledger `issue` row, emits `credit.issued`.
- `fn_credit_balance(client, coach?)` = Σ `qty_remaining` over active, unexpired lots, optionally for one coach. `fn_credit_balances(client)` = the same per coach.
- `fn_consume_credit(client, session, reason)` (internal): picks the earliest-expiring active lot **of the session's coach**; decrements; ledger `consume` row; lot `exhausted` at 0. Raises `GY001` (no credits with this coach) if none. Emits `credit.consumed` with gross and net value. If the balance with that coach drops to ≤ `setting:risk.low_credit_threshold` (2), the coach and the client's rep are notified immediately (`credits.low`, at most once a week per client).
- `fn_restore_credit(session, reason)`: on waiver or outcome change; `qty_remaining + 1`, ledger `restore`, lot back to `active` if it was `exhausted`.
- Cross-branch: a membership admits the client at both branches; a pack cannot be used with another coach or at the other branch (there is simply no lot for that coach to burn).
- `fn_expire_credits()` nightly: lots with `expires_at < now()` and `qty_remaining > 0` → `expired`, ledger `expire` row, emit `credit.expired`. Warnings: `credits.expiring_14d` to client and coach once per lot; `credits.low` (see above) also covers "expiring within `risk.expiring_days`".
- Extension (sales team only): `fn_extend_expiry(lot, new_date, reason)`. Sales manager / top management apply directly; any rep of the branch may request, which becomes an `expiry_extension` approval for the manager; coaches cannot. An expired lot that is extended is revived with the sessions the expiry removed (`restore` ledger row). Emits `credit.expiry_extended`. Expired packs also notify the client and the coach (`credit.expired`).
- Freeze: `fn_request_freeze` validates `setting:freeze.max_days` and `max_count` and creates an approval. On approval the client is `frozen`; `fn_end_freeze` (nightly at `ends_at`, or manual) extends `expires_at` of active lots and `ends_at` of entitlements by the frozen days.
- Reassignment (head coach, `fn_assign_coach(client, coach, reason)`): moves the client's active lots to the new coach, closes the old coach's weekly slots for the client and cancels their future booked sessions, opens a new assignment (welcome-call task, notifications). Reason required. Emits `coach.reassigned`.

## 5. The weekly schedule

- `schedule_slots` is the coach's week: recurring `(weekday, start_time, duration)` slots of kind `client` (a client, requires credits with this coach), `class` (label) or `blocked` (label). `fn_upsert_schedule_slot` (coach for own schedule, head coach for any coach in the branch) refuses overlapping slots on the same weekday and a client slot without credits. Slots have `starts_on` / `ends_on`; `fn_end_schedule_slot` closes one; `fn_skip_slot(slot, date, reason)` skips a single date (and cancels that day's session if already created).
- `fn_materialize_sessions(date, coach?)`: creates the day's `sessions` (status `booked`) from active client slots not skipped that day; idempotent (unique on slot + time). Called by the Today screen on open, by the hourly job for today and tomorrow (so reminders can go out), and by the nightly job. A client whose pack ran out stays on the schedule — the coach decides on the day (deliver unpaid, or cancel).
- `fn_coach_day(coach, date)`: everything the day view shows — sessions with client, status, credits left with this coach, unpaid flag, injuries; class and blocked slots with labels. Free gaps are computed client-side from `coach_availability`.
- One-off sessions: `fn_add_session(client, coach, when)` (coach or head coach; credits required; no overlap with the coach's or the client's other sessions). `fn_cancel_session(session, reason)` cancels a booked session at no cost.
- Visibility: a coach sees their own week; the head coach and the sales manager see every coach's week in the branch; a client sees their own slots and sessions. Every schedule change is audited (who moved whom).

## 6. Attendance

- `fn_record_attendance(session, outcome, waive?, waive_reason?)`:
  - Outcomes: `completed`, `no_show`, `cancelled`.
  - Who: the session's coach, the branch head coach, top management.
  - When: the first write and edits within `setting:attendance.edit_window_hours` (24) of `scheduled_at` are applied at once; later edits become an `attendance_edit` approval for the head coach.
  - `completed` → burns one credit with this coach (FIFO by expiry). With zero credits, the session is kept as **unpaid** (`sessions.unpaid = true`), a `FLAG` task is created for the client's rep, and the rep and the sales manager are notified in the same second (`client.flagged`, kind `unpaid_session`); the next paid pack under that coach settles unpaid sessions automatically (`fn_settle_unpaid_sessions`, oldest first, `session.settled`).
  - `no_show` → recorded only; no deduction (`setting:attendance.no_show_deducts` = false). It feeds the client's adherence and the coach's no-show %.
  - `cancelled` → nothing burns.
  - `waive = true` with a reason skips the deduction (or restores it if already consumed) and notifies the head coach (`session.waived`); waivers appear on the head coach's audit list.
  - Changing an outcome from a consuming one to a non-consuming one restores the credit, and vice versa. Everything is audited.
  - On `completed`: a `visit` is inserted (method `session`) if the client has none in the last 3 hours at that branch; `clients.last_visit_at` updates. The client gets a push "N sessions left with your coach".
  - Emits `session.completed` / `session.no_show` / `session.cancelled`, plus `session.unpaid` when applicable.
- `fn_start_walkin_session(client)`: the client's coach (or a coach holding one of their packs, or the branch head coach). Creates a session at `now()` with `is_walk_in = true` and records `completed` immediately (same credit / unpaid rules).
- `fn_check_in(client, branch, method)`: client (self, QR), front desk or any staff in the branch. Admits an active membership at either branch (`setting:clients.cross_branch_checkin`), or PT credits at the coach's branch only. Otherwise returns `{ok:false, reason:'no_active_entitlement'}` so the desk can upsell. Inserts a `visit`, updates `last_visit_at`, de-duplicates within 3 hours. Emits `visit.recorded`.
- `fn_flag_for_sales(client, note, kind)`: any staff in the client's branch (kiosk "Notify sales" → `kiosk_refused`, coach spotting an upsell → `upsell`, `manual`), or the client themself (`renewal_request` from the Renew button — that one also notifies the coach). One open `FLAG` task per client for the rep (or the branch sales manager if the client has no rep); rep and sales manager notified; the sales manager can close any flag in the branch. Emits `client.flagged`.

## 7. Client training data

- Clients write `workout_logs`, `set_logs`, `body_metrics` for themselves directly (RLS), no RPC needed. A trigger computes `is_pr` per set using Epley 1RM (`weight × (1 + reps/30)`) against the client's best for that exercise. Another trigger emits `workout.logged`; activating a program emits `program.activated` and pushes the client.
- Adherence for a client = completed ÷ (completed + no-shows) over the trailing 30 days (`mv_client_adherence`), alongside workouts logged, last visit, credits left and next expiry. This is the coach's "who is slacking" list, and the head coach's per branch.
- Coaches see all logs of their clients; the head coach of the branch; top management. Sales cannot.

## 8. Attribution, commission and analytics definitions

| Metric | Definition |
|---|---|
| Won / booked revenue (rep) | Σ `deals.total_piastres` where status ∈ {partially_paid, paid} and `rep_membership_id` = rep, by month of `first_paid_at`; renewals count for the rep only when `attribution.renewal_owner = 'rep'` or the rep closed them (else they show on the closing coach's `renewals_revenue`) |
| Collected revenue | Σ `payments.amount_piastres` not voided, by `received_at` |
| Collected by item type | each payment split pro-rata by the deal's line totals (a 9,400 deal = 4,000 membership + 5,400 PT → a 4,700 payment counts 2,000 membership, 2,700 PT) |
| Sales commission (rep) | membership collected × `commission.sales_membership_pct` (+ nutrition collected × `commission.sales_nutrition_pct`, placeholder) — report only |
| Sessions burned (coach) | `consume` ledger rows whose lot belongs to the coach, by month of the session date |
| Delivered revenue (coach) | Σ gross per-session value of sessions burned; **net** = Σ net per-session value (after the tax snapshot) |
| Coach commission | net delivered in the calendar month × `fn_pt_commission_pct(sessions burned in the month)`: 0–160 → 30%, 161–200 → 40%, 201+ → 50%, the reached tier applying to the whole month (`commission.pt_tiers`) — report only |
| Deferred liability | Σ `qty_remaining × per_session_value` over active lots (+ pro-rata of unexpired time-based entitlements, shown separately) |
| Unpaid sessions | sessions with `unpaid = true` (delivered on zero credits, not yet settled) — a number management wants at zero |
| No-show rate | no_show / (completed + no_show) |
| Adherence (client) | completed / (completed + no_show), trailing 30 days |
| Utilization (coach) | sessions completed / (working hours per week × 4.3) in the period |
| Retention (coach) | `mv_coach_month.clients_ended` = clients whose pack with this coach ran out (exhausted or expired) in month M; `clients_renewed` = of those, bought a new pack within 30 days; `retention_pct` |
| Lapsed / churn (branch) | `mv_daily_branch.clients_lapsed` from `client.lapsed` events; churn % for a period = lapsed in period ÷ (active now + lapsed in period) |
| Response time (rep) | median minutes from `leads.created_at` to `first_contact_at` |
| Conversion (rep, source) | won / leads created in period, by rep or by source |
| At-risk badge (client) | see `docs/06-DECISIONS.md` #15; recomputed nightly; coach and head coach notified (`client.at_risk`) once a week while the score stays ≥ `risk.at_risk_threshold` |
| Renewal attribution | `setting:attribution.renewal_owner`: `closer` (default) credits a renewal to whoever closed it — a rep in `mv_rep_month`, a coach in `mv_coach_month.renewals_revenue`; `rep` credits every renewal to the client's rep. The coach's commission is unaffected either way (it is on sessions burned, never on sales) |

## 9. Permissions matrix

R = read, W = write via RPC, — = none. "Own" = rows the person is attached to. "Branch" = rows in the person's membership branches. "All" = all branches. Top management can additionally do anything any role can, through the same RPCs; the column shows their everyday read scope.

| Table / action | client | coach | head_coach | nutritionist | sales_rep | sales_manager | front_desk | top_mgmt |
|---|---|---|---|---|---|---|---|---|
| profiles | own R/W | own + own clients R | branch staff + clients R | own clients R | own leads/clients R | branch R | branch R | all R/W |
| memberships | — | branch R | branch R | branch R | branch R | branch R, pause/resume reps | branch R | all R/W |
| settings | — | R | R | R | R | R | R | R/W |
| leads | — | — | — | — | own R/W (editorial), suggest coach | all R/W | branch create | all R |
| touches, follow_ups | — | own clients R/W | branch R/W | own clients R/W | own leads/clients R/W | all R/W (incl. closing any FLAG) | branch create | all R |
| products | R | R | R | R | R | R/W | R | R/W |
| deals, deal_items | own R | own clients R, renewals W (own drafts) | branch R | own clients R | own R/W (own drafts) | all R/W | branch R | all R |
| payments | own R | renewals they closed R | branch R | — | own deals R/W (record) | all R/W | branch R/W (record) | all R |
| approvals | freeze request | own requests | branch R, decide attendance edits | — | own requests (incl. expiry extension) | all R/W (decide) | — | all R/W |
| clients | own R | own R/W (editorial columns) | branch R/W | own R/W (editorial) | own R | all R/W (editorial) | branch R | all R |
| coach_assignments | own R | own R | branch R/W (reassign) | own clients R | — | — | — | all R/W |
| entitlements, credit_lots, credit_ledger | own R | own clients R | branch R | own clients R | own clients R, request expiry extension for any branch client | all R, extend expiry | branch R | all R |
| freezes | own request | own clients R | branch R | — | own clients request | all R/W | branch R | all R |
| coach_availability | own coach R | own R/W | branch R/W | R | R | R | R | all R |
| schedule_slots, schedule_skips | own R | own R/W | branch R/W | — | — | branch R | — | all R |
| sessions | own R | own R, outcomes via RPC, notes W | branch R/W | own clients R | own clients R | all R | branch R | all R |
| visits | own R | branch R | branch R | branch R | branch R | branch R | branch R/W | all R |
| exercises | R | R/W (create) | R/W | R | R | R | R | R/W |
| program_templates | — | own + gym-wide R, own W | branch R/W | — | — | — | — | all R/W |
| programs, program_days, program_exercises | own R | own clients R/W | branch R/W | — | — | — | — | all R |
| workout_logs, set_logs, body_metrics | own R/W | own clients R | branch R | own clients R | — | — | — | all R |
| nutrition_plans | own R | own clients R (W if fallback) | branch R | own clients R/W | — | — | — | all R |
| client_notes | — | visibility coaching/all: own clients R/W | branch R/W | own clients R/W | visibility sales/all: own R/W | all R/W | visibility sales/all: branch R/W | all R |
| events | — | — | branch R | — | — | branch R | — | all R |
| audit_log | — | — | branch R (rows carry branch_id) | — | — | branch R | — | all R |
| notifications | own R/W(read) | own | own | own | own | own | own | own |
| targets | — | own R | branch R | — | own R | branch R | — | all R/W |

Write protection beyond RLS: the tables that carry state (`leads`, `clients`, `deals`, `deal_items`, `sessions`, `profiles`, `notifications`) have column-level UPDATE grants, so even a row the user may see can only be edited in its editorial columns (leads: name, email, source, tags, referral, handle, consents; clients: name, email, gender, birth date, injuries, handle, onboarding answers, nutritionist; deals in draft: discount, plan, notes, renewal flag, closer; sessions: notes); `status`, owners, review fields, money and credit columns change only inside `fn_*` (which run as the table owner). `payments`, `approvals`, `sessions` (insert), `schedule_slots`, `schedule_skips`, `credit_*`, `entitlements`, `coach_assignments`, `events` and `audit_log` have no direct insert path at all.

Scheduled work runs inside Postgres with pg_cron (UTC): `fn_refresh_views(false)` every 5 min, `fn_hourly_notifications()` hourly (also materializes today's and tomorrow's sessions), `fn_nightly()` at 00:30 UTC = 03:30 Cairo in summer / 02:30 in winter (expiry, lapse, at-risk badge, materialization, heavy view refresh). Nothing is ever deleted or anonymized.

Edge Functions that run with the service role (bypass RLS), and why:
- `provision-client`: creates the auth user + profile + client membership for a new client, sets `clients.profile_id`, backfills `notifications.recipient_profile_id` for rows queued on that `client_id`, and sends the welcome message with the app link (`client.created`). Invoked from the server action right after `fn_record_payment` returns a new `client_id`, and retried by `notify` if `profile_id` is still null.
- `notify`: every 5 minutes (pg_cron → pg_net, or Supabase's scheduled function trigger), reads `notifications` with `status = pending`, delivers by channel (WhatsApp provider, Resend email, Web Push), marks sent/failed. In-app notifications need no delivery: the app subscribes to its own `notifications` rows with Realtime.
- `whatsapp-webhook`: inbound delivery-status updates from the WhatsApp provider.
Nothing else may use the service role.

## 10. Notifications (event → recipient → channel)

| Event | Recipient | Channel |
|---|---|---|
The `type` column is the exact string in `notifications.type`.

| type | trigger | recipient | channel |
|---|---|---|---|
| `lead.created` | inbound lead, unassigned | sales manager | in_app |
| `lead.assigned` / `lead.reassigned` | assignment / reassignment | new rep / old rep | in_app |
| `lead.onboarded` | wizard completed | owner rep | in_app |
| `lead.sla_breach` | hourly job, no first contact past the deadline | rep + sales manager | in_app |
| `deal.needs_approval` | `fn_submit_deal` needing approval | sales manager | in_app |
| `approval.requested` | freeze, refund, transfer, expiry extension | sales manager | in_app |
| `approval.requested` | attendance edit | head coach | in_app |
| `approval.decided` | any decision | requester | in_app |
| `payment.recorded` | every payment | client ("N sessions available") | whatsapp |
| `client.created` | provision-client Edge Function | client (welcome + app link) | whatsapp |
| `coach.assigned` | pack paid or reassignment | coach (welcome-call task), client | in_app / whatsapp |
| `client.pt_purchased` | pack paid | head coach ("client → coach") | in_app |
| `client.reassigned` | reassignment | previous coach | in_app |
| `session.added` | one-off session | client | whatsapp |
| `session.reminder_24h`, `session.reminder_2h` | hourly job (23–25h and 1–3h ahead; a session added later than that gets only the 2h one) | client | whatsapp |
| `session.completed` / `session.no_show` | attendance | client ("N sessions left with your coach") | push |
| `session.waived` | waiver | head coach | in_app |
| `credits.low` | balance with the coach ≤ 2 at the moment it happens (weekly cap per client); hourly job also covers "expiring within 7 days" | coach, rep; client (job, whatsapp) | in_app / whatsapp |
| `credits.expiring_14d` | hourly job, once per pack | client, coach | whatsapp / in_app |
| `credit.expired` | nightly expiry | client, coach | in_app |
| `credit.expiry_extended` | (event only; the client sees the new date in the app) | — | — |
| `client.flagged` | unpaid session, kiosk refusal, upsell, renewal request | rep + sales manager, same second; coach too for renewal requests | in_app (Realtime) |
| `program.activated` | program set active | client | push |
| `client.at_risk` | nightly, score ≥ `risk.at_risk_threshold`, weekly cap | coach, head coach | in_app |
| `freeze.started` / `freeze.ended` | approval / auto-end | client | whatsapp |
| digests (M7, rendered by `notify`) | 20:00 daily / Sat 09:00 weekly | head coach + sales manager / top management | email |
