-- GymOS — 0001_init.sql
-- Schema, enums, RLS helpers, policies, business functions.
-- Tested on Postgres 16. Apply with `supabase db reset` (local) or `supabase db push`.
-- Do not edit after it has been applied anywhere; add 0003_*.sql (and up) instead.

create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. ENUMS
-- =====================================================================
create type app_role as enum ('top_management','head_coach','coach','nutritionist','sales_manager','sales_rep','front_desk','client');
create type lead_status as enum ('new','contacted','onboarded','quoted','won','lost');
create type lost_reason as enum ('price','location','timing','went_elsewhere','no_response','not_interested','duplicate','other');
create type review_status as enum ('not_required','pending','approved','rejected');
create type touch_type as enum ('call','whatsapp','visit','email','instagram','note');
create type touch_direction as enum ('outbound','inbound');
create type follow_up_status as enum ('open','done','skipped');
create type product_type as enum ('membership','pt_pack','nutrition','bundle');
create type deal_status as enum ('draft','pending_approval','approved','partially_paid','paid','cancelled');
create type payment_plan as enum ('single','installments');
create type payment_method as enum ('cash','card','instapay','bank_transfer','other');
create type approval_type as enum ('discount','installments','freeze','refund','transfer','attendance_edit','payment_void','lead_reassign','expiry_extension');
create type approval_status as enum ('pending','approved','rejected');
create type client_status as enum ('active','frozen','lapsed');
create type entitlement_type as enum ('membership','nutrition');
create type entitlement_status as enum ('active','frozen','expired','cancelled');
create type lot_status as enum ('active','exhausted','expired','refunded');
create type credit_entry_type as enum ('issue','consume','expire','refund','adjust','restore');
create type freeze_status as enum ('pending','active','ended','rejected');
create type session_status as enum ('booked','completed','no_show','cancelled');
create type slot_kind as enum ('client','class','blocked');
create type visit_method as enum ('qr','phone','staff','session');
create type program_status as enum ('draft','active','archived');
create type note_visibility as enum ('coaching','sales','all');
create type notification_channel as enum ('in_app','whatsapp','email','push');
create type notification_status as enum ('pending','sent','failed','read');
create type target_scope as enum ('branch','membership');

-- =====================================================================
-- 2. TABLES — identity and org
-- =====================================================================
create table branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  phone text,
  timezone text not null default 'Africa/Cairo',
  opening_hours jsonb not null default '{"open":"06:00","close":"24:00"}',   -- 06:00 to midnight (decision 19); "24:00" is a valid Postgres time
  settings_override jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text unique,
  email text,
  gender text check (gender in ('male','female')),
  date_of_birth date,
  preferred_language text not null default 'en' check (preferred_language in ('en','ar')),
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  branch_id uuid references branches(id),
  role app_role not null,
  is_active boolean not null default true,
  capacity int,                          -- coaches: max active clients
  specialties text[] not null default '{}',
  rotation_paused boolean not null default false,
  discount_allowance_pct numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (profile_id, branch_id, role),
  check ((role = 'top_management' and branch_id is null) or (role <> 'top_management' and branch_id is not null))
);
create index on memberships (profile_id);
create index on memberships (branch_id, role) where is_active;

create table settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 3. TABLES — sales
-- =====================================================================
create table lead_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id),
  full_name text not null,
  phone text not null,
  email text,
  source_id uuid references lead_sources(id),
  referred_by_client_id uuid,            -- fk added after clients
  owner_membership_id uuid references memberships(id),
  status lead_status not null default 'new',
  lost_reason lost_reason,
  lost_note text,
  interest_tags text[] not null default '{}',
  onboarding_token text unique,
  onboarding_token_expires_at timestamptz,
  onboarding_completed_at timestamptz,
  onboarding_responses jsonb not null default '{}',
  onboarding_schema_version int,
  instagram_handle text,
  consent_marketing boolean,
  consent_content boolean,
  first_contact_due_at timestamptz,
  first_contact_at timestamptz,
  review_status review_status not null default 'not_required',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  review_note text,
  converted_client_id uuid,              -- fk added after clients
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'lost' or lost_reason is not null),
  check (status <> 'won' or converted_client_id is not null)
);
create unique index leads_active_phone_uidx on leads (phone) where status <> 'lost';
create index on leads (branch_id, status);
create index on leads (owner_membership_id, status);

create table round_robin_state (
  branch_id uuid primary key references branches(id),
  last_membership_id uuid references memberships(id)
);

-- =====================================================================
-- 4. TABLES — catalog and money
-- =====================================================================
create table products (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),   -- null = all branches
  code text not null,
  name text not null,
  type product_type not null,
  duration_days int,
  session_count int,
  session_minutes int not null default 60,
  expiry_days int,
  price_piastres bigint not null check (price_piastres >= 0),
  per_session_value_piastres bigint generated always as (case when type = 'pt_pack' and session_count > 0 then price_piastres / session_count else null end) stored,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (code, branch_id),
  check (type <> 'pt_pack' or session_count > 0),
  check (type not in ('membership','nutrition') or duration_days > 0)
);

create table bundle_items (
  bundle_product_id uuid not null references products(id) on delete cascade,
  product_id uuid not null references products(id),
  qty int not null default 1 check (qty > 0),
  primary key (bundle_product_id, product_id)
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references profiles(id),
  home_branch_id uuid not null references branches(id),
  full_name text not null,
  phone text not null unique,
  email text,
  gender text check (gender in ('male','female')),
  date_of_birth date,
  lead_id uuid references leads(id),
  rep_membership_id uuid references memberships(id),
  coach_membership_id uuid references memberships(id),
  nutritionist_membership_id uuid references memberships(id),
  status client_status not null default 'active',
  joined_at timestamptz not null default now(),
  onboarding_responses jsonb not null default '{}',
  injuries text,
  instagram_handle text,
  risk_score int not null default 0,
  risk_reasons jsonb not null default '[]',
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on clients (home_branch_id, status);
create index on clients (coach_membership_id);
create index on clients (rep_membership_id);

alter table leads add constraint leads_referred_by_fk foreign key (referred_by_client_id) references clients(id);
alter table leads add constraint leads_converted_client_fk foreign key (converted_client_id) references clients(id);

create table touches (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  type touch_type not null,
  direction touch_direction not null default 'outbound',
  note text,
  by_profile_id uuid not null references profiles(id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((lead_id is null) <> (client_id is null))
);
create index on touches (lead_id, occurred_at desc);
create index on touches (client_id, occurred_at desc);

create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  assigned_to_membership_id uuid not null references memberships(id),
  title text not null,
  due_at timestamptz not null,
  status follow_up_status not null default 'open',
  completed_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check ((lead_id is null) <> (client_id is null))
);
create index on follow_ups (assigned_to_membership_id, status, due_at);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  type approval_type not null,
  subject_table text not null,
  subject_id uuid not null,
  branch_id uuid references branches(id),
  requested_by uuid not null references profiles(id),
  requested_at timestamptz not null default now(),
  reason text,
  payload jsonb not null default '{}',
  status approval_status not null default 'pending',
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  decision_note text
);
create index on approvals (status, branch_id);

create table deals (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id),
  lead_id uuid references leads(id),
  client_id uuid references clients(id),
  rep_membership_id uuid references memberships(id),
  closer_membership_id uuid references memberships(id),
  status deal_status not null default 'draft',
  subtotal_piastres bigint not null default 0,
  discount_pct numeric(5,2) not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  discount_fixed_piastres bigint not null default 0 check (discount_fixed_piastres >= 0),
  discount_piastres bigint not null default 0,
  total_piastres bigint not null default 0,
  paid_piastres bigint not null default 0,
  payment_plan payment_plan not null default 'single',
  installments_count int not null default 1 check (installments_count >= 1),
  approval_id uuid references approvals(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  is_renewal boolean not null default false,
  notes text,
  first_paid_at timestamptz,          -- booked revenue is dated here (first payment); paid_at = fully paid
  paid_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lead_id is not null or client_id is not null)
);
create index on deals (branch_id, status);
create index on deals (rep_membership_id, status);
create index on deals (client_id);

create table deal_items (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  product_id uuid not null references products(id),
  qty int not null default 1 check (qty > 0),
  unit_price_piastres bigint not null default 0,
  line_total_piastres bigint not null default 0,
  product_type product_type,
  session_count int,
  duration_days int,
  expiry_days int,
  provider_membership_id uuid references memberships(id),   -- PT: the coach the pack is sold under (required); nutrition: the nutritionist
  credits_issued int not null default 0,
  created_at timestamptz not null default now()
);
create index on deal_items (deal_id);
create index on deal_items (provider_membership_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id),
  amount_piastres bigint not null check (amount_piastres > 0),
  method payment_method not null,
  reference text,
  received_at timestamptz not null default now(),
  recorded_by uuid not null references profiles(id),
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now()
);
create index on payments (deal_id);

-- =====================================================================
-- 5. TABLES — clients, entitlements, credits
-- =====================================================================
create table coach_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  coach_membership_id uuid not null references memberships(id),
  assigned_by uuid references profiles(id),
  reason text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text
);
create unique index coach_assignments_open_uidx on coach_assignments (client_id) where ended_at is null;

create table entitlements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  deal_item_id uuid references deal_items(id),
  product_id uuid references products(id),
  type entitlement_type not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status entitlement_status not null default 'active',
  created_at timestamptz not null default now()
);
create index on entitlements (client_id, status);

create table credit_lots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  deal_item_id uuid references deal_items(id),
  coach_membership_id uuid not null references memberships(id),   -- a pack belongs to one coach; sessions with another coach cannot burn it
  qty_issued int not null check (qty_issued > 0),
  qty_remaining int not null check (qty_remaining >= 0),
  per_session_value_piastres bigint not null default 0,            -- gross: line total / sessions
  tax_pct numeric(5,2) not null default 0,                          -- snapshot of commission.tax_pct at issue
  net_per_session_value_piastres bigint not null default 0,        -- gross × (100 − tax_pct) / 100; commission base
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status lot_status not null default 'active',
  created_at timestamptz not null default now()
);
create index on credit_lots (client_id, status, expires_at);
create index on credit_lots (coach_membership_id, status);

create table credit_ledger (
  id bigserial primary key,
  client_id uuid not null references clients(id) on delete cascade,
  lot_id uuid references credit_lots(id),
  session_id uuid,                        -- fk added after sessions
  entry_type credit_entry_type not null,
  qty int not null,
  reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on credit_ledger (client_id, created_at desc);

create table freezes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  days int generated always as (greatest(1, ceil(extract(epoch from (ends_at - starts_at)) / 86400)::int)) stored,
  approval_id uuid references approvals(id),
  status freeze_status not null default 'pending',
  reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- =====================================================================
-- 6. TABLES — coaching
-- =====================================================================
create table coach_availability (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references memberships(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index on coach_availability (membership_id, weekday);

-- The coach's weekly schedule: recurring slots (a client at 08:00 Sat/Mon/Wed, a class at 11:00, a blocked hour).
-- Sessions for a given day are materialized from client slots by fn_materialize_sessions; attendance is taken on the session.
create table schedule_slots (
  id uuid primary key default gen_random_uuid(),
  coach_membership_id uuid not null references memberships(id),
  branch_id uuid not null references branches(id),
  weekday int not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_time time not null,
  duration_minutes int not null default 60 check (duration_minutes between 15 and 240),
  kind slot_kind not null default 'client',
  client_id uuid references clients(id),
  label text,                                              -- class name or reason for a blocked slot
  starts_on date not null default current_date,
  ends_on date,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'client') = (client_id is not null)),
  check (ends_on is null or ends_on >= starts_on)
);
create index on schedule_slots (coach_membership_id, weekday) where is_active;
create index on schedule_slots (client_id) where is_active;

-- One-off exceptions: skip a slot on a date (holiday, client travelling)
create table schedule_skips (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references schedule_slots(id) on delete cascade,
  skip_date date not null,
  reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (slot_id, skip_date)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  coach_membership_id uuid not null references memberships(id),
  branch_id uuid not null references branches(id),
  scheduled_at timestamptz not null,
  duration_minutes int not null default 60,
  status session_status not null default 'booked',
  outcome_recorded_at timestamptz,
  outcome_recorded_by uuid references profiles(id),
  lot_id uuid references credit_lots(id),
  credit_consumed boolean not null default false,
  waived boolean not null default false,
  waive_reason text,
  unpaid boolean not null default false,                   -- delivered with zero credits; settled from the next pack
  settled_at timestamptz,
  is_walk_in boolean not null default false,
  slot_id uuid references schedule_slots(id),              -- set when materialized from the weekly schedule
  cancel_reason text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on sessions (coach_membership_id, scheduled_at);
create index on sessions (client_id, scheduled_at desc);
create index on sessions (branch_id, scheduled_at);
create unique index sessions_slot_day_uidx on sessions (slot_id, scheduled_at) where slot_id is not null;
create index on sessions (client_id) where unpaid;
alter table credit_ledger add constraint credit_ledger_session_fk foreign key (session_id) references sessions(id);

create table visits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  branch_id uuid not null references branches(id),
  checked_in_at timestamptz not null default now(),
  method visit_method not null,
  recorded_by uuid references profiles(id)
);
create index on visits (branch_id, checked_in_at);
create index on visits (client_id, checked_in_at desc);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  muscle_group text,
  equipment text,
  movement_pattern text,
  video_url text,
  cues text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table program_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_membership_id uuid references memberships(id),   -- null = gym-wide
  branch_id uuid references branches(id),
  structure jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table programs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  coach_membership_id uuid not null references memberships(id),
  name text not null,
  goal text,
  weeks int not null default 4,
  starts_at date,
  ends_at date,
  status program_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index programs_one_active_uidx on programs (client_id) where status = 'active';

create table program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  day_index int not null,
  name text not null,
  unique (program_id, day_index)
);

create table program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references program_days(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  order_index int not null,
  sets int not null default 3,
  reps text not null default '10',
  tempo text,
  rest_seconds int,
  target_weight_kg numeric(6,2),
  notes text,
  superset_group text
);
create index on program_exercises (program_day_id, order_index);

create table workout_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  program_day_id uuid references program_days(id),
  session_id uuid references sessions(id),
  performed_at timestamptz not null default now(),
  duration_minutes int,
  notes text,
  synced_at timestamptz not null default now()
);
create index on workout_logs (client_id, performed_at desc);

create table set_logs (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references workout_logs(id) on delete cascade,
  program_exercise_id uuid references program_exercises(id),
  exercise_id uuid not null references exercises(id),
  set_index int not null,
  weight_kg numeric(6,2),
  reps int,
  rpe numeric(3,1),
  is_pr boolean not null default false
);
create index on set_logs (workout_log_id);

create table body_metrics (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_kg numeric(5,2),
  body_fat_pct numeric(4,1),
  measurements jsonb not null default '{}',
  source text not null default 'client' check (source in ('client','coach'))
);

create table nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  owner_membership_id uuid references memberships(id),
  targets jsonb not null default '{}',
  notes text,
  file_url text,
  starts_at date,
  ends_at date,
  status text not null default 'active' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now()
);

create table client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  author_membership_id uuid not null references memberships(id),
  body text not null,
  visibility note_visibility not null default 'coaching',
  created_at timestamptz not null default now()
);
create index on client_notes (client_id, created_at desc);

-- =====================================================================
-- 7. TABLES — governance
-- =====================================================================
create table events (
  id bigserial primary key,
  type text not null,
  actor_profile_id uuid,
  branch_id uuid,
  subject_table text,
  subject_id uuid,
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);
create index on events (type, occurred_at desc);
create index on events (branch_id, occurred_at desc);
create index on events (subject_table, subject_id);

create table audit_log (
  id bigserial primary key,
  table_name text not null,
  row_id uuid,
  branch_id uuid,
  action text not null,
  old_row jsonb,
  new_row jsonb,
  actor_profile_id uuid,
  occurred_at timestamptz not null default now()
);
create index on audit_log (table_name, row_id);
create index on audit_log (branch_id, occurred_at desc);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid references profiles(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,   -- for clients not yet provisioned; provision-client backfills recipient_profile_id
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}',
  channel notification_channel not null default 'in_app',
  status notification_status not null default 'pending',
  read_at timestamptz,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  check (recipient_profile_id is not null or client_id is not null)
);
create index on notifications (recipient_profile_id, status, created_at desc);
create index on notifications (client_id) where recipient_profile_id is null;

create table targets (
  id uuid primary key default gen_random_uuid(),
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  scope_type target_scope not null,
  scope_id uuid not null,
  metric text not null,
  value numeric not null,
  created_by uuid references profiles(id),
  unique (period, scope_type, scope_id, metric)
);

-- =====================================================================
-- 8. GENERIC TRIGGERS
-- =====================================================================
create or replace function tg_set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['profiles','leads','clients','deals','sessions','programs','schedule_slots'] loop
    execute format('create trigger %I_updated_at before update on %I for each row execute function tg_set_updated_at()', t, t);
  end loop;
end $$;

create or replace function tg_audit() returns trigger language plpgsql security definer set search_path = public as $$
declare rid uuid; j jsonb; b uuid;
begin
  j := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  begin rid := (j->>'id')::uuid; exception when others then rid := null; end;
  begin b := coalesce((j->>'branch_id')::uuid, (j->>'home_branch_id')::uuid); exception when others then b := null; end;
  if b is null and j ? 'client_id' then select home_branch_id into b from clients where id = (j->>'client_id')::uuid; end if;
  if b is null and j ? 'deal_id' then select branch_id into b from deals where id = (j->>'deal_id')::uuid; end if;
  if tg_op = 'DELETE' then
    insert into audit_log(table_name,row_id,branch_id,action,old_row,new_row,actor_profile_id) values (tg_table_name,rid,b,tg_op,to_jsonb(old),null,auth.uid());
    return old;
  else
    insert into audit_log(table_name,row_id,branch_id,action,old_row,new_row,actor_profile_id)
      values (tg_table_name,rid,b,tg_op,case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new),auth.uid());
    return new;
  end if;
end $$;

do $$ declare t text; begin
  foreach t in array array['deals','deal_items','payments','credit_lots','credit_ledger','sessions','coach_assignments','approvals','settings','memberships','freezes','schedule_slots','schedule_skips'] loop
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function tg_audit()', t, t);
  end loop;
end $$;

-- head coach must also hold a coach membership in the same branch
create or replace function tg_head_coach_needs_coach() returns trigger language plpgsql as $$
begin
  if new.role = 'head_coach' and new.is_active then
    if not exists (select 1 from memberships m where m.profile_id = new.profile_id and m.branch_id = new.branch_id and m.role = 'coach' and m.is_active) then
      insert into memberships(profile_id, branch_id, role, capacity, specialties)
      values (new.profile_id, new.branch_id, 'coach', coalesce(new.capacity, 20), new.specialties)
      on conflict (profile_id, branch_id, role) do update set is_active = true;
    end if;
  end if;
  return new;
end $$;
create trigger memberships_head_coach after insert or update on memberships for each row execute function tg_head_coach_needs_coach();

-- lead owner must be sales in the same branch
create or replace function tg_lead_owner_check() returns trigger language plpgsql as $$
begin
  if new.owner_membership_id is not null then
    if not exists (select 1 from memberships m where m.id = new.owner_membership_id and m.branch_id = new.branch_id and m.role in ('sales_rep','sales_manager') and m.is_active) then
      raise exception 'lead owner must be an active sales membership in branch %', new.branch_id using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger leads_owner_check before insert or update of owner_membership_id on leads for each row execute function tg_lead_owner_check();

-- first outbound touch on a lead sets first_contact_at and moves new -> contacted
create or replace function tg_touch_first_contact() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null and new.direction = 'outbound' and new.type <> 'note' then
    update leads set first_contact_at = coalesce(first_contact_at, new.occurred_at),
                     status = case when status = 'new' then 'contacted'::lead_status else status end
    where id = new.lead_id;
  end if;
  return new;
end $$;
create trigger touches_first_contact after insert on touches for each row execute function tg_touch_first_contact();

-- program activation and workout logging emit events (these tables are written directly under RLS)
create or replace function tg_program_event() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    perform fn_emit_event('program.activated', 'programs', new.id, (select home_branch_id from clients where id = new.client_id), jsonb_build_object('client_id', new.client_id, 'coach_membership_id', new.coach_membership_id));
    perform fn_notify((select profile_id from clients where id = new.client_id), 'program.activated', 'Your new program is ready', new.name, jsonb_build_object('program_id', new.id), 'push');
  end if;
  return new;
end $$;
create trigger programs_event after insert or update of status on programs for each row execute function tg_program_event();

create or replace function tg_workout_event() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform fn_emit_event('workout.logged', 'workout_logs', new.id, (select home_branch_id from clients where id = new.client_id), jsonb_build_object('client_id', new.client_id, 'program_day_id', new.program_day_id));
  return new;
end $$;
create trigger workout_logs_event after insert on workout_logs for each row execute function tg_workout_event();

-- PR detection (Epley)
create or replace function tg_set_log_pr() returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid; best numeric; e1rm numeric;
begin
  if new.weight_kg is null or new.reps is null or new.reps <= 0 then return new; end if;
  select client_id into cid from workout_logs where id = new.workout_log_id;
  e1rm := new.weight_kg * (1 + new.reps / 30.0);
  select max(s.weight_kg * (1 + s.reps / 30.0)) into best
    from set_logs s join workout_logs w on w.id = s.workout_log_id
   where w.client_id = cid and s.exercise_id = new.exercise_id and s.id <> new.id and s.weight_kg is not null and s.reps > 0;
  new.is_pr := best is null or e1rm > best;
  return new;
end $$;
create trigger set_logs_pr before insert on set_logs for each row execute function tg_set_log_pr();

-- =====================================================================
-- 9. AUTH HELPERS (used by RLS; STABLE, security definer to read memberships)
-- =====================================================================
create or replace function my_profile_id() returns uuid language sql stable as $$ select auth.uid() $$;

create or replace function my_roles() returns table(role app_role, branch_id uuid)
language sql stable security definer set search_path = public as $$
  select m.role, m.branch_id from memberships m where m.profile_id = auth.uid() and m.is_active
$$;

create or replace function is_top_management() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.profile_id = auth.uid() and m.role = 'top_management' and m.is_active)
$$;

create or replace function has_role(r app_role, b uuid default null) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.profile_id = auth.uid() and m.is_active and m.role = r and (b is null or m.branch_id = b))
$$;

create or replace function is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.profile_id = auth.uid() and m.is_active and m.role <> 'client')
$$;

create or replace function my_branch_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select case when is_top_management() then b.id else m.branch_id end
  from memberships m cross join branches b
  where m.profile_id = auth.uid() and m.is_active and (is_top_management() or m.branch_id = b.id)
  group by 1
$$;

create or replace function my_membership_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select m.id from memberships m where m.profile_id = auth.uid() and m.is_active
$$;

create or replace function my_client_id() returns uuid language sql stable security definer set search_path = public as $$
  select c.id from clients c where c.profile_id = auth.uid()
$$;

-- clients I coach (as coach or nutritionist), plus every client in branches where I am head coach
create or replace function my_coach_client_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select c.id from clients c
  where c.coach_membership_id in (select id from memberships where profile_id = auth.uid() and is_active and role = 'coach')
     or c.nutritionist_membership_id in (select id from memberships where profile_id = auth.uid() and is_active and role = 'nutritionist')
     or c.home_branch_id in (select branch_id from memberships where profile_id = auth.uid() and is_active and role = 'head_coach')
$$;

-- clients I sold to (rep) or all clients in branches where I am sales manager / front desk
create or replace function my_sales_client_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select c.id from clients c
  where c.rep_membership_id in (select id from memberships where profile_id = auth.uid() and is_active and role = 'sales_rep')
     or c.home_branch_id in (select branch_id from memberships where profile_id = auth.uid() and is_active and role in ('sales_manager','front_desk'))
$$;

create or replace function my_lead_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select l.id from leads l
  where l.owner_membership_id in (select id from memberships where profile_id = auth.uid() and is_active and role = 'sales_rep')
     or l.branch_id in (select branch_id from memberships where profile_id = auth.uid() and is_active and role = 'sales_manager')
$$;

create or replace function is_coach_of_branch(b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.profile_id = auth.uid() and m.is_active and m.role in ('coach','head_coach','nutritionist') and m.branch_id = b)
$$;

-- =====================================================================
-- 10. SETTINGS HELPERS
-- =====================================================================
create or replace function fn_setting(k text) returns jsonb language sql stable security definer set search_path = public as $$
  select value from settings where key = k
$$;
create or replace function fn_setting_int(k text, d int) returns int language sql stable set search_path = public as $$
  select coalesce((fn_setting(k))::text::int, d)
$$;
create or replace function fn_setting_bool(k text, d boolean) returns boolean language sql stable set search_path = public as $$
  select coalesce((fn_setting(k))::text::boolean, d)
$$;
create or replace function fn_setting_text(k text, d text) returns text language sql stable set search_path = public as $$
  select coalesce(fn_setting(k) #>> '{}', d)
$$;
create or replace function fn_setting_num(k text, d numeric) returns numeric language sql stable set search_path = public as $$
  select coalesce((fn_setting(k))::text::numeric, d)
$$;

-- =====================================================================
-- 11. EVENTS AND NOTIFICATIONS
-- =====================================================================
create or replace function fn_emit_event(p_type text, p_subject_table text, p_subject_id uuid, p_branch_id uuid, p_payload jsonb default '{}')
returns bigint language plpgsql security definer set search_path = public as $$
declare eid bigint;
begin
  insert into events(type, actor_profile_id, branch_id, subject_table, subject_id, payload)
  values (p_type, auth.uid(), p_branch_id, p_subject_table, p_subject_id, coalesce(p_payload,'{}'))
  returning id into eid;
  return eid;
end $$;

create or replace function fn_notify(p_recipient uuid, p_type text, p_title text, p_body text default null, p_data jsonb default '{}', p_channel notification_channel default 'in_app')
returns uuid language plpgsql security definer set search_path = public as $$
declare nid uuid;
begin
  if p_recipient is null then return null; end if;
  insert into notifications(recipient_profile_id, type, title, body, data, channel)
  values (p_recipient, p_type, p_title, p_body, coalesce(p_data,'{}'), p_channel) returning id into nid;
  return nid;
end $$;

-- notify a client: by profile when provisioned, else queued on the client row (provision-client backfills recipient_profile_id)
create or replace function fn_notify_client(p_client_id uuid, p_type text, p_title text, p_body text default null, p_data jsonb default '{}', p_channel notification_channel default 'whatsapp')
returns uuid language plpgsql security definer set search_path = public as $$
declare nid uuid; v_profile uuid;
begin
  select profile_id into v_profile from clients where id = p_client_id;
  insert into notifications(recipient_profile_id, client_id, type, title, body, data, channel)
  values (v_profile, p_client_id, p_type, p_title, p_body, coalesce(p_data,'{}'), p_channel) returning id into nid;
  return nid;
end $$;

-- notify every active holder of a role in a branch
create or replace function fn_notify_role(p_role app_role, p_branch uuid, p_type text, p_title text, p_body text default null, p_data jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select distinct m.profile_id from memberships m where m.role = p_role and m.is_active and (p_branch is null or m.branch_id = p_branch or m.role = 'top_management') loop
    perform fn_notify(r.profile_id, p_type, p_title, p_body, p_data);
  end loop;
end $$;

-- =====================================================================
-- 12. PHONE NORMALIZATION (Egypt-first; the app normalizes too, this is the last line of defence)
-- =====================================================================
create or replace function fn_normalize_phone(p text) returns text language plpgsql immutable as $$
declare d text;
begin
  if p is null then return null; end if;
  d := regexp_replace(p, '[^0-9+]', '', 'g');
  if d like '+%' then return d; end if;
  if d like '00%' then return '+' || substr(d, 3); end if;
  if d like '0%' and length(d) = 11 then return '+20' || substr(d, 2); end if;   -- 01xxxxxxxxx
  if d like '20%' and length(d) = 12 then return '+' || d; end if;
  if length(d) = 10 and d like '1%' then return '+20' || d; end if;
  return '+' || d;
end $$;

-- =====================================================================
-- 12b. OPENING HOURS — push a deadline that falls outside opening hours to the next opening
-- =====================================================================
create or replace function fn_within_opening_hours(p_branch_id uuid, p_t timestamptz) returns timestamptz language plpgsql stable security definer set search_path = public as $$
declare oh jsonb; v_open time; v_close time; v_local timestamp; v_day date; v_tod time;
begin
  select opening_hours into oh from branches where id = p_branch_id;
  v_open := coalesce((oh->>'open')::time, '06:00'); v_close := coalesce((oh->>'close')::time, '24:00');
  v_local := p_t at time zone 'Africa/Cairo'; v_day := v_local::date; v_tod := v_local::time;
  if v_tod < v_open then return (v_day::text || ' ' || v_open::text)::timestamp at time zone 'Africa/Cairo'; end if;
  if v_tod > v_close then return ((v_day + 1)::text || ' ' || v_open::text)::timestamp at time zone 'Africa/Cairo'; end if;
  return p_t;
end $$;

-- =====================================================================
-- 13. SALES FUNCTIONS
-- =====================================================================
create or replace function fn_create_lead(
  p_branch_id uuid, p_full_name text, p_phone text, p_source_code text default 'other',
  p_email text default null, p_interest_tags text[] default '{}', p_referred_by_client_id uuid default null, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_phone text; v_lead leads; v_client clients; v_owner uuid; v_src uuid; v_review review_status; v_id uuid;
        v_sla int; v_inbound boolean;
begin
  if not (is_staff() and (is_top_management() or p_branch_id in (select my_branch_ids()))) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  v_phone := fn_normalize_phone(p_phone);
  select * into v_lead from leads where phone = v_phone and status <> 'lost' limit 1;
  if found then return jsonb_build_object('duplicate', true, 'lead_id', v_lead.id); end if;
  select * into v_client from clients where phone = v_phone limit 1;
  if found then return jsonb_build_object('duplicate', true, 'client_id', v_client.id); end if;

  select id into v_src from lead_sources where code = coalesce(p_source_code,'other');
  -- creator is a rep in this branch -> they own it; otherwise inbound queue
  select id into v_owner from memberships where profile_id = auth.uid() and branch_id = p_branch_id and role = 'sales_rep' and is_active limit 1;
  v_inbound := v_owner is null;
  v_review := case when fn_setting_bool('leads.review_required', false) then 'pending'::review_status else 'not_required'::review_status end;
  v_sla := fn_setting_int('sales.first_contact_sla_hours', 2);

  insert into leads(branch_id, full_name, phone, email, source_id, referred_by_client_id, owner_membership_id, interest_tags, review_status, first_contact_due_at, created_by)
  values (p_branch_id, p_full_name, v_phone, p_email, v_src, p_referred_by_client_id, v_owner, coalesce(p_interest_tags,'{}'), v_review, fn_within_opening_hours(p_branch_id, fn_within_opening_hours(p_branch_id, now()) + make_interval(hours => v_sla)), auth.uid())
  returning id into v_id;

  if p_note is not null then
    insert into touches(lead_id, type, direction, note, by_profile_id) values (v_id, 'note', 'outbound', p_note, auth.uid());
  end if;

  perform fn_emit_event('lead.created', 'leads', v_id, p_branch_id, jsonb_build_object('inbound', v_inbound, 'source', p_source_code));
  if v_inbound then
    if fn_setting_bool('leads.round_robin_enabled', true) and fn_setting_bool('leads.round_robin_auto', false) then
      perform fn_assign_lead(v_id, null, 'round robin');
    else
      perform fn_notify_role('sales_manager', p_branch_id, 'lead.created', 'New inbound lead: ' || p_full_name, 'Assign or round-robin', jsonb_build_object('lead_id', v_id));
    end if;
  end if;
  return jsonb_build_object('duplicate', false, 'lead_id', v_id);
end $$;

create or replace function fn_set_rotation_paused(p_membership_id uuid, p_paused boolean) returns void language plpgsql security definer set search_path = public as $$
declare m memberships;
begin
  select * into m from memberships where id = p_membership_id and role = 'sales_rep';
  if not found then raise exception 'not a sales rep membership'; end if;
  if not (is_top_management() or has_role('sales_manager', m.branch_id)) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  update memberships set rotation_paused = p_paused where id = p_membership_id;
  perform fn_emit_event('rep.rotation_changed', 'memberships', p_membership_id, m.branch_id, jsonb_build_object('paused', p_paused));
end $$;

create or replace function fn_round_robin_next(p_branch_id uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_last uuid; v_next uuid;
begin
  select last_membership_id into v_last from round_robin_state where branch_id = p_branch_id for update;
  select m.id into v_next from memberships m
   where m.branch_id = p_branch_id and m.role = 'sales_rep' and m.is_active and not m.rotation_paused
     and (v_last is null or m.id > v_last)
   order by m.id limit 1;
  if v_next is null then
    select m.id into v_next from memberships m
     where m.branch_id = p_branch_id and m.role = 'sales_rep' and m.is_active and not m.rotation_paused
     order by m.id limit 1;
  end if;
  if v_next is null then raise exception 'no active sales reps in rotation for branch %', p_branch_id using errcode = 'no_data_found'; end if;
  insert into round_robin_state(branch_id, last_membership_id) values (p_branch_id, v_next)
    on conflict (branch_id) do update set last_membership_id = excluded.last_membership_id;
  return v_next;
end $$;

create or replace function fn_assign_lead(p_lead_id uuid, p_membership_id uuid default null, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_lead leads; v_new uuid; v_old uuid; v_new_profile uuid; v_old_profile uuid;
begin
  select * into v_lead from leads where id = p_lead_id for update;
  if not found then raise exception 'lead not found'; end if;
  -- callers: sales manager of the branch, top management, or internal (auth.uid() null in jobs)
  if auth.uid() is not null and not (is_top_management() or has_role('sales_manager', v_lead.branch_id)) then
    raise exception 'only the sales manager can assign leads' using errcode = 'insufficient_privilege';
  end if;
  v_old := v_lead.owner_membership_id;
  if v_old is not null and p_reason is null then
    raise exception 'reassignment requires a reason' using errcode = 'check_violation';
  end if;
  if p_membership_id is null and not fn_setting_bool('leads.round_robin_enabled', true) then raise exception 'round robin is disabled; pick a rep' using errcode = 'check_violation'; end if;
  v_new := coalesce(p_membership_id, fn_round_robin_next(v_lead.branch_id));
  update leads set owner_membership_id = v_new where id = p_lead_id;
  select profile_id into v_new_profile from memberships where id = v_new;
  perform fn_notify(v_new_profile, 'lead.assigned', 'New lead: ' || v_lead.full_name, coalesce(p_reason, 'Contact within SLA'), jsonb_build_object('lead_id', p_lead_id));
  if v_old is not null and v_old <> v_new then
    select profile_id into v_old_profile from memberships where id = v_old;
    perform fn_notify(v_old_profile, 'lead.reassigned', 'Lead reassigned: ' || v_lead.full_name, p_reason, jsonb_build_object('lead_id', p_lead_id));
  end if;
  perform fn_emit_event('lead.assigned', 'leads', p_lead_id, v_lead.branch_id, jsonb_build_object('from', v_old, 'to', v_new, 'reason', p_reason));
  return v_new;
end $$;

create or replace function fn_set_lead_stage(p_lead_id uuid, p_status lead_status, p_lost_reason lost_reason default null, p_lost_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_lead leads; v_order int; v_new_order int;
begin
  select * into v_lead from leads where id = p_lead_id for update;
  if not found then raise exception 'lead not found'; end if;
  if not (is_top_management() or has_role('sales_manager', v_lead.branch_id) or v_lead.owner_membership_id in (select my_membership_ids())) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_status = 'won' then raise exception 'won is set by payment, not manually' using errcode = 'check_violation'; end if;
  if v_lead.status in ('won','lost') then raise exception 'lead is closed' using errcode = 'check_violation'; end if;
  if p_status = 'lost' then
    if p_lost_reason is null then raise exception 'lost reason required' using errcode = 'check_violation'; end if;
    update leads set status = 'lost', lost_reason = p_lost_reason, lost_note = p_lost_note where id = p_lead_id;
  else
    v_order := array_position(array['new','contacted','onboarded','quoted']::text[], v_lead.status::text);
    v_new_order := array_position(array['new','contacted','onboarded','quoted']::text[], p_status::text);
    if v_new_order is null or v_new_order < v_order then raise exception 'stage can only move forward' using errcode = 'check_violation'; end if;
    update leads set status = p_status where id = p_lead_id;
  end if;
  perform fn_emit_event('lead.stage_changed', 'leads', p_lead_id, v_lead.branch_id, jsonb_build_object('from', v_lead.status, 'to', p_status, 'lost_reason', p_lost_reason));
end $$;

create or replace function fn_review_lead(p_lead_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_lead leads;
begin
  select * into v_lead from leads where id = p_lead_id for update;
  if not (is_top_management() or has_role('sales_manager', v_lead.branch_id)) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  update leads set review_status = case when p_approve then 'approved'::review_status else 'rejected'::review_status end, reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note where id = p_lead_id;
  if not p_approve then
    update leads set status = 'lost', lost_reason = 'other', lost_note = coalesce(p_note, 'rejected at review') where id = p_lead_id;
  end if;
  perform fn_emit_event('lead.reviewed', 'leads', p_lead_id, v_lead.branch_id, jsonb_build_object('approved', p_approve));
end $$;

create or replace function fn_issue_onboarding_token(p_lead_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare v_lead leads; v_token text;
begin
  select * into v_lead from leads where id = p_lead_id for update;
  if not (is_top_management() or has_role('sales_manager', v_lead.branch_id) or has_role('front_desk', v_lead.branch_id) or v_lead.owner_membership_id in (select my_membership_ids())) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  update leads set onboarding_token = v_token, onboarding_token_expires_at = now() + interval '7 days' where id = p_lead_id;
  perform fn_emit_event('lead.onboarding_sent', 'leads', p_lead_id, v_lead.branch_id, '{}');
  return v_token;
end $$;

-- Called by the public wizard (anon). Never leaks lead data.
create or replace function fn_submit_onboarding(p_token text, p_step text, p_answers jsonb, p_complete boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_lead leads; v_rep text;
begin
  select * into v_lead from leads where onboarding_token = p_token for update;
  if not found or v_lead.onboarding_token_expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired');
  end if;
  if v_lead.status in ('won','lost') then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;

  update leads set onboarding_responses = onboarding_responses || jsonb_build_object(p_step, p_answers),
                   onboarding_schema_version = 1
   where id = v_lead.id;

  if p_complete then
    update leads set onboarding_completed_at = now(),
                     status = case when status in ('new','contacted') then 'onboarded'::lead_status else status end,
                     instagram_handle = coalesce(onboarding_responses #>> '{social,instagram_handle}', instagram_handle),
                     consent_marketing = coalesce((onboarding_responses #>> '{social,consent_marketing}')::boolean, consent_marketing),
                     consent_content = coalesce((onboarding_responses #>> '{social,consent_content}')::boolean, consent_content),
                     full_name = coalesce(nullif(onboarding_responses #>> '{identity,full_name}', ''), full_name)
     where id = v_lead.id;
    perform fn_emit_event('lead.onboarded', 'leads', v_lead.id, v_lead.branch_id, '{}');
    if v_lead.owner_membership_id is not null then
      perform fn_notify((select profile_id from memberships where id = v_lead.owner_membership_id), 'lead.onboarded', v_lead.full_name || ' completed onboarding', null, jsonb_build_object('lead_id', v_lead.id));
    end if;
  end if;
  select p.full_name into v_rep from memberships m join profiles p on p.id = m.profile_id where m.id = v_lead.owner_membership_id;
  return jsonb_build_object('ok', true, 'advisor', v_rep, 'contact_by', v_lead.first_contact_due_at);
end $$;

-- =====================================================================
-- 14. DEALS, APPROVALS, PAYMENTS
-- =====================================================================
create or replace function fn_price_deal(p_deal_id uuid) returns deals language plpgsql security definer set search_path = public as $$
declare v_deal deals; v_sub bigint; v_disc bigint; v_bad int;
begin
  select * into v_deal from deals where id = p_deal_id for update;
  if v_deal.status <> 'draft' then raise exception 'deal is not a draft' using errcode = 'check_violation'; end if;
  -- snapshot product data onto items
  update deal_items di set
    unit_price_piastres = p.price_piastres,
    line_total_piastres = p.price_piastres * di.qty,
    product_type = p.type,
    session_count = p.session_count,
    duration_days = p.duration_days,
    expiry_days = p.expiry_days
  from products p where p.id = di.product_id and di.deal_id = p_deal_id;
  -- every PT pack is sold under a coach of the deal's branch
  select count(*) into v_bad from deal_items di
   where di.deal_id = p_deal_id and di.product_type = 'pt_pack'
     and not exists (select 1 from memberships m where m.id = di.provider_membership_id and m.role = 'coach' and m.is_active and m.branch_id = v_deal.branch_id);
  if v_bad > 0 then raise exception 'each PT pack must be recorded under an active coach of this branch' using errcode = 'check_violation'; end if;
  select count(*) into v_bad from deal_items di
   where di.deal_id = p_deal_id and di.product_type = 'nutrition' and di.provider_membership_id is not null
     and not exists (select 1 from memberships m where m.id = di.provider_membership_id and m.role in ('nutritionist','coach') and m.is_active and m.branch_id = v_deal.branch_id);
  if v_bad > 0 then raise exception 'nutrition provider must be an active nutritionist or coach of this branch' using errcode = 'check_violation'; end if;
  select coalesce(sum(line_total_piastres),0) into v_sub from deal_items where deal_id = p_deal_id;
  v_disc := greatest(v_deal.discount_fixed_piastres, round(v_sub * v_deal.discount_pct / 100.0));
  v_disc := least(v_disc, v_sub);
  update deals set subtotal_piastres = v_sub, discount_piastres = v_disc, total_piastres = v_sub - v_disc where id = p_deal_id returning * into v_deal;
  return v_deal;
end $$;

create or replace function fn_submit_deal(p_deal_id uuid) returns deals language plpgsql security definer set search_path = public as $$
declare v_deal deals; v_allow numeric; v_needs boolean := false; v_type approval_type; v_aid uuid; v_eff_pct numeric;
begin
  select * into v_deal from deals where id = p_deal_id for update;
  if v_deal.status <> 'draft' then raise exception 'deal is not a draft' using errcode = 'check_violation'; end if;
  if not (is_top_management() or has_role('sales_manager', v_deal.branch_id) or v_deal.rep_membership_id in (select my_membership_ids()) or v_deal.closer_membership_id in (select my_membership_ids())) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  v_deal := fn_price_deal(p_deal_id);
  if v_deal.payment_plan = 'installments' and not fn_setting_bool('payments.installments_enabled', true) then raise exception 'installments are disabled' using errcode = 'check_violation'; end if;
  if v_deal.total_piastres <= 0 then v_needs := true; v_type := 'discount'; end if;
  if not fn_setting_bool('deals.auto_approve_list_price', true) and not is_top_management() and not has_role('sales_manager', v_deal.branch_id) then v_needs := true; v_type := 'discount'; end if;
  select coalesce(max(discount_allowance_pct),0) into v_allow from memberships where id in (select my_membership_ids());
  v_eff_pct := case when v_deal.subtotal_piastres > 0 then v_deal.discount_piastres * 100.0 / v_deal.subtotal_piastres else 0 end;
  if v_eff_pct > v_allow and not is_top_management() and not has_role('sales_manager', v_deal.branch_id) then v_needs := true; v_type := 'discount'; end if;
  if v_deal.payment_plan = 'installments' and fn_setting_bool('deals.installments_need_approval', true) and not is_top_management() and not has_role('sales_manager', v_deal.branch_id) then
    v_needs := true; v_type := coalesce(v_type, 'installments');
  end if;
  if v_needs then
    insert into approvals(type, subject_table, subject_id, branch_id, requested_by, reason, payload)
    values (v_type, 'deals', p_deal_id, v_deal.branch_id, auth.uid(), 'deal submission', jsonb_build_object('discount_pct', v_eff_pct, 'total', v_deal.total_piastres, 'plan', v_deal.payment_plan))
    returning id into v_aid;
    update deals set status = 'pending_approval', approval_id = v_aid where id = p_deal_id returning * into v_deal;
    perform fn_notify_role('sales_manager', v_deal.branch_id, 'deal.needs_approval', 'Deal needs approval', format('%s%% discount, %s EGP', round(v_eff_pct,1), v_deal.total_piastres/100), jsonb_build_object('deal_id', p_deal_id, 'approval_id', v_aid));
    perform fn_emit_event('deal.submitted', 'deals', p_deal_id, v_deal.branch_id, jsonb_build_object('needs_approval', true, 'type', v_type));
  else
    update deals set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_deal_id returning * into v_deal;
    perform fn_emit_event('deal.approved', 'deals', p_deal_id, v_deal.branch_id, jsonb_build_object('auto', true));
  end if;
  return v_deal;
end $$;

create or replace function fn_cancel_deal(p_deal_id uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare v_deal deals;
begin
  select * into v_deal from deals where id = p_deal_id for update;
  if v_deal.status in ('partially_paid','paid') then raise exception 'paid deals need a refund approval, not cancellation' using errcode = 'check_violation'; end if;
  if not (is_top_management() or has_role('sales_manager', v_deal.branch_id) or v_deal.rep_membership_id in (select my_membership_ids())) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  update deals set status = 'cancelled', notes = coalesce(notes,'') || E'\nCancelled: ' || p_reason where id = p_deal_id;
  perform fn_emit_event('deal.cancelled', 'deals', p_deal_id, v_deal.branch_id, jsonb_build_object('reason', p_reason));
end $$;

create or replace function fn_convert_lead(p_lead_id uuid, p_deal_id uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_lead leads; v_cid uuid; v_deal deals;
begin
  select * into v_lead from leads where id = p_lead_id for update;
  select * into v_deal from deals where id = p_deal_id;
  if v_lead.converted_client_id is not null then return v_lead.converted_client_id; end if;
  select id into v_cid from clients where phone = v_lead.phone;
  if v_cid is null then
    insert into clients(home_branch_id, full_name, phone, email, gender, date_of_birth, lead_id, rep_membership_id, onboarding_responses, injuries, instagram_handle)
    values (v_lead.branch_id, v_lead.full_name, v_lead.phone, v_lead.email,
            v_lead.onboarding_responses #>> '{identity,gender}',
            nullif(v_lead.onboarding_responses #>> '{identity,date_of_birth}','')::date,
            v_lead.id, coalesce(v_deal.rep_membership_id, v_lead.owner_membership_id),
            v_lead.onboarding_responses, v_lead.onboarding_responses #>> '{health,injuries}', v_lead.instagram_handle)
    returning id into v_cid;
    perform fn_emit_event('client.created', 'clients', v_cid, v_lead.branch_id, jsonb_build_object('lead_id', p_lead_id, 'deal_id', p_deal_id));
  end if;
  update leads set status = 'won', converted_client_id = v_cid where id = p_lead_id;
  update deals set client_id = v_cid where id = p_deal_id and client_id is null;
  perform fn_emit_event('lead.stage_changed', 'leads', p_lead_id, v_lead.branch_id, jsonb_build_object('from', v_lead.status, 'to', 'won'));
  return v_cid;
end $$;

create or replace function fn_issue_credits(p_client_id uuid, p_deal_item_id uuid, p_qty int, p_per_session_value bigint, p_expiry_days int default null, p_coach_membership_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_lot uuid; v_days int; v_branch uuid; v_coach uuid; v_tax numeric; v_net bigint;
begin
  if p_qty <= 0 then raise exception 'qty must be positive'; end if;
  v_coach := coalesce(p_coach_membership_id, (select provider_membership_id from deal_items where id = p_deal_item_id));
  if v_coach is null then raise exception 'credits must be issued under a coach' using errcode = 'check_violation'; end if;
  v_days := coalesce(p_expiry_days, case when p_qty <= 12 then fn_setting_int('credits.expiry_days_small', 90) else fn_setting_int('credits.expiry_days_large', 180) end);
  v_tax := fn_setting_num('commission.tax_pct', 14);
  v_net := round(coalesce(p_per_session_value,0) * (100 - v_tax) / 100.0);
  insert into credit_lots(client_id, deal_item_id, coach_membership_id, qty_issued, qty_remaining, per_session_value_piastres, tax_pct, net_per_session_value_piastres, expires_at)
  values (p_client_id, p_deal_item_id, v_coach, p_qty, p_qty, coalesce(p_per_session_value,0), v_tax, v_net, now() + make_interval(days => v_days))
  returning id into v_lot;
  insert into credit_ledger(client_id, lot_id, entry_type, qty, reason, created_by) values (p_client_id, v_lot, 'issue', p_qty, 'purchase', auth.uid());
  if p_deal_item_id is not null then update deal_items set credits_issued = credits_issued + p_qty where id = p_deal_item_id; end if;
  select home_branch_id into v_branch from clients where id = p_client_id;
  perform fn_emit_event('credit.issued', 'credit_lots', v_lot, v_branch, jsonb_build_object('client_id', p_client_id, 'coach_membership_id', v_coach, 'qty', p_qty, 'value', p_per_session_value, 'net_value', v_net, 'expires_at', now() + make_interval(days => v_days)));
  return v_lot;
end $$;

-- balance overall, or with one coach (packs are coach-bound)
create or replace function fn_credit_balance(p_client_id uuid, p_coach_membership_id uuid default null) returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(qty_remaining),0)::int from credit_lots
   where client_id = p_client_id and status = 'active' and expires_at > now()
     and (p_coach_membership_id is null or coach_membership_id = p_coach_membership_id)
$$;

-- balances per coach for a client (the client app and coach screens show "8 with Sara, 3 with Ahmed")
create or replace function fn_credit_balances(p_client_id uuid)
returns table(coach_membership_id uuid, coach_name text, balance int, next_expiry timestamptz) language sql stable security definer set search_path = public as $$
  select l.coach_membership_id, p.full_name, sum(l.qty_remaining)::int, min(l.expires_at)
  from credit_lots l join memberships m on m.id = l.coach_membership_id join profiles p on p.id = m.profile_id
  where l.client_id = p_client_id and l.status = 'active' and l.expires_at > now()
  group by 1, 2 order by 3 desc
$$;

create or replace function fn_record_payment(p_deal_id uuid, p_amount bigint, p_method payment_method, p_reference text default null, p_received_at timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_deal deals; v_pid uuid; v_cid uuid; v_item record; v_release int; v_first boolean; v_min_pct numeric; v_start timestamptz; v_client clients; v_coach_name text; v_settled int := 0;
begin
  select * into v_deal from deals where id = p_deal_id for update;
  if not found then raise exception 'deal not found'; end if;
  if v_deal.status not in ('approved','partially_paid') then raise exception 'deal must be approved before payment (status %)', v_deal.status using errcode = 'check_violation'; end if;
  if not (is_top_management() or has_role('sales_manager', v_deal.branch_id) or has_role('front_desk', v_deal.branch_id) or v_deal.rep_membership_id in (select my_membership_ids()) or v_deal.closer_membership_id in (select my_membership_ids())) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if v_deal.paid_piastres + p_amount > v_deal.total_piastres then raise exception 'overpayment: % remaining', v_deal.total_piastres - v_deal.paid_piastres using errcode = 'check_violation'; end if;
  v_first := v_deal.paid_piastres = 0;
  v_min_pct := fn_setting_num('payments.min_first_payment_pct', 30);
  if v_first and v_deal.total_piastres > 0 and p_amount * 100.0 / v_deal.total_piastres < v_min_pct and v_deal.paid_piastres + p_amount < v_deal.total_piastres then
    raise exception 'first payment must be at least % percent of the total', v_min_pct using errcode = 'check_violation';
  end if;

  insert into payments(deal_id, amount_piastres, method, reference, received_at, recorded_by) values (p_deal_id, p_amount, p_method, p_reference, p_received_at, auth.uid()) returning id into v_pid;
  update deals set paid_piastres = paid_piastres + p_amount,
                   status = case when paid_piastres + p_amount >= total_piastres then 'paid'::deal_status else 'partially_paid'::deal_status end,
                   first_paid_at = coalesce(first_paid_at, p_received_at),
                   paid_at = case when paid_piastres + p_amount >= total_piastres then now() else paid_at end
   where id = p_deal_id returning * into v_deal;

  -- 1. convert lead -> client
  v_cid := v_deal.client_id;
  if v_cid is null and v_deal.lead_id is not null then v_cid := fn_convert_lead(v_deal.lead_id, p_deal_id); end if;
  if v_cid is null then raise exception 'deal has no client'; end if;
  update clients set status = 'active' where id = v_cid and status = 'lapsed';

  -- 2. release credits pro-rata under the item's coach; 3. entitlements on first payment; 4. nutritionist
  v_start := p_received_at;
  for v_item in select * from deal_items where deal_id = p_deal_id loop
    if v_item.product_type = 'pt_pack' then
      v_release := floor(v_item.session_count * v_item.qty * v_deal.paid_piastres::numeric / nullif(v_deal.total_piastres,0))::int - v_item.credits_issued;
      if v_deal.status = 'paid' then v_release := v_item.session_count * v_item.qty - v_item.credits_issued; end if;
      if v_release > 0 then
        perform fn_issue_credits(v_cid, v_item.id, v_release, case when v_item.session_count > 0 then round(v_item.line_total_piastres::numeric / (v_item.session_count * v_item.qty))::bigint else 0 end, v_item.expiry_days, v_item.provider_membership_id);
        -- the pack's coach becomes the client's coach (first pack) — no separate assignment step
        perform fn_set_primary_coach(v_cid, v_item.provider_membership_id, 'PT pack purchased');
        -- settle sessions delivered on zero credits with this coach, oldest first
        v_settled := v_settled + fn_settle_unpaid_sessions(v_cid, v_item.provider_membership_id);
      end if;
    elsif v_item.product_type in ('membership','nutrition') and v_first then
      insert into entitlements(client_id, deal_item_id, product_id, type, starts_at, ends_at)
      values (v_cid, v_item.id, v_item.product_id, v_item.product_type::text::entitlement_type, v_start, v_start + make_interval(days => v_item.duration_days * v_item.qty));
      if v_item.product_type = 'nutrition' and v_item.provider_membership_id is not null then
        update clients set nutritionist_membership_id = v_item.provider_membership_id where id = v_cid;
      end if;
    end if;
  end loop;

  select * into v_client from clients where id = v_cid;
  perform fn_emit_event('payment.recorded', 'payments', v_pid, v_deal.branch_id, jsonb_build_object('deal_id', p_deal_id, 'client_id', v_cid, 'amount', p_amount, 'method', p_method, 'rep', v_deal.rep_membership_id, 'closer', v_deal.closer_membership_id, 'is_renewal', v_deal.is_renewal, 'settled_sessions', v_settled));
  if v_deal.status = 'paid' then perform fn_emit_event('deal.paid', 'deals', p_deal_id, v_deal.branch_id, jsonb_build_object('client_id', v_cid, 'total', v_deal.total_piastres, 'rep', v_deal.rep_membership_id, 'closer', v_deal.closer_membership_id, 'is_renewal', v_deal.is_renewal)); end if;
  perform fn_notify_client(v_cid, 'payment.recorded', 'Payment received', (p_amount/100) || ' EGP — ' || fn_credit_balance(v_cid) || ' PT sessions available', jsonb_build_object('deal_id', p_deal_id), 'whatsapp');
  return jsonb_build_object('payment_id', v_pid, 'client_id', v_cid, 'deal_status', v_deal.status, 'credit_balance', fn_credit_balance(v_cid), 'settled_sessions', v_settled);
end $$;

-- internal: make a coach the client's primary coach (from a pack purchase or a head-coach reassignment)
create or replace function fn_set_primary_coach(p_client_id uuid, p_coach_membership_id uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare c clients; v_coach memberships; v_sla int;
begin
  select * into c from clients where id = p_client_id for update;
  if c.coach_membership_id = p_coach_membership_id then return; end if;
  select * into v_coach from memberships where id = p_coach_membership_id;
  update coach_assignments set ended_at = now(), end_reason = p_reason where client_id = p_client_id and ended_at is null;
  insert into coach_assignments(client_id, coach_membership_id, assigned_by, reason) values (p_client_id, p_coach_membership_id, auth.uid(), p_reason);
  update clients set coach_membership_id = p_coach_membership_id where id = p_client_id;
  v_sla := fn_setting_int('coaching.consult_sla_hours', 48);
  insert into follow_ups(client_id, assigned_to_membership_id, title, due_at, created_by)
  values (p_client_id, p_coach_membership_id, 'Welcome call with ' || c.full_name, now() + make_interval(hours => v_sla), auth.uid());
  perform fn_notify(v_coach.profile_id, 'coach.assigned', 'New client: ' || c.full_name, 'Welcome call within ' || v_sla || 'h, then set up their weekly slots', jsonb_build_object('client_id', p_client_id));
  perform fn_notify_client(p_client_id, 'coach.assigned', 'Meet your coach', (select full_name from profiles where id = v_coach.profile_id), jsonb_build_object('coach_membership_id', p_coach_membership_id), 'whatsapp');
  perform fn_notify_role('head_coach', v_coach.branch_id, 'client.pt_purchased', c.full_name || ' → ' || (select full_name from profiles where id = v_coach.profile_id), p_reason, jsonb_build_object('client_id', p_client_id, 'coach_membership_id', p_coach_membership_id));
  perform fn_emit_event('coach.assigned', 'clients', p_client_id, c.home_branch_id, jsonb_build_object('from', c.coach_membership_id, 'to', p_coach_membership_id, 'reason', p_reason));
end $$;

-- internal: consume credits for sessions that were delivered unpaid with this coach, oldest first
create or replace function fn_settle_unpaid_sessions(p_client_id uuid, p_coach_membership_id uuid) returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_lot uuid;
begin
  for r in select * from sessions where client_id = p_client_id and coach_membership_id = p_coach_membership_id and unpaid and status = 'completed' order by scheduled_at loop
    exit when fn_credit_balance(p_client_id, p_coach_membership_id) = 0;
    v_lot := fn_consume_credit(p_client_id, r.id, 'settled unpaid session');
    update sessions set unpaid = false, settled_at = now(), credit_consumed = true, lot_id = v_lot where id = r.id;
    perform fn_emit_event('session.settled', 'sessions', r.id, r.branch_id, jsonb_build_object('client_id', p_client_id, 'coach_membership_id', p_coach_membership_id));
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function fn_request_approval(p_type approval_type, p_subject_table text, p_subject_id uuid, p_branch_id uuid, p_reason text, p_payload jsonb default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_aid uuid;
begin
  -- staff may request any type; a client may only request a freeze on their own freeze row
  if not (is_staff() or (p_type = 'freeze' and exists (select 1 from freezes f where f.id = p_subject_id and f.client_id = my_client_id()))) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  insert into approvals(type, subject_table, subject_id, branch_id, requested_by, reason, payload)
  values (p_type, p_subject_table, p_subject_id, p_branch_id, auth.uid(), p_reason, coalesce(p_payload,'{}')) returning id into v_aid;
  perform fn_emit_event('approval.requested', 'approvals', v_aid, p_branch_id, jsonb_build_object('type', p_type, 'subject_table', p_subject_table, 'subject_id', p_subject_id));
  if p_type = 'attendance_edit' then
    perform fn_notify_role('head_coach', p_branch_id, 'approval.requested', 'Attendance edit needs approval', p_reason, jsonb_build_object('approval_id', v_aid));
  else
    perform fn_notify_role('sales_manager', p_branch_id, 'approval.requested', initcap(replace(p_type::text,'_',' ')) || ' needs approval', p_reason, jsonb_build_object('approval_id', v_aid));
  end if;
  return v_aid;
end $$;

create or replace function fn_decide_approval(p_approval_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a approvals; v_deal deals; v_freeze freezes; v_pay payments; v_lot record; v_target uuid;
begin
  select * into a from approvals where id = p_approval_id for update;
  if not found then raise exception 'approval not found'; end if;
  if a.status <> 'pending' then raise exception 'already decided' using errcode = 'check_violation'; end if;
  if a.type = 'attendance_edit' then
    if not (is_top_management() or has_role('head_coach', a.branch_id)) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  else
    if not (is_top_management() or has_role('sales_manager', a.branch_id)) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  end if;
  update approvals set status = case when p_approve then 'approved'::approval_status else 'rejected'::approval_status end, decided_by = auth.uid(), decided_at = now(), decision_note = p_note where id = p_approval_id;

  case a.type
    when 'discount', 'installments' then
      update deals set status = case when p_approve then 'approved'::deal_status else 'cancelled'::deal_status end,
                       approved_by = case when p_approve then auth.uid() end, approved_at = case when p_approve then now() end
       where id = a.subject_id returning * into v_deal;
      perform fn_emit_event(case when p_approve then 'deal.approved' else 'deal.cancelled' end, 'deals', a.subject_id, a.branch_id, jsonb_build_object('approval_id', p_approval_id));
    when 'freeze' then
      if p_approve then
        update freezes set status = 'active' where id = a.subject_id returning * into v_freeze;
        update clients set status = 'frozen' where id = v_freeze.client_id;
        update entitlements set status = 'frozen' where client_id = v_freeze.client_id and status = 'active';
        perform fn_notify_client(v_freeze.client_id, 'freeze.started', 'Freeze approved', v_freeze.days || ' days, until ' || to_char(v_freeze.ends_at at time zone 'Africa/Cairo', 'DD Mon'), jsonb_build_object('freeze_id', v_freeze.id), 'whatsapp');
        perform fn_emit_event('freeze.started', 'freezes', a.subject_id, a.branch_id, jsonb_build_object('client_id', v_freeze.client_id, 'days', v_freeze.days));
      else
        update freezes set status = 'rejected' where id = a.subject_id;
      end if;
    when 'payment_void', 'refund' then
      if p_approve then
        update payments set voided_at = now(), void_reason = coalesce(p_note, a.reason) where id = a.subject_id returning * into v_pay;
        update deals set paid_piastres = greatest(0, paid_piastres - v_pay.amount_piastres),
                         status = case when paid_piastres - v_pay.amount_piastres <= 0 then 'approved'::deal_status else 'partially_paid'::deal_status end, paid_at = null
         where id = v_pay.deal_id;
        -- refund unconsumed credits from lots of this deal
        for v_lot in select cl.* from credit_lots cl join deal_items di on di.id = cl.deal_item_id where di.deal_id = v_pay.deal_id and cl.status = 'active' loop
          insert into credit_ledger(client_id, lot_id, entry_type, qty, reason, created_by) values (v_lot.client_id, v_lot.id, 'refund', -v_lot.qty_remaining, a.type::text, auth.uid());
          update credit_lots set qty_remaining = 0, status = 'refunded' where id = v_lot.id;
        end loop;
        perform fn_emit_event('payment.voided', 'payments', a.subject_id, a.branch_id, jsonb_build_object('deal_id', v_pay.deal_id, 'amount', v_pay.amount_piastres));
      end if;
    when 'transfer' then
      if p_approve then
        v_target := (a.payload->>'to_client_id')::uuid;
        for v_lot in select * from credit_lots where id = a.subject_id loop
          insert into credit_ledger(client_id, lot_id, entry_type, qty, reason, created_by) values (v_lot.client_id, v_lot.id, 'adjust', -v_lot.qty_remaining, 'transfer out', auth.uid());
          update credit_lots set client_id = v_target where id = v_lot.id;
          insert into credit_ledger(client_id, lot_id, entry_type, qty, reason, created_by) values (v_target, v_lot.id, 'adjust', v_lot.qty_remaining, 'transfer in', auth.uid());
        end loop;
      end if;
    when 'attendance_edit' then
      if p_approve then
        perform fn_apply_attendance(a.subject_id, (a.payload->>'outcome')::session_status, coalesce((a.payload->>'waive')::boolean,false), a.payload->>'waive_reason', true);
      end if;
    when 'lead_reassign' then
      if p_approve then perform fn_assign_lead(a.subject_id, (a.payload->>'to_membership_id')::uuid, coalesce(a.reason,'approved reassignment')); end if;
    when 'expiry_extension' then
      if p_approve then perform fn_apply_expiry_extension(a.subject_id, (a.payload->>'new_expires_at')::timestamptz, coalesce(p_note, a.reason)); end if;
  end case;

  perform fn_notify(a.requested_by, 'approval.decided', initcap(replace(a.type::text,'_',' ')) || case when p_approve then ' approved' else ' rejected' end, p_note, jsonb_build_object('approval_id', p_approval_id));
  perform fn_emit_event('approval.decided', 'approvals', p_approval_id, a.branch_id, jsonb_build_object('type', a.type, 'approved', p_approve));
end $$;

-- =====================================================================
-- 15. COACH ASSIGNMENT
-- =====================================================================
-- Suggests coaches for a lead (at deal time, for the rep) or a client (for the head coach). Preferences come from onboarding.
create or replace function fn_rank_coaches(p_client_id uuid default null, p_lead_id uuid default null)
returns table(coach_membership_id uuid, coach_name text, score numeric, active_clients int, capacity int, over_capacity boolean, reasons jsonb)
language plpgsql stable security definer set search_path = public as $$
declare v_resp jsonb; v_branch uuid; v_pref_gender text; v_pref_time text; v_pref_days text[]; v_conditions text[]; v_goal text;
begin
  if p_client_id is not null then
    if not (is_top_management() or p_client_id in (select my_coach_client_ids()) or p_client_id in (select my_sales_client_ids())) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
    select onboarding_responses, home_branch_id into v_resp, v_branch from clients where id = p_client_id;
  elsif p_lead_id is not null then
    if not (is_top_management() or p_lead_id in (select my_lead_ids())) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
    select onboarding_responses, branch_id into v_resp, v_branch from leads where id = p_lead_id;
  else
    raise exception 'client or lead required';
  end if;
  v_pref_gender := coalesce(v_resp #>> '{pt_prefs,trainer_gender}', 'any');
  v_pref_time := v_resp #>> '{pt_prefs,time}';
  select coalesce(array_agg(x), '{}') into v_pref_days from jsonb_array_elements_text(coalesce(v_resp #> '{pt_prefs,days}', '[]')) x;
  select coalesce(array_agg(x), '{}') into v_conditions from jsonb_array_elements_text(coalesce(v_resp #> '{health,conditions}', '[]')) x;
  v_goal := v_resp #>> '{goal,primary}';

  return query
  with coaches as (
    select m.id, p.full_name, p.gender, m.specialties, coalesce(m.capacity, 20) as cap,
           (select count(*) from clients x where x.coach_membership_id = m.id and x.status in ('active','frozen'))::int as load
    from memberships m join profiles p on p.id = m.profile_id
    where m.branch_id = v_branch and m.role = 'coach' and m.is_active
      and (v_pref_gender = 'any' or v_pref_gender is null or p.gender = v_pref_gender)
  ),
  scored as (
    select ch.id, ch.full_name, ch.load, ch.cap,
      (select count(distinct a.weekday) from coach_availability a
        where a.membership_id = ch.id
          and (cardinality(v_pref_days) = 0 or (array['sun','mon','tue','wed','thu','fri','sat'])[a.weekday+1] = any(v_pref_days))
          and (v_pref_time is null or
               (v_pref_time = 'morning'   and a.start_time < '12:00' and a.end_time > '06:00') or
               (v_pref_time = 'afternoon' and a.start_time < '17:00' and a.end_time > '12:00') or
               (v_pref_time = 'evening'   and a.start_time < '23:00' and a.end_time > '17:00'))) as day_overlap,
      (select count(*) from unnest(ch.specialties) s where s = any(v_conditions) or s = v_goal) as spec_matches
    from coaches ch
  )
  select s.id, s.full_name,
         (case when s.day_overlap >= 2 or (v_pref_time is null and s.day_overlap >= 1) then 40 else 0 end
          + least(30, 10 * s.spec_matches)
          + greatest(0, 30 * (1 - s.load::numeric / greatest(1, s.cap))))::numeric(6,1) as score,
         s.load, s.cap, s.load >= s.cap,
         jsonb_build_object('day_overlap', s.day_overlap, 'specialty_matches', s.spec_matches, 'load', s.load, 'capacity', s.cap)
  from scored s
  order by (s.load >= s.cap), score desc, s.load asc;
end $$;

-- Head coach reassigns a client to another coach: the client's active packs move with them, their old slots are closed.
create or replace function fn_assign_coach(p_client_id uuid, p_coach_membership_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c clients; v_old uuid; v_coach memberships; v_moved int; r record;
begin
  select * into c from clients where id = p_client_id for update;
  if not found then raise exception 'client not found'; end if;
  if not (is_top_management() or has_role('head_coach', c.home_branch_id)) then raise exception 'only the head coach can reassign coaches' using errcode = 'insufficient_privilege'; end if;
  select * into v_coach from memberships where id = p_coach_membership_id and role = 'coach' and is_active;
  if not found then raise exception 'not an active coach membership'; end if;
  if v_coach.branch_id <> c.home_branch_id then raise exception 'coach is in another branch' using errcode = 'check_violation'; end if;
  v_old := c.coach_membership_id;
  if v_old = p_coach_membership_id then return; end if;
  if v_old is not null and coalesce(p_reason,'') = '' then raise exception 'reassignment requires a reason' using errcode = 'check_violation'; end if;
  -- move active packs to the new coach (audited via credit_lots trigger)
  update credit_lots set coach_membership_id = p_coach_membership_id where client_id = p_client_id and status = 'active' and coach_membership_id = v_old;
  get diagnostics v_moved = row_count;
  -- close the old coach's weekly slots for this client; the new coach schedules afresh
  update schedule_slots set is_active = false, ends_on = current_date where client_id = p_client_id and coach_membership_id = v_old and is_active;
  for r in select * from sessions where client_id = p_client_id and coach_membership_id = v_old and status = 'booked' and scheduled_at > now() loop
    update sessions set status = 'cancelled', cancel_reason = 'coach reassigned', outcome_recorded_at = now(), outcome_recorded_by = auth.uid() where id = r.id;
    perform fn_emit_event('session.cancelled', 'sessions', r.id, r.branch_id, jsonb_build_object('client_id', r.client_id, 'coach_membership_id', r.coach_membership_id, 'reason', 'coach reassigned', 'scheduled_at', r.scheduled_at));
  end loop;
  perform fn_set_primary_coach(p_client_id, p_coach_membership_id, coalesce(p_reason, 'assigned by head coach'));
  if v_old is not null then perform fn_notify((select profile_id from memberships where id = v_old), 'client.reassigned', c.full_name || ' was reassigned', p_reason, jsonb_build_object('client_id', p_client_id)); end if;
  perform fn_emit_event('coach.reassigned', 'clients', p_client_id, c.home_branch_id, jsonb_build_object('from', v_old, 'to', p_coach_membership_id, 'reason', p_reason, 'lots_moved', v_moved));
end $$;

-- =====================================================================
-- 16. SESSIONS, ATTENDANCE, VISITS
-- =====================================================================
create or replace function fn_consume_credit(p_client_id uuid, p_session_id uuid, p_reason text) returns uuid language plpgsql security definer set search_path = public as $$
declare v_lot credit_lots; s sessions; v_bal int; v_rep uuid;
begin
  select * into s from sessions where id = p_session_id;
  select * into v_lot from credit_lots
   where client_id = p_client_id and coach_membership_id = s.coach_membership_id and status = 'active' and qty_remaining > 0 and expires_at > now()
   order by expires_at asc, issued_at asc limit 1 for update;
  if not found then raise exception 'client has no credits with this coach' using errcode = 'GY001'; end if;
  update credit_lots set qty_remaining = qty_remaining - 1, status = case when qty_remaining - 1 = 0 then 'exhausted'::lot_status else status end where id = v_lot.id;
  insert into credit_ledger(client_id, lot_id, session_id, entry_type, qty, reason, created_by) values (p_client_id, v_lot.id, p_session_id, 'consume', -1, p_reason, auth.uid());
  perform fn_emit_event('credit.consumed', 'sessions', p_session_id, s.branch_id, jsonb_build_object('client_id', p_client_id, 'lot_id', v_lot.id, 'value', v_lot.per_session_value_piastres, 'net_value', v_lot.net_per_session_value_piastres, 'coach_membership_id', s.coach_membership_id, 'reason', p_reason, 'scheduled_at', s.scheduled_at));
  -- low-credit warning to the coach and the rep the moment it happens (once a week per client)
  v_bal := fn_credit_balance(p_client_id, s.coach_membership_id);
  if v_bal <= fn_setting_int('risk.low_credit_threshold', 2)
     and not exists (select 1 from notifications x where x.type = 'credits.low' and x.data->>'client_id' = p_client_id::text and x.created_at > now() - interval '7 days') then
    select rep_membership_id into v_rep from clients where id = p_client_id;
    perform fn_notify((select profile_id from memberships where id = s.coach_membership_id), 'credits.low', (select full_name from clients where id = p_client_id) || ': ' || v_bal || ' sessions left', 'Open the renewal conversation', jsonb_build_object('client_id', p_client_id, 'balance', v_bal));
    perform fn_notify((select profile_id from memberships where id = v_rep), 'credits.low', (select full_name from clients where id = p_client_id) || ': ' || v_bal || ' sessions left', 'Renewal opportunity', jsonb_build_object('client_id', p_client_id, 'balance', v_bal));
  end if;
  return v_lot.id;
end $$;

create or replace function fn_restore_credit(p_session_id uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare s sessions;
begin
  select * into s from sessions where id = p_session_id for update;
  if not s.credit_consumed or s.lot_id is null then return; end if;
  update credit_lots set qty_remaining = qty_remaining + 1, status = case when status = 'exhausted' then 'active'::lot_status else status end where id = s.lot_id;
  insert into credit_ledger(client_id, lot_id, session_id, entry_type, qty, reason, created_by) values (s.client_id, s.lot_id, p_session_id, 'restore', 1, p_reason, auth.uid());
  update sessions set credit_consumed = false, lot_id = null where id = p_session_id;
  perform fn_emit_event('credit.restored', 'sessions', p_session_id, s.branch_id, jsonb_build_object('client_id', s.client_id, 'reason', p_reason));
end $$;

-- One-off session outside the weekly schedule (a make-up, a trial). Coaches only; requires credits with this coach.
create or replace function fn_add_session(p_client_id uuid, p_coach_membership_id uuid, p_scheduled_at timestamptz, p_duration int default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare c clients; m memberships; v_dur int; v_sid uuid;
begin
  select * into c from clients where id = p_client_id;
  select * into m from memberships where id = p_coach_membership_id and role = 'coach' and is_active;
  if c is null or m is null then raise exception 'client or coach not found'; end if;
  if not (is_top_management() or has_role('head_coach', m.branch_id) or p_coach_membership_id in (select my_membership_ids())) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if fn_credit_balance(p_client_id, p_coach_membership_id) <= 0 then raise exception 'client has no credits with this coach' using errcode = 'GY001'; end if;
  v_dur := coalesce(p_duration, fn_setting_int('scheduling.slot_minutes', 60));
  if exists (select 1 from sessions s where s.coach_membership_id = p_coach_membership_id and s.status = 'booked'
             and tstzrange(s.scheduled_at, s.scheduled_at + make_interval(mins => s.duration_minutes)) && tstzrange(p_scheduled_at, p_scheduled_at + make_interval(mins => v_dur))) then
    raise exception 'coach already has a session at that time' using errcode = 'check_violation';
  end if;
  if exists (select 1 from sessions s where s.client_id = p_client_id and s.status = 'booked'
             and tstzrange(s.scheduled_at, s.scheduled_at + make_interval(mins => s.duration_minutes)) && tstzrange(p_scheduled_at, p_scheduled_at + make_interval(mins => v_dur))) then
    raise exception 'client already has a session at that time' using errcode = 'check_violation';
  end if;
  insert into sessions(client_id, coach_membership_id, branch_id, scheduled_at, duration_minutes, notes, created_by) values (p_client_id, p_coach_membership_id, m.branch_id, p_scheduled_at, v_dur, p_notes, auth.uid()) returning id into v_sid;
  perform fn_emit_event('session.added', 'sessions', v_sid, m.branch_id, jsonb_build_object('client_id', p_client_id, 'coach_membership_id', p_coach_membership_id, 'scheduled_at', p_scheduled_at));
  perform fn_notify_client(p_client_id, 'session.added', 'Session scheduled', to_char(p_scheduled_at at time zone 'Africa/Cairo', 'Dy DD Mon HH24:MI'), jsonb_build_object('session_id', v_sid), 'whatsapp');
  return v_sid;
end $$;

create or replace function fn_cancel_session(p_session_id uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare s sessions;
begin
  select * into s from sessions where id = p_session_id for update;
  if not found then raise exception 'session not found'; end if;
  if s.status <> 'booked' then raise exception 'only booked sessions can be cancelled' using errcode = 'check_violation'; end if;
  if not (is_top_management() or has_role('head_coach', s.branch_id) or s.coach_membership_id in (select my_membership_ids())) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  update sessions set status = 'cancelled', cancel_reason = p_reason, outcome_recorded_at = now(), outcome_recorded_by = auth.uid() where id = p_session_id;
  perform fn_emit_event('session.cancelled', 'sessions', p_session_id, s.branch_id, jsonb_build_object('client_id', s.client_id, 'coach_membership_id', s.coach_membership_id, 'reason', p_reason, 'scheduled_at', s.scheduled_at));
end $$;

-- ---------------------------------------------------------------- weekly schedule
create or replace function fn_upsert_schedule_slot(p_coach_membership_id uuid, p_weekday int, p_start_time time, p_kind slot_kind default 'client', p_client_id uuid default null, p_label text default null, p_duration int default null, p_starts_on date default current_date, p_ends_on date default null, p_slot_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare m memberships; v_dur int; v_id uuid; v_end time;
begin
  select * into m from memberships where id = p_coach_membership_id and role = 'coach' and is_active;
  if not found then raise exception 'not an active coach'; end if;
  if not (is_top_management() or has_role('head_coach', m.branch_id) or p_coach_membership_id in (select my_membership_ids())) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  v_dur := coalesce(p_duration, fn_setting_int('scheduling.slot_minutes', 60));
  v_end := p_start_time + make_interval(mins => v_dur);
  if p_kind = 'client' then
    if p_client_id is null then raise exception 'client required' using errcode = 'check_violation'; end if;
    if fn_credit_balance(p_client_id, p_coach_membership_id) <= 0 then raise exception 'client has no credits with this coach' using errcode = 'GY001'; end if;
  end if;
  -- no overlap with the coach's other active slots on that weekday
  if exists (select 1 from schedule_slots x where x.coach_membership_id = p_coach_membership_id and x.weekday = p_weekday and x.is_active and x.id is distinct from p_slot_id
             and (x.ends_on is null or x.ends_on >= p_starts_on) and (p_ends_on is null or x.starts_on <= p_ends_on)
             and x.start_time < v_end and x.start_time + make_interval(mins => x.duration_minutes) > p_start_time) then
    raise exception 'overlaps another slot on that day' using errcode = 'check_violation';
  end if;
  if p_slot_id is null then
    insert into schedule_slots(coach_membership_id, branch_id, weekday, start_time, duration_minutes, kind, client_id, label, starts_on, ends_on, created_by)
    values (p_coach_membership_id, m.branch_id, p_weekday, p_start_time, v_dur, p_kind, case when p_kind = 'client' then p_client_id end, p_label, p_starts_on, p_ends_on, auth.uid()) returning id into v_id;
  else
    update schedule_slots set weekday = p_weekday, start_time = p_start_time, duration_minutes = v_dur, kind = p_kind, client_id = case when p_kind = 'client' then p_client_id end, label = p_label, starts_on = p_starts_on, ends_on = p_ends_on
     where id = p_slot_id and coach_membership_id = p_coach_membership_id returning id into v_id;
    if v_id is null then raise exception 'slot not found'; end if;
    -- future materialized sessions from the old definition are dropped and recreated on next materialization
    delete from sessions where slot_id = v_id and status = 'booked' and scheduled_at > now();
  end if;
  perform fn_emit_event('schedule.slot_upserted', 'schedule_slots', v_id, m.branch_id, jsonb_build_object('coach_membership_id', p_coach_membership_id, 'client_id', p_client_id, 'kind', p_kind, 'weekday', p_weekday, 'start_time', p_start_time));
  return v_id;
end $$;

create or replace function fn_end_schedule_slot(p_slot_id uuid, p_ends_on date default current_date) returns void language plpgsql security definer set search_path = public as $$
declare x schedule_slots;
begin
  select * into x from schedule_slots where id = p_slot_id for update;
  if not found then raise exception 'slot not found'; end if;
  if not (is_top_management() or has_role('head_coach', x.branch_id) or x.coach_membership_id in (select my_membership_ids())) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  update schedule_slots set is_active = (p_ends_on > current_date), ends_on = p_ends_on where id = p_slot_id;
  delete from sessions where slot_id = p_slot_id and status = 'booked' and scheduled_at > (p_ends_on + 1)::timestamp at time zone 'Africa/Cairo';
  perform fn_emit_event('schedule.slot_ended', 'schedule_slots', p_slot_id, x.branch_id, jsonb_build_object('ends_on', p_ends_on));
end $$;

create or replace function fn_skip_slot(p_slot_id uuid, p_date date, p_reason text default null) returns void language plpgsql security definer set search_path = public as $$
declare x schedule_slots; r record;
begin
  select * into x from schedule_slots where id = p_slot_id;
  if not found then raise exception 'slot not found'; end if;
  if not (is_top_management() or has_role('head_coach', x.branch_id) or x.coach_membership_id in (select my_membership_ids())) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  insert into schedule_skips(slot_id, skip_date, reason, created_by) values (p_slot_id, p_date, p_reason, auth.uid()) on conflict (slot_id, skip_date) do update set reason = excluded.reason;
  for r in select * from sessions where slot_id = p_slot_id and status = 'booked' and (scheduled_at at time zone 'Africa/Cairo')::date = p_date loop
    update sessions set status = 'cancelled', cancel_reason = coalesce(p_reason, 'skipped'), outcome_recorded_at = now(), outcome_recorded_by = auth.uid() where id = r.id;
    perform fn_emit_event('session.cancelled', 'sessions', r.id, r.branch_id, jsonb_build_object('client_id', r.client_id, 'coach_membership_id', r.coach_membership_id, 'reason', coalesce(p_reason,'skipped'), 'scheduled_at', r.scheduled_at));
  end loop;
  perform fn_emit_event('schedule.slot_skipped', 'schedule_slots', p_slot_id, x.branch_id, jsonb_build_object('date', p_date, 'reason', p_reason));
end $$;

-- Creates today's (or any day's) sessions from the weekly slots. Idempotent; called by the Today screen and by the hourly job for tomorrow.
create or replace function fn_materialize_sessions(p_date date default current_date, p_coach_membership_id uuid default null) returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_when timestamptz;
begin
  if not is_staff() and auth.uid() is not null then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  for r in
    select x.* from schedule_slots x
    where x.is_active and x.kind = 'client' and x.weekday = extract(dow from p_date)::int
      and x.starts_on <= p_date and (x.ends_on is null or x.ends_on >= p_date)
      and (p_coach_membership_id is null or x.coach_membership_id = p_coach_membership_id)
      and not exists (select 1 from schedule_skips k where k.slot_id = x.id and k.skip_date = p_date)
  loop
    v_when := (p_date::text || ' ' || r.start_time::text)::timestamp at time zone 'Africa/Cairo';
    if not exists (select 1 from sessions s where s.slot_id = r.id and s.scheduled_at = v_when) then
      -- a client whose pack ran out stays visible on the schedule; the coach decides (deliver unpaid + flag sales, or cancel)
      insert into sessions(client_id, coach_membership_id, branch_id, scheduled_at, duration_minutes, slot_id, created_by)
      values (r.client_id, r.coach_membership_id, r.branch_id, v_when, r.duration_minutes, r.id, null);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- The coach's day/week as the UI shows it: sessions (materialized) + class/blocked slots + free gaps computed client-side from working hours
create or replace function fn_coach_day(p_coach_membership_id uuid, p_date date default current_date)
returns table(kind text, item_id uuid, starts_at timestamptz, duration_minutes int, client_id uuid, client_name text, status session_status, label text, credits_left int, unpaid boolean, injuries text)
language plpgsql stable security definer set search_path = public as $$
declare m memberships;
begin
  select * into m from memberships mm where mm.id = p_coach_membership_id;
  if not (is_top_management() or has_role('head_coach', m.branch_id) or has_role('sales_manager', m.branch_id) or p_coach_membership_id in (select my_membership_ids())) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  return query
  select 'session'::text, s.id, s.scheduled_at, s.duration_minutes, s.client_id, c.full_name, s.status, null::text, fn_credit_balance(s.client_id, p_coach_membership_id), s.unpaid, c.injuries
    from sessions s join clients c on c.id = s.client_id
   where s.coach_membership_id = p_coach_membership_id and (s.scheduled_at at time zone 'Africa/Cairo')::date = p_date
  union all
  select x.kind::text, x.id, (p_date::text || ' ' || x.start_time::text)::timestamp at time zone 'Africa/Cairo', x.duration_minutes, null, null, null, x.label, null, false, null
    from schedule_slots x
   where x.coach_membership_id = p_coach_membership_id and x.is_active and x.kind <> 'client' and x.weekday = extract(dow from p_date)::int
     and x.starts_on <= p_date and (x.ends_on is null or x.ends_on >= p_date)
     and not exists (select 1 from schedule_skips k where k.slot_id = x.id and k.skip_date = p_date)
  order by 3;
end $$;

-- internal: applies an outcome, handles credit consumption/restoration, visits, events
-- internal: applies an outcome. completed burns a credit with this coach, or is delivered unpaid (flag sales) when there are none.
-- no_show is recorded only (adherence analytics); cancelled costs nothing.
create or replace function fn_apply_attendance(p_session_id uuid, p_outcome session_status, p_waive boolean, p_waive_reason text, p_via_approval boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare s sessions; v_should_consume boolean; v_lot uuid; v_prev session_status; v_client clients; v_unpaid boolean := false; v_rep uuid;
begin
  select * into s from sessions where id = p_session_id for update;
  if p_outcome = 'booked' then raise exception 'outcome cannot be booked' using errcode = 'check_violation'; end if;
  v_prev := s.status;
  select * into v_client from clients where id = s.client_id;

  v_should_consume := case p_outcome
    when 'completed' then true
    when 'no_show' then fn_setting_bool('attendance.no_show_deducts', false)
    else false end;
  if p_waive then v_should_consume := false; end if;

  if v_should_consume and not s.credit_consumed then
    if fn_credit_balance(s.client_id, s.coach_membership_id) > 0 then
      v_lot := fn_consume_credit(s.client_id, p_session_id, p_outcome::text);
      update sessions set credit_consumed = true, lot_id = v_lot, unpaid = false where id = p_session_id;
    else
      -- delivered on zero credits: keep it, flag sales this second, settle from the next pack
      v_unpaid := true;
      update sessions set unpaid = true, credit_consumed = false, lot_id = null where id = p_session_id;
    end if;
  elsif not v_should_consume and s.credit_consumed then
    perform fn_restore_credit(p_session_id, coalesce(p_waive_reason, 'outcome changed to ' || p_outcome::text));
    update sessions set unpaid = false where id = p_session_id;
  elsif not v_should_consume and s.unpaid then
    update sessions set unpaid = false where id = p_session_id;
  end if;

  update sessions set status = p_outcome, outcome_recorded_at = now(), outcome_recorded_by = auth.uid(), waived = p_waive, waive_reason = case when p_waive then p_waive_reason end where id = p_session_id;

  if p_outcome = 'completed' then
    if not exists (select 1 from visits v where v.client_id = s.client_id and v.branch_id = s.branch_id and v.checked_in_at > s.scheduled_at - interval '3 hours') then
      insert into visits(client_id, branch_id, checked_in_at, method, recorded_by) values (s.client_id, s.branch_id, s.scheduled_at, 'session', auth.uid());
    end if;
    update clients set last_visit_at = greatest(coalesce(last_visit_at, s.scheduled_at), s.scheduled_at) where id = s.client_id;
  end if;

  perform fn_emit_event('session.' || p_outcome::text, 'sessions', p_session_id, s.branch_id,
    jsonb_build_object('client_id', s.client_id, 'coach_membership_id', s.coach_membership_id, 'previous', v_prev, 'waived', p_waive, 'via_approval', p_via_approval, 'credit_consumed', v_should_consume and not v_unpaid, 'unpaid', v_unpaid, 'scheduled_at', s.scheduled_at));
  if v_unpaid then
    perform fn_emit_event('session.unpaid', 'sessions', p_session_id, s.branch_id, jsonb_build_object('client_id', s.client_id, 'coach_membership_id', s.coach_membership_id));
    perform fn_flag_for_sales_internal(s.client_id, 'Trained today with no credits left — renew before they leave', 'unpaid_session', p_session_id);
  end if;
  if p_outcome in ('completed','no_show') then
    perform fn_notify_client(s.client_id, 'session.' || p_outcome::text, case p_outcome when 'completed' then 'Session logged' else 'Missed session' end,
      fn_credit_balance(s.client_id, s.coach_membership_id) || ' sessions left with your coach', jsonb_build_object('session_id', p_session_id), 'push');
  end if;
  if p_waive then
    perform fn_notify_role('head_coach', s.branch_id, 'session.waived', 'Credit waived', p_waive_reason, jsonb_build_object('session_id', p_session_id));
  end if;
end $$;

create or replace function fn_record_attendance(p_session_id uuid, p_outcome session_status, p_waive boolean default false, p_waive_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s sessions; v_window int; v_aid uuid;
begin
  select * into s from sessions where id = p_session_id;
  if not found then raise exception 'session not found'; end if;
  if not (is_top_management() or has_role('head_coach', s.branch_id) or s.coach_membership_id in (select my_membership_ids())) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  if p_waive and coalesce(p_waive_reason,'') = '' then raise exception 'waiver requires a reason' using errcode = 'check_violation'; end if;
  v_window := fn_setting_int('attendance.edit_window_hours', 24);
  if now() > s.scheduled_at + make_interval(hours => v_window) and not (is_top_management() or has_role('head_coach', s.branch_id)) then
    v_aid := fn_request_approval('attendance_edit', 'sessions', p_session_id, s.branch_id, 'Late attendance edit', jsonb_build_object('outcome', p_outcome, 'waive', p_waive, 'waive_reason', p_waive_reason));
    return jsonb_build_object('ok', false, 'pending_approval', v_aid);
  end if;
  perform fn_apply_attendance(p_session_id, p_outcome, p_waive, p_waive_reason, false);
  return jsonb_build_object('ok', true, 'credit_balance', fn_credit_balance(s.client_id));
end $$;

create or replace function fn_start_walkin_session(p_client_id uuid, p_notes text default null) returns uuid language plpgsql security definer set search_path = public as $$
declare c clients; v_coach uuid; v_sid uuid; v_branch uuid;
begin
  select * into c from clients where id = p_client_id;
  if not found then raise exception 'client not found'; end if;
  -- the calling coach must be the client's coach, hold one of their packs, or be the branch head coach
  select m.id into v_coach from memberships m
   where m.profile_id = auth.uid() and m.role = 'coach' and m.is_active
     and (m.id = c.coach_membership_id or exists (select 1 from credit_lots l where l.client_id = p_client_id and l.coach_membership_id = m.id and l.status = 'active') or has_role('head_coach', m.branch_id))
   limit 1;
  if v_coach is null and not is_top_management() then raise exception 'not the client''s coach' using errcode = 'insufficient_privilege'; end if;
  v_coach := coalesce(v_coach, c.coach_membership_id);
  if v_coach is null then raise exception 'client has no coach' using errcode = 'check_violation'; end if;
  select branch_id into v_branch from memberships where id = v_coach;
  insert into sessions(client_id, coach_membership_id, branch_id, scheduled_at, duration_minutes, is_walk_in, notes, created_by)
  values (p_client_id, v_coach, coalesce(v_branch, c.home_branch_id), now(), fn_setting_int('scheduling.slot_minutes', 60), true, p_notes, auth.uid()) returning id into v_sid;
  perform fn_apply_attendance(v_sid, 'completed', false, null, false);
  return v_sid;
end $$;

-- Membership check-in at reception. A membership works at both branches (setting); PT credits alone admit the client at their coach's branch.
create or replace function fn_check_in(p_client_id uuid, p_branch_id uuid, p_method visit_method default 'staff') returns jsonb language plpgsql security definer set search_path = public as $$
declare c clients; v_ok boolean; v_vid uuid; v_next sessions;
begin
  select * into c from clients where id = p_client_id;
  if not found then raise exception 'client not found'; end if;
  if not (my_client_id() = p_client_id or is_top_management() or p_branch_id in (select my_branch_ids())) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  v_ok := exists (select 1 from entitlements e where e.client_id = p_client_id and e.type = 'membership' and e.status = 'active' and now() between e.starts_at and e.ends_at)
          and (p_branch_id = c.home_branch_id or fn_setting_bool('clients.cross_branch_checkin', true));
  if not v_ok then
    v_ok := exists (select 1 from credit_lots l join memberships m on m.id = l.coach_membership_id
                    where l.client_id = p_client_id and l.status = 'active' and l.qty_remaining > 0 and l.expires_at > now() and m.branch_id = p_branch_id);
  end if;
  if not v_ok then
    return jsonb_build_object('ok', false, 'reason', 'no_active_entitlement', 'client_id', p_client_id, 'name', c.full_name);
  end if;
  if exists (select 1 from visits v where v.client_id = p_client_id and v.branch_id = p_branch_id and v.checked_in_at > now() - interval '3 hours') then
    return jsonb_build_object('ok', true, 'duplicate', true, 'name', c.full_name, 'credit_balance', fn_credit_balance(p_client_id));
  end if;
  insert into visits(client_id, branch_id, method, recorded_by) values (p_client_id, p_branch_id, p_method, auth.uid()) returning id into v_vid;
  update clients set last_visit_at = now() where id = p_client_id;
  perform fn_emit_event('visit.recorded', 'visits', v_vid, p_branch_id, jsonb_build_object('client_id', p_client_id, 'method', p_method));
  select * into v_next from sessions where client_id = p_client_id and status = 'booked' and scheduled_at > now() - interval '1 hour' order by scheduled_at limit 1;
  return jsonb_build_object('ok', true, 'name', c.full_name, 'credit_balance', fn_credit_balance(p_client_id), 'next_session', to_jsonb(v_next) - 'notes');
end $$;

-- Front desk / coach flags a client for the sales team (e.g. refused at the kiosk, wants to upgrade)
-- Staff flags a client for the sales team (kiosk refusal, coach spotting a renewal). The rep AND the sales manager are notified at once;
-- the sales screens subscribe to notifications via Realtime, so the flag shows up in the same second.
create or replace function fn_flag_for_sales_internal(p_client_id uuid, p_note text, p_kind text default 'manual', p_session_id uuid default null) returns uuid language plpgsql security definer set search_path = public as $$
declare c clients; v_to uuid; v_fid uuid;
begin
  select * into c from clients where id = p_client_id;
  v_to := coalesce(c.rep_membership_id, (select id from memberships where role = 'sales_manager' and branch_id = c.home_branch_id and is_active limit 1));
  if v_to is null then raise exception 'no sales membership to assign to'; end if;
  -- one open flag per client at a time
  select id into v_fid from follow_ups where client_id = p_client_id and status = 'open' and title like 'FLAG:%' limit 1;
  if v_fid is null then
    insert into follow_ups(client_id, assigned_to_membership_id, title, due_at, created_by) values (p_client_id, v_to, 'FLAG: ' || c.full_name || ' — ' || coalesce(p_note, 'needs sales attention'), now(), auth.uid()) returning id into v_fid;
  end if;
  perform fn_notify((select profile_id from memberships where id = v_to), 'client.flagged', c.full_name || ' needs sales attention', p_note, jsonb_build_object('client_id', p_client_id, 'follow_up_id', v_fid, 'kind', p_kind, 'session_id', p_session_id));
  perform fn_notify_role('sales_manager', c.home_branch_id, 'client.flagged', c.full_name || ' needs sales attention', p_note, jsonb_build_object('client_id', p_client_id, 'follow_up_id', v_fid, 'kind', p_kind));
  if p_kind = 'renewal_request' and c.coach_membership_id is not null then
    perform fn_notify((select profile_id from memberships where id = c.coach_membership_id), 'client.flagged', c.full_name || ' wants to renew', p_note, jsonb_build_object('client_id', p_client_id, 'kind', p_kind));
  end if;
  perform fn_emit_event('client.flagged', 'clients', p_client_id, c.home_branch_id, jsonb_build_object('note', p_note, 'to', v_to, 'kind', p_kind, 'session_id', p_session_id));
  return v_fid;
end $$;

-- staff of the branch flag any client; a client can flag themself (Renew button → kind renewal_request)
create or replace function fn_flag_for_sales(p_client_id uuid, p_note text, p_kind text default 'manual') returns uuid language plpgsql security definer set search_path = public as $$
declare c clients;
begin
  select * into c from clients where id = p_client_id;
  if not found then raise exception 'client not found'; end if;
  if not (is_top_management() or (is_staff() and c.home_branch_id in (select my_branch_ids())) or my_client_id() = p_client_id) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  if p_kind not in ('manual','renewal_request','kiosk_refused','upsell') then raise exception 'unknown flag kind' using errcode = 'check_violation'; end if;
  return fn_flag_for_sales_internal(p_client_id, p_note, p_kind, null);
end $$;

-- ---------------------------------------------------------------- expiry extension (sales team only; reps via manager approval)
create or replace function fn_apply_expiry_extension(p_lot_id uuid, p_new_expires_at timestamptz, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare l credit_lots; v_restore int;
begin
  select * into l from credit_lots where id = p_lot_id for update;
  if not found then raise exception 'lot not found'; end if;
  if p_new_expires_at <= l.expires_at then raise exception 'new expiry must be later than the current one' using errcode = 'check_violation'; end if;
  if l.status = 'expired' then
    -- bring back what the expiry job removed
    select -qty into v_restore from credit_ledger where lot_id = p_lot_id and entry_type = 'expire' order by created_at desc limit 1;
    if coalesce(v_restore, 0) > 0 then
      update credit_lots set qty_remaining = v_restore, status = 'active' where id = p_lot_id;
      insert into credit_ledger(client_id, lot_id, entry_type, qty, reason, created_by) values (l.client_id, p_lot_id, 'restore', v_restore, 'expiry extended: ' || p_reason, auth.uid());
    end if;
  end if;
  update credit_lots set expires_at = p_new_expires_at where id = p_lot_id;
  perform fn_emit_event('credit.expiry_extended', 'credit_lots', p_lot_id, (select home_branch_id from clients where id = l.client_id), jsonb_build_object('client_id', l.client_id, 'from', l.expires_at, 'to', p_new_expires_at, 'reason', p_reason));
end $$;

create or replace function fn_extend_expiry(p_lot_id uuid, p_new_expires_at timestamptz, p_reason text) returns jsonb language plpgsql security definer set search_path = public as $$
declare l credit_lots; c clients; v_aid uuid;
begin
  select * into l from credit_lots where id = p_lot_id;
  if not found then raise exception 'lot not found'; end if;
  select * into c from clients where id = l.client_id;
  if coalesce(p_reason,'') = '' then raise exception 'reason required' using errcode = 'check_violation'; end if;
  if is_top_management() or has_role('sales_manager', c.home_branch_id) then
    perform fn_apply_expiry_extension(p_lot_id, p_new_expires_at, p_reason);
    return jsonb_build_object('ok', true, 'expires_at', p_new_expires_at);
  elsif c.rep_membership_id in (select my_membership_ids()) or has_role('sales_rep', c.home_branch_id) then
    v_aid := fn_request_approval('expiry_extension', 'credit_lots', p_lot_id, c.home_branch_id, p_reason, jsonb_build_object('new_expires_at', p_new_expires_at, 'client_id', c.id));
    return jsonb_build_object('ok', false, 'pending_approval', v_aid);
  else
    raise exception 'only the sales team can extend expiry' using errcode = 'insufficient_privilege';
  end if;
end $$;

-- =====================================================================
-- 17. FREEZES, EXPIRY, RISK, LAPSE (jobs)
-- =====================================================================
create or replace function fn_request_freeze(p_client_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_reason text) returns uuid language plpgsql security definer set search_path = public as $$
declare c clients; v_days int; v_count int; v_fid uuid; v_aid uuid;
begin
  select * into c from clients where id = p_client_id;
  if not found then raise exception 'client not found'; end if;
  if not (my_client_id() = p_client_id or is_top_management() or c.home_branch_id in (select my_branch_ids())) then raise exception 'not allowed' using errcode = 'insufficient_privilege'; end if;
  v_days := ceil(extract(epoch from (p_ends_at - p_starts_at)) / 86400);
  if v_days > fn_setting_int('freeze.max_days', 30) then raise exception 'freeze exceeds % days', fn_setting_int('freeze.max_days', 30) using errcode = 'check_violation'; end if;
  select count(*) into v_count from freezes where client_id = p_client_id and status in ('active','ended') and starts_at > now() - interval '365 days';
  if v_count >= fn_setting_int('freeze.max_count', 2) then raise exception 'freeze limit reached' using errcode = 'check_violation'; end if;
  insert into freezes(client_id, starts_at, ends_at, reason, created_by) values (p_client_id, p_starts_at, p_ends_at, p_reason, auth.uid()) returning id into v_fid;
  v_aid := fn_request_approval('freeze', 'freezes', v_fid, c.home_branch_id, p_reason, jsonb_build_object('client_id', p_client_id, 'days', v_days));
  update freezes set approval_id = v_aid where id = v_fid;
  return v_fid;
end $$;

create or replace function fn_end_freeze(p_freeze_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare f freezes;
begin
  select * into f from freezes where id = p_freeze_id and status = 'active' for update;
  if not found then return; end if;
  update credit_lots set expires_at = expires_at + make_interval(days => f.days) where client_id = f.client_id and status = 'active';
  update entitlements set ends_at = ends_at + make_interval(days => f.days), status = 'active' where client_id = f.client_id and status = 'frozen';
  update freezes set status = 'ended' where id = p_freeze_id;
  update clients set status = 'active' where id = f.client_id and status = 'frozen';
  perform fn_notify_client(f.client_id, 'freeze.ended', 'Welcome back', 'Your freeze has ended; your sessions and membership were extended by ' || f.days || ' days', jsonb_build_object('freeze_id', p_freeze_id), 'whatsapp');
  perform fn_emit_event('freeze.ended', 'freezes', p_freeze_id, (select home_branch_id from clients where id = f.client_id), jsonb_build_object('client_id', f.client_id, 'days', f.days));
end $$;

create or replace function fn_expire_credits() returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select * from credit_lots where status = 'active' and expires_at < now() and qty_remaining > 0 for update loop
    insert into credit_ledger(client_id, lot_id, entry_type, qty, reason) values (r.client_id, r.id, 'expire', -r.qty_remaining, 'expired');
    update credit_lots set status = 'expired', qty_remaining = 0 where id = r.id;
    perform fn_emit_event('credit.expired', 'credit_lots', r.id, (select home_branch_id from clients where id = r.client_id), jsonb_build_object('client_id', r.client_id, 'qty', r.qty_remaining, 'value', r.per_session_value_piastres));
    perform fn_notify_client(r.client_id, 'credit.expired', r.qty_remaining || ' sessions expired', 'Ask your advisor about an extension', jsonb_build_object('lot_id', r.id), 'in_app');
    perform fn_notify((select profile_id from memberships where id = r.coach_membership_id), 'credit.expired', (select full_name from clients where id = r.client_id) || ': ' || r.qty_remaining || ' sessions expired', null, jsonb_build_object('lot_id', r.id, 'client_id', r.client_id));
    n := n + 1;
  end loop;
  update credit_lots set status = 'expired' where status = 'active' and expires_at < now() and qty_remaining = 0;
  update entitlements set status = 'expired' where status = 'active' and ends_at < now();
  -- auto-end freezes
  perform fn_end_freeze(id) from freezes where status = 'active' and ends_at < now();
  return n;
end $$;

create or replace function fn_compute_risk_scores() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with calc as (
    select c.id,
      (case when c.last_visit_at is null or c.last_visit_at < now() - make_interval(days => fn_setting_int('risk.no_visit_days', 10)) then fn_setting_int('risk.no_visit_points', 40) else 0 end) as p_visit,
      (case when exists (select 1 from programs p where p.client_id = c.id and p.status = 'active')
             and (select count(distinct date_trunc('day', w.performed_at)) from workout_logs w where w.client_id = c.id and w.performed_at > now() - interval '14 days') < 4
            then fn_setting_int('risk.low_adherence_points', 30) else 0 end) as p_adh,
      (case when exists (select 1 from credit_lots l where l.client_id = c.id and l.status = 'active' and (l.expires_at < now() + make_interval(days => fn_setting_int('risk.expiring_days', 7))))
             or (fn_credit_balance(c.id) between 1 and fn_setting_int('risk.low_credit_threshold', 2))
            then fn_setting_int('risk.low_credit_points', 30) else 0 end) as p_cred
    from clients c where c.status in ('active','frozen')
  )
  update clients c set risk_score = calc.p_visit + calc.p_adh + calc.p_cred,
    risk_reasons = (select coalesce(jsonb_agg(x), '[]') from unnest(array[case when calc.p_visit > 0 then 'no_recent_visit' end, case when calc.p_adh > 0 then 'low_adherence' end, case when calc.p_cred > 0 then 'credits_low_or_expiring' end]) x where x is not null)
  from calc where calc.id = c.id;
  get diagnostics n = row_count;
  -- tell the coach and the head coach about clients at or above the threshold (once a week per client)
  perform fn_notify((select profile_id from memberships where id = c.coach_membership_id), 'client.at_risk', c.full_name || ' is at risk', array_to_string(array(select jsonb_array_elements_text(c.risk_reasons)), ', '), jsonb_build_object('client_id', c.id, 'score', c.risk_score))
    from clients c
   where c.risk_score >= fn_setting_int('risk.at_risk_threshold', 60) and c.status = 'active' and c.coach_membership_id is not null
     and not exists (select 1 from notifications x where x.type = 'client.at_risk' and x.data->>'client_id' = c.id::text and x.created_at > now() - interval '7 days');
  perform fn_notify_role('head_coach', c.home_branch_id, 'client.at_risk', c.full_name || ' is at risk', array_to_string(array(select jsonb_array_elements_text(c.risk_reasons)), ', '), jsonb_build_object('client_id', c.id, 'score', c.risk_score))
    from clients c
   where c.risk_score >= fn_setting_int('risk.at_risk_threshold', 60) and c.status = 'active'
     and not exists (select 1 from notifications x where x.type = 'client.at_risk' and x.data->>'client_id' = c.id::text and x.created_at > now() - interval '7 days' and x.recipient_profile_id in (select profile_id from memberships where role = 'head_coach'));
  return n;
end $$;

create or replace function fn_mark_lapsed() returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  for r in select c.* from clients c
            where c.status = 'active'
              and not exists (select 1 from entitlements e where e.client_id = c.id and e.status = 'active' and e.ends_at > now())
              and fn_credit_balance(c.id) = 0 loop
    update clients set status = 'lapsed' where id = r.id;
    perform fn_emit_event('client.lapsed', 'clients', r.id, r.home_branch_id, jsonb_build_object('rep', r.rep_membership_id, 'coach', r.coach_membership_id));
    n := n + 1;
  end loop;
  return n;
end $$;

-- =====================================================================
-- 18. ROW LEVEL SECURITY
-- =====================================================================
do $$ declare t text; begin
  foreach t in array array['branches','profiles','memberships','settings','lead_sources','leads','round_robin_state','products','bundle_items','clients','touches','follow_ups','approvals','deals','deal_items','payments','coach_assignments','entitlements','credit_lots','credit_ledger','freezes','coach_availability','schedule_slots','schedule_skips','sessions','visits','exercises','program_templates','programs','program_days','program_exercises','workout_logs','set_logs','body_metrics','nutrition_plans','client_notes','events','audit_log','notifications','targets'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- branches, lead sources, products, exercises, settings: readable by any authenticated user; writable by top management (products also sales manager)
create policy branches_read on branches for select to authenticated using (true);
create policy branches_write on branches for all to authenticated using (is_top_management()) with check (is_top_management());
create policy lead_sources_read on lead_sources for select to authenticated using (true);
create policy lead_sources_write on lead_sources for all to authenticated using (is_top_management() or has_role('sales_manager')) with check (is_top_management() or has_role('sales_manager'));
create policy products_read on products for select to authenticated using (true);
create policy products_write on products for all to authenticated using (is_top_management() or has_role('sales_manager')) with check (is_top_management() or has_role('sales_manager'));
create policy bundle_items_read on bundle_items for select to authenticated using (true);
create policy bundle_items_write on bundle_items for all to authenticated using (is_top_management() or has_role('sales_manager')) with check (is_top_management() or has_role('sales_manager'));
create policy exercises_read on exercises for select to authenticated using (true);
create policy exercises_write on exercises for insert to authenticated with check (has_role('coach') or has_role('head_coach') or is_top_management());
create policy exercises_update on exercises for update to authenticated using (is_top_management() or has_role('head_coach') or created_by = auth.uid());
create policy settings_read on settings for select to authenticated using (is_staff());
create policy settings_write on settings for all to authenticated using (is_top_management()) with check (is_top_management());

-- profiles
create policy profiles_self on profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_update on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_staff_read on profiles for select to authenticated using (
  is_top_management()
  or exists (select 1 from memberships m where m.profile_id = profiles.id and m.branch_id in (select my_branch_ids()) and is_staff())
  or exists (select 1 from clients c where c.profile_id = profiles.id and (c.id in (select my_coach_client_ids()) or c.id in (select my_sales_client_ids())))
);
create policy profiles_admin_write on profiles for all to authenticated using (is_top_management()) with check (is_top_management());

-- memberships
create policy memberships_self on memberships for select to authenticated using (profile_id = auth.uid());
create policy memberships_branch_read on memberships for select to authenticated using (is_top_management() or (is_staff() and branch_id in (select my_branch_ids())));
create policy memberships_admin_write on memberships for all to authenticated using (is_top_management()) with check (is_top_management());

-- leads: rep own, manager all in branch, front desk create, top mgmt read
create policy leads_read on leads for select to authenticated using (is_top_management() or id in (select my_lead_ids()) or (has_role('front_desk', branch_id) and created_by = auth.uid()));
create policy leads_update on leads for update to authenticated using (is_top_management() or id in (select my_lead_ids())) with check (is_top_management() or id in (select my_lead_ids()));
create policy round_robin_read on round_robin_state for select to authenticated using (is_top_management() or has_role('sales_manager', branch_id));

-- touches / follow_ups
create policy touches_read on touches for select to authenticated using (
  is_top_management() or by_profile_id = auth.uid()
  or lead_id in (select my_lead_ids())
  or client_id in (select my_coach_client_ids()) or client_id in (select my_sales_client_ids())
);
create policy touches_insert on touches for insert to authenticated with check (
  by_profile_id = auth.uid() and (
    is_top_management()
    or lead_id in (select my_lead_ids())
    or (lead_id is not null and exists (select 1 from leads l where l.id = lead_id and has_role('front_desk', l.branch_id)))
    or client_id in (select my_coach_client_ids()) or client_id in (select my_sales_client_ids())
  )
);
create policy follow_ups_read on follow_ups for select to authenticated using (
  is_top_management() or assigned_to_membership_id in (select my_membership_ids())
  or lead_id in (select my_lead_ids())
  or client_id in (select my_coach_client_ids()) or client_id in (select my_sales_client_ids())
);
create policy follow_ups_write on follow_ups for all to authenticated using (
  is_top_management() or assigned_to_membership_id in (select my_membership_ids()) or lead_id in (select my_lead_ids()) or client_id in (select my_coach_client_ids())
  or exists (select 1 from clients c where c.id = client_id and has_role('sales_manager', c.home_branch_id))
) with check (
  is_top_management() or assigned_to_membership_id in (select my_membership_ids()) or lead_id in (select my_lead_ids()) or client_id in (select my_coach_client_ids())
  or exists (select 1 from clients c where c.id = client_id and has_role('sales_manager', c.home_branch_id))
);

-- clients
create policy clients_self on clients for select to authenticated using (profile_id = auth.uid());
create policy clients_staff_read on clients for select to authenticated using (
  is_top_management() or id in (select my_coach_client_ids()) or id in (select my_sales_client_ids())
  or (has_role('front_desk', home_branch_id))
);
create policy clients_coach_update on clients for update to authenticated using (is_top_management() or id in (select my_coach_client_ids()) or has_role('sales_manager', home_branch_id))
  with check (is_top_management() or id in (select my_coach_client_ids()) or has_role('sales_manager', home_branch_id));

-- approvals
create policy approvals_read on approvals for select to authenticated using (is_top_management() or requested_by = auth.uid() or has_role('sales_manager', branch_id) or has_role('head_coach', branch_id));
create policy approvals_insert on approvals for insert to authenticated with check (false); -- via fn_request_approval only

-- deals and items
create policy deals_read on deals for select to authenticated using (
  is_top_management() or has_role('sales_manager', branch_id) or has_role('front_desk', branch_id) or has_role('head_coach', branch_id)
  or rep_membership_id in (select my_membership_ids()) or closer_membership_id in (select my_membership_ids())
  or client_id in (select my_coach_client_ids()) or client_id = my_client_id()
);
create policy deals_insert on deals for insert to authenticated with check (
  created_by = auth.uid() and status = 'draft' and (
    is_top_management() or has_role('sales_manager', branch_id)
    or (rep_membership_id in (select my_membership_ids()) and has_role('sales_rep', branch_id))
    or (closer_membership_id in (select my_membership_ids()) and client_id in (select my_coach_client_ids()) and is_renewal)
  )
);
create policy deals_update_draft on deals for update to authenticated using (
  status = 'draft' and (is_top_management() or has_role('sales_manager', branch_id) or rep_membership_id in (select my_membership_ids()) or closer_membership_id in (select my_membership_ids()))
) with check (status = 'draft');
create policy deal_items_read on deal_items for select to authenticated using (exists (select 1 from deals d where d.id = deal_id));
create policy deal_items_write on deal_items for all to authenticated
  using (exists (select 1 from deals d where d.id = deal_id and d.status = 'draft' and (is_top_management() or has_role('sales_manager', d.branch_id) or d.rep_membership_id in (select my_membership_ids()) or d.closer_membership_id in (select my_membership_ids()))))
  with check (exists (select 1 from deals d where d.id = deal_id and d.status = 'draft' and (is_top_management() or has_role('sales_manager', d.branch_id) or d.rep_membership_id in (select my_membership_ids()) or d.closer_membership_id in (select my_membership_ids()))));

-- payments: read via deal visibility; insert only via fn_record_payment
create policy payments_read on payments for select to authenticated using (exists (
  select 1 from deals d where d.id = deal_id and (
    is_top_management() or has_role('sales_manager', d.branch_id) or has_role('front_desk', d.branch_id) or has_role('head_coach', d.branch_id)
    or d.rep_membership_id in (select my_membership_ids()) or d.closer_membership_id in (select my_membership_ids())
    or d.client_id = my_client_id()
  )));
create policy payments_insert on payments for insert to authenticated with check (false);

-- assignments, entitlements, credits, freezes
create policy coach_assignments_read on coach_assignments for select to authenticated using (is_top_management() or client_id in (select my_coach_client_ids()) or coach_membership_id in (select my_membership_ids()) or client_id = my_client_id());
create policy entitlements_read on entitlements for select to authenticated using (is_top_management() or client_id = my_client_id() or client_id in (select my_coach_client_ids()) or client_id in (select my_sales_client_ids()));
create policy credit_lots_read on credit_lots for select to authenticated using (is_top_management() or client_id = my_client_id() or client_id in (select my_coach_client_ids()) or client_id in (select my_sales_client_ids()));
create policy credit_ledger_read on credit_ledger for select to authenticated using (is_top_management() or client_id = my_client_id() or client_id in (select my_coach_client_ids()) or client_id in (select my_sales_client_ids()));
create policy freezes_read on freezes for select to authenticated using (is_top_management() or client_id = my_client_id() or client_id in (select my_coach_client_ids()) or client_id in (select my_sales_client_ids()));

-- availability, sessions, visits
create policy availability_read on coach_availability for select to authenticated using (is_staff() or exists (select 1 from clients c where c.profile_id = auth.uid() and c.coach_membership_id = membership_id));
create policy availability_write on coach_availability for all to authenticated using (
  is_top_management() or membership_id in (select my_membership_ids()) or exists (select 1 from memberships m where m.id = membership_id and has_role('head_coach', m.branch_id))
) with check (
  is_top_management() or membership_id in (select my_membership_ids()) or exists (select 1 from memberships m where m.id = membership_id and has_role('head_coach', m.branch_id))
);
create policy sessions_read on sessions for select to authenticated using (
  is_top_management() or client_id = my_client_id() or client_id in (select my_coach_client_ids()) or coach_membership_id in (select my_membership_ids())
  or client_id in (select my_sales_client_ids()) or has_role('front_desk', branch_id)
);
create policy sessions_write_blocked on sessions for insert to authenticated with check (false); -- via fn_materialize_sessions / fn_add_session
create policy sessions_notes_update on sessions for update to authenticated using (coach_membership_id in (select my_membership_ids()) or has_role('head_coach', branch_id) or is_top_management())
  with check (coach_membership_id in (select my_membership_ids()) or has_role('head_coach', branch_id) or is_top_management());
-- weekly schedule: coach own, head coach + sales manager branch, client own slots; writes only through fn_upsert_schedule_slot & co
create policy schedule_slots_read on schedule_slots for select to authenticated using (
  is_top_management() or coach_membership_id in (select my_membership_ids()) or client_id = my_client_id()
  or has_role('head_coach', branch_id) or has_role('sales_manager', branch_id)
);
create policy schedule_skips_read on schedule_skips for select to authenticated using (exists (select 1 from schedule_slots x where x.id = slot_id));
create policy visits_read on visits for select to authenticated using (is_top_management() or client_id = my_client_id() or client_id in (select my_coach_client_ids()) or branch_id in (select my_branch_ids()));

-- programs and templates
create policy templates_read on program_templates for select to authenticated using (is_top_management() or owner_membership_id is null or owner_membership_id in (select my_membership_ids()) or (branch_id in (select my_branch_ids()) and has_role('head_coach', branch_id)));
create policy templates_write on program_templates for all to authenticated using (is_top_management() or owner_membership_id in (select my_membership_ids()) or has_role('head_coach', branch_id))
  with check (is_top_management() or owner_membership_id in (select my_membership_ids()) or has_role('head_coach', branch_id));
create policy programs_read on programs for select to authenticated using (is_top_management() or client_id = my_client_id() or client_id in (select my_coach_client_ids()));
create policy programs_write on programs for all to authenticated using (is_top_management() or client_id in (select my_coach_client_ids())) with check (is_top_management() or client_id in (select my_coach_client_ids()));
create policy program_days_rw on program_days for all to authenticated using (exists (select 1 from programs p where p.id = program_id)) with check (exists (select 1 from programs p where p.id = program_id and (is_top_management() or p.client_id in (select my_coach_client_ids()))));
create policy program_exercises_rw on program_exercises for all to authenticated using (exists (select 1 from program_days d where d.id = program_day_id))
  with check (exists (select 1 from program_days d join programs p on p.id = d.program_id where d.id = program_day_id and (is_top_management() or p.client_id in (select my_coach_client_ids()))));

-- client training data: client writes own; coaching team reads
create policy workout_logs_client on workout_logs for all to authenticated using (client_id = my_client_id()) with check (client_id = my_client_id());
create policy workout_logs_coach on workout_logs for select to authenticated using (is_top_management() or client_id in (select my_coach_client_ids()));
create policy set_logs_client on set_logs for all to authenticated using (exists (select 1 from workout_logs w where w.id = workout_log_id and w.client_id = my_client_id()))
  with check (exists (select 1 from workout_logs w where w.id = workout_log_id and w.client_id = my_client_id()));
create policy set_logs_coach on set_logs for select to authenticated using (exists (select 1 from workout_logs w where w.id = workout_log_id and (is_top_management() or w.client_id in (select my_coach_client_ids()))));
create policy body_metrics_client on body_metrics for all to authenticated using (client_id = my_client_id()) with check (client_id = my_client_id());
create policy body_metrics_coach on body_metrics for all to authenticated using (is_top_management() or client_id in (select my_coach_client_ids())) with check (is_top_management() or client_id in (select my_coach_client_ids()));
create policy nutrition_read on nutrition_plans for select to authenticated using (is_top_management() or client_id = my_client_id() or client_id in (select my_coach_client_ids()));
create policy nutrition_write on nutrition_plans for all to authenticated using (is_top_management() or client_id in (select my_coach_client_ids())) with check (is_top_management() or client_id in (select my_coach_client_ids()));

-- notes with visibility
create policy notes_read on client_notes for select to authenticated using (
  is_top_management()
  or (visibility in ('coaching','all') and client_id in (select my_coach_client_ids()))
  or (visibility in ('sales','all') and client_id in (select my_sales_client_ids()))
);
create policy notes_insert on client_notes for insert to authenticated with check (
  author_membership_id in (select my_membership_ids()) and (
    is_top_management()
    or (visibility in ('coaching','all') and client_id in (select my_coach_client_ids()))
    or (visibility in ('sales','all') and client_id in (select my_sales_client_ids()))
  )
);

-- events, audit, notifications, targets
create policy events_read on events for select to authenticated using (is_top_management() or (branch_id in (select my_branch_ids()) and (has_role('head_coach', branch_id) or has_role('sales_manager', branch_id))));
create policy audit_read on audit_log for select to authenticated using (
  is_top_management() or (branch_id in (select my_branch_ids()) and (has_role('head_coach', branch_id) or has_role('sales_manager', branch_id)))
);
create policy notifications_own on notifications for select to authenticated using (recipient_profile_id = auth.uid() or client_id = my_client_id());
create policy notifications_mark_read on notifications for update to authenticated using (recipient_profile_id = auth.uid() or client_id = my_client_id()) with check (recipient_profile_id = auth.uid() or client_id = my_client_id());
create policy targets_read on targets for select to authenticated using (
  is_top_management() or (scope_type = 'membership' and scope_id in (select my_membership_ids()))
  or (scope_type = 'branch' and scope_id in (select my_branch_ids()) and (has_role('head_coach', scope_id) or has_role('sales_manager', scope_id)))
  or (scope_type = 'membership' and exists (select 1 from memberships m where m.id = scope_id and (has_role('head_coach', m.branch_id) or has_role('sales_manager', m.branch_id))))
);
create policy targets_write on targets for all to authenticated using (is_top_management()) with check (is_top_management());

-- =====================================================================
-- 19. GRANTS
-- =====================================================================
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on memberships, settings, lead_sources, products, bundle_items, touches, follow_ups, coach_availability, exercises, program_templates, programs, program_days, program_exercises, workout_logs, set_logs, body_metrics, nutrition_plans, client_notes, targets, branches to authenticated;
-- state-carrying tables: rows are created/updated by fn_* (SECURITY DEFINER); direct access is limited to editorial columns
grant insert on leads, deals, deal_items, profiles to authenticated;
grant delete on deal_items to authenticated;
grant update (full_name, email, phone, gender, date_of_birth, preferred_language, avatar_url) on profiles to authenticated;
grant update (full_name, email, source_id, interest_tags, referred_by_client_id, instagram_handle, consent_marketing, consent_content) on leads to authenticated;
grant update (full_name, email, gender, date_of_birth, injuries, instagram_handle, onboarding_responses, nutritionist_membership_id) on clients to authenticated;
grant update (discount_pct, discount_fixed_piastres, payment_plan, installments_count, notes, is_renewal, closer_membership_id) on deals to authenticated;
grant update (product_id, qty, provider_membership_id) on deal_items to authenticated;
grant update (notes) on sessions to authenticated;
grant update (read_at, status) on notifications to authenticated;
grant insert on notifications to authenticated;  -- only through fn_notify* (SECURITY DEFINER); kept for the Edge Functions' role
grant usage, select on all sequences in schema public to authenticated;
revoke all on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function fn_submit_onboarding(text, text, jsonb, boolean) to anon;
grant execute on function fn_normalize_phone(text) to anon;

-- =====================================================================
-- 20. DEFAULT SETTINGS AND SOURCES
-- =====================================================================
insert into settings(key, value, description) values
 ('sales.first_contact_sla_hours', '2', 'Hours a rep has to make first contact'),
 ('sales.stale_lead_days', '14', 'Days without a touch before a lead is flagged stale'),
 ('leads.review_required', 'false', 'Every lead goes through manager review'),
 ('leads.round_robin_enabled', 'true', 'Round robin available for inbound leads'),
 ('leads.round_robin_auto', 'false', 'Assign inbound leads automatically on creation (else manager assigns)'),
 ('deals.auto_approve_list_price', 'true', 'List price deals do not need approval'),
 ('deals.installments_need_approval', 'true', 'Installment plans need sales manager approval'),
 ('payments.installments_enabled', 'true', 'Installments allowed'),
 ('payments.min_first_payment_pct', '30', 'Minimum first payment as % of total'),
 ('credits.expiry_days_small', '90', 'Expiry for packs of 12 sessions or fewer'),
 ('credits.expiry_days_large', '180', 'Expiry for packs over 12 sessions'),
 ('attendance.no_show_deducts', 'false', 'No-show is recorded for adherence analytics only; set true to burn a credit'),
 ('attendance.edit_window_hours', '24', 'Coach may edit outcomes within this window; after that, head coach approval'),
 ('scheduling.slot_minutes', '60', 'Default session length'),
 ('coaching.consult_sla_hours', '48', 'Hours to make the welcome call after a PT pack is sold'),
 ('clients.cross_branch_checkin', 'true', 'A membership admits the client at both branches (PT packs stay with their coach)'),
 ('nutrition.fallback_to_coach', 'true', 'Read by the app: show the coach as nutrition owner when the client has no nutritionist'),
 ('freeze.max_days', '30', 'Max days per freeze'),
 ('freeze.max_count', '2', 'Max freezes per rolling year'),
 ('risk.no_visit_days', '10', 'Days without a visit before risk points apply'),
 ('risk.no_visit_points', '40', ''),
 ('risk.low_adherence_points', '30', ''),
 ('risk.low_credit_threshold', '2', ''),
 ('risk.expiring_days', '7', ''),
 ('risk.low_credit_points', '30', ''),
 ('risk.at_risk_threshold', '60', 'Score at or above which a client is at risk'),
 ('attribution.renewal_owner', '"closer"', 'closer | rep — who gets a renewal deal in sales reports'),
 ('commission.tax_pct', '14', 'Tax deducted from a PT pack price before the per-session value is computed (7500 − 14% = 6450; ÷ 10 sessions = 645/session)'),
 ('commission.pt_tiers', '[{"up_to":160,"pct":30},{"up_to":200,"pct":40},{"up_to":null,"pct":50}]', 'Coach commission on net value of sessions burned in the period; the tier reached applies to the whole period'),
 ('commission.sales_membership_pct', '5', 'Sales commission on membership revenue collected (placeholder until confirmed)'),
 ('commission.sales_nutrition_pct', '5', 'Sales commission on nutrition revenue collected (placeholder — confirm who owns nutrition commission)'),
 ('analytics.week_start', '"saturday"', ''),
 ('products.enable_group_classes', 'false', 'v2'),
 ('auth.client_otp_channel', '"whatsapp"', 'whatsapp | sms — OTP delivery for client login'),
 ('leads.round_robin_weighted', 'false', 'Reserved: weight rotation by open pipeline size');

insert into lead_sources(code, name, sort_order) values
 ('walk_in','Walk-in',1), ('instagram','Instagram',2), ('referral','Referral',3), ('website','Website',4), ('event','Event',5), ('phone','Phone call',6), ('other','Other',9);
