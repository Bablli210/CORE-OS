-- GymOS seed — a working demo: 2 branches, every role, coaches, reps, clients, sessions.
-- Loaded by `supabase db reset`. Deterministic UUIDs so tests and docs can reference them.
-- Passwords for staff in local dev: set by the app's `pnpm seed:auth` script (Supabase admin API);
-- this file only creates auth.users rows so profiles can reference them.

set client_min_messages = warning;

-- ---------------------------------------------------------------- auth users + profiles
-- Fixed ids: 0000...0001 etc. Email pattern: role.branch@gymos.local
create or replace function seed_user(p_id uuid, p_name text, p_email text, p_phone text, p_gender text)
returns void language plpgsql as $$
begin
  insert into auth.users(id, email, phone) values (p_id, p_email, p_phone) on conflict (id) do nothing;
  insert into profiles(id, full_name, email, phone, gender) values (p_id, p_name, p_email, p_phone, p_gender) on conflict (id) do nothing;
end $$;

insert into branches(id, code, name, address) values
 ('b0000000-0000-0000-0000-00000000000a', 'A', 'Branch A — New Cairo', 'New Cairo'),
 ('b0000000-0000-0000-0000-00000000000b', 'B', 'Branch B — Sheikh Zayed', 'Sheikh Zayed');

-- top management
do $$ begin
  perform seed_user('00000000-0000-0000-0000-000000000001', 'Omar Farouk', 'ceo@gymos.local', '+201000000001', 'male');
  perform seed_user('00000000-0000-0000-0000-000000000002', 'Nadia Hassan', 'coo@gymos.local', '+201000000002', 'female');
end $$;
-- sales manager (both branches)
do $$ begin
  perform seed_user('00000000-0000-0000-0000-000000000010', 'Karim Adel', 'sales.manager@gymos.local', '+201000000010', 'male');
end $$;
-- sales reps
do $$ begin
  perform seed_user('00000000-0000-0000-0000-000000000011', 'Mona Samir', 'rep1.a@gymos.local', '+201000000011', 'female');
  perform seed_user('00000000-0000-0000-0000-000000000012', 'Youssef Tarek', 'rep2.a@gymos.local', '+201000000012', 'male');
  perform seed_user('00000000-0000-0000-0000-000000000013', 'Hana Mostafa', 'rep1.b@gymos.local', '+201000000013', 'female');
  perform seed_user('00000000-0000-0000-0000-000000000014', 'Ali Reda', 'rep2.b@gymos.local', '+201000000014', 'male');
end $$;
-- head coaches
do $$ begin
  perform seed_user('00000000-0000-0000-0000-000000000020', 'Ahmed Salah', 'headcoach.a@gymos.local', '+201000000020', 'male');
  perform seed_user('00000000-0000-0000-0000-000000000021', 'Dina Khaled', 'headcoach.b@gymos.local', '+201000000021', 'female');
end $$;
-- coaches
do $$ begin
  perform seed_user('00000000-0000-0000-0000-000000000022', 'Mahmoud Gamal', 'coach1.a@gymos.local', '+201000000022', 'male');
  perform seed_user('00000000-0000-0000-0000-000000000023', 'Sara Fathy', 'coach2.a@gymos.local', '+201000000023', 'female');
  perform seed_user('00000000-0000-0000-0000-000000000024', 'Tamer Nabil', 'coach1.b@gymos.local', '+201000000024', 'male');
  perform seed_user('00000000-0000-0000-0000-000000000025', 'Laila Ashraf', 'coach2.b@gymos.local', '+201000000025', 'female');
end $$;
-- front desk
do $$ begin
  perform seed_user('00000000-0000-0000-0000-000000000030', 'Reception A', 'desk.a@gymos.local', '+201000000030', 'female');
  perform seed_user('00000000-0000-0000-0000-000000000031', 'Reception B', 'desk.b@gymos.local', '+201000000031', 'male');
end $$;

-- ---------------------------------------------------------------- memberships (fixed ids so tests can reference)
insert into memberships(id, profile_id, branch_id, role, capacity, specialties, discount_allowance_pct) values
 ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', null, 'top_management', null, '{}', 100),
 ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', null, 'top_management', null, '{}', 100),
 ('a0000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-00000000000a', 'sales_manager', null, '{}', 25),
 ('a0000000-0000-0000-0000-00000000001b', '00000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-00000000000b', 'sales_manager', null, '{}', 25),
 ('a0000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-00000000000a', 'sales_rep', null, '{}', 10),
 ('a0000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-00000000000a', 'sales_rep', null, '{}', 10),
 ('a0000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-00000000000b', 'sales_rep', null, '{}', 10),
 ('a0000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-00000000000b', 'sales_rep', null, '{}', 10),
 ('a0000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-00000000000a', 'head_coach', 15, '{strength,rehab}', 0),
 ('a0000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-00000000000b', 'head_coach', 15, '{fat_loss,prenatal}', 0),
 ('a0000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-00000000000a', 'coach', 20, '{muscle,strength}', 0),
 ('a0000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000023', 'b0000000-0000-0000-0000-00000000000a', 'coach', 20, '{fat_loss,knee,back}', 0),
 ('a0000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000024', 'b0000000-0000-0000-0000-00000000000b', 'coach', 20, '{muscle,sport}', 0),
 ('a0000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000025', 'b0000000-0000-0000-0000-00000000000b', 'coach', 20, '{fat_loss,rehab,shoulder}', 0),
 ('a0000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000030', 'b0000000-0000-0000-0000-00000000000a', 'front_desk', null, '{}', 0),
 ('a0000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000031', 'b0000000-0000-0000-0000-00000000000b', 'front_desk', null, '{}', 0);
-- (head coaches get their coach memberships automatically from the trigger)

-- ---------------------------------------------------------------- availability: every coach Sat–Thu
insert into coach_availability(membership_id, weekday, start_time, end_time)
select m.id, d, case when m.id in ('a0000000-0000-0000-0000-000000000023','a0000000-0000-0000-0000-000000000025') then '06:00'::time else '14:00'::time end,
       case when m.id in ('a0000000-0000-0000-0000-000000000023','a0000000-0000-0000-0000-000000000025') then '14:00'::time else '22:00'::time end
from memberships m cross join generate_series(0,6) d
where m.role = 'coach' and m.is_active and d <> 5; -- Friday off

-- ---------------------------------------------------------------- products (all branches)
insert into products(id, code, name, type, duration_days, session_count, expiry_days, price_piastres, sort_order) values
 ('c0000000-0000-0000-0000-000000000001', 'MEM1',  'Membership — 1 month',    'membership', 30,  null, null, 150000, 1),
 ('c0000000-0000-0000-0000-000000000002', 'MEM3',  'Membership — 3 months',   'membership', 90,  null, null, 400000, 2),
 ('c0000000-0000-0000-0000-000000000003', 'MEM12', 'Membership — 12 months',  'membership', 365, null, null, 1400000, 3),
 ('c0000000-0000-0000-0000-000000000011', 'PT8',   'PT pack — 8 sessions',    'pt_pack', null, 8,  60,  400000, 11),
 ('c0000000-0000-0000-0000-000000000012', 'PT12',  'PT pack — 12 sessions',   'pt_pack', null, 12, 90,  540000, 12),
 ('c0000000-0000-0000-0000-000000000013', 'PT24',  'PT pack — 24 sessions',   'pt_pack', null, 24, 180, 960000, 13),
 ('c0000000-0000-0000-0000-000000000014', 'PT36',  'PT pack — 36 sessions',   'pt_pack', null, 36, 180, 1296000, 14),
 ('c0000000-0000-0000-0000-000000000021', 'NUT1',  'Nutrition — 1 month',     'nutrition', 30, null, null, 120000, 21),
 ('c0000000-0000-0000-0000-000000000022', 'NUT3',  'Nutrition — 3 months',    'nutrition', 90, null, null, 300000, 22);

-- ---------------------------------------------------------------- exercises (starter library; the app seeds the full ~150 from src/data/exercises.json)
insert into exercises(name, muscle_group, equipment, movement_pattern) values
 ('Back squat','quads','barbell','squat'), ('Front squat','quads','barbell','squat'), ('Goblet squat','quads','dumbbell','squat'), ('Leg press','quads','machine','squat'),
 ('Romanian deadlift','hamstrings','barbell','hinge'), ('Conventional deadlift','posterior chain','barbell','hinge'), ('Hip thrust','glutes','barbell','hinge'), ('Kettlebell swing','glutes','kettlebell','hinge'),
 ('Bench press','chest','barbell','horizontal push'), ('Incline dumbbell press','chest','dumbbell','horizontal push'), ('Push-up','chest','bodyweight','horizontal push'), ('Machine chest press','chest','machine','horizontal push'),
 ('Overhead press','shoulders','barbell','vertical push'), ('Dumbbell shoulder press','shoulders','dumbbell','vertical push'), ('Lateral raise','shoulders','dumbbell','isolation'),
 ('Pull-up','back','bodyweight','vertical pull'), ('Lat pulldown','back','cable','vertical pull'), ('Seated cable row','back','cable','horizontal pull'), ('Barbell row','back','barbell','horizontal pull'), ('Single-arm dumbbell row','back','dumbbell','horizontal pull'),
 ('Walking lunge','quads','dumbbell','lunge'), ('Bulgarian split squat','quads','dumbbell','lunge'), ('Step-up','quads','dumbbell','lunge'),
 ('Plank','core','bodyweight','core'), ('Dead bug','core','bodyweight','core'), ('Cable crunch','core','cable','core'), ('Pallof press','core','cable','core'),
 ('Biceps curl','biceps','dumbbell','isolation'), ('Triceps pushdown','triceps','cable','isolation'), ('Face pull','rear delts','cable','isolation'),
 ('Leg curl','hamstrings','machine','isolation'), ('Leg extension','quads','machine','isolation'), ('Calf raise','calves','machine','isolation'),
 ('Treadmill walk','cardio','treadmill','cardio'), ('Bike intervals','cardio','bike','cardio'), ('Rowing machine','cardio','rower','cardio');

-- ---------------------------------------------------------------- clients: 40, spread over branches, coaches, states
-- Created directly (not via the sales flow) so the demo has history. Phones +2011xxxxxxxx.
create or replace function seed_client(p_i int, p_branch uuid, p_coach uuid, p_rep uuid, p_name text, p_gender text, p_joined_days_ago int, p_pt_qty int, p_membership_days int)
returns uuid language plpgsql as $$
declare v_cid uuid; v_uid uuid; v_phone text; v_lot uuid; v_deal uuid; v_item uuid; v_prod products;
begin
  v_uid := ('00000000-0000-0000-0001-' || lpad(p_i::text, 12, '0'))::uuid;
  v_phone := '+2011' || lpad((10000000 + p_i)::text, 8, '0');
  perform seed_user(v_uid, p_name, null, v_phone, p_gender);
  insert into memberships(profile_id, branch_id, role) values (v_uid, p_branch, 'client');
  insert into clients(id, profile_id, home_branch_id, full_name, phone, gender, rep_membership_id, joined_at, onboarding_responses)
  values (('00000000-0000-0000-0002-' || lpad(p_i::text, 12, '0'))::uuid, v_uid, p_branch, p_name, v_phone, p_gender, p_rep, now() - make_interval(days => p_joined_days_ago),
    jsonb_build_object('goal', jsonb_build_object('primary', (array['fat_loss','muscle','strength','general'])[1 + p_i % 4]),
                       'pt_prefs', jsonb_build_object('time', (array['morning','evening','afternoon'])[1 + p_i % 3], 'trainer_gender', (array['any','male','female'])[1 + p_i % 3], 'days', '["sat","mon","wed"]'::jsonb),
                       'health', jsonb_build_object('conditions', case when p_i % 5 = 0 then '["knee"]'::jsonb else '[]'::jsonb end, 'injuries', case when p_i % 5 = 0 then 'Old knee injury' else '' end)))
  returning id into v_cid;
  -- a paid deal with membership + optional PT pack, dated at join
  insert into deals(id, branch_id, client_id, rep_membership_id, closer_membership_id, status, created_by, created_at)
  values (('00000000-0000-0000-0003-' || lpad(p_i::text, 12, '0'))::uuid, p_branch, v_cid, p_rep, p_rep, 'draft', null, now() - make_interval(days => p_joined_days_ago)) returning id into v_deal;
  insert into deal_items(deal_id, product_id, qty) values (v_deal, case p_membership_days when 30 then 'c0000000-0000-0000-0000-000000000001' when 90 then 'c0000000-0000-0000-0000-000000000002' else 'c0000000-0000-0000-0000-000000000003' end::uuid, 1);
  if p_pt_qty > 0 then
    insert into deal_items(deal_id, product_id, qty, provider_membership_id) values (v_deal, case p_pt_qty when 8 then 'c0000000-0000-0000-0000-000000000011' when 12 then 'c0000000-0000-0000-0000-000000000012' when 24 then 'c0000000-0000-0000-0000-000000000013' else 'c0000000-0000-0000-0000-000000000014' end::uuid, 1, p_coach);
  end if;
  perform fn_price_deal(v_deal);
  update deals set status = 'paid', paid_piastres = total_piastres, first_paid_at = now() - make_interval(days => p_joined_days_ago), paid_at = now() - make_interval(days => p_joined_days_ago), approved_at = now() - make_interval(days => p_joined_days_ago) where id = v_deal;
  insert into payments(deal_id, amount_piastres, method, reference, received_at, recorded_by) select v_deal, total_piastres, 'cash', 'SEED', now() - make_interval(days => p_joined_days_ago), '00000000-0000-0000-0000-000000000010' from deals where id = v_deal;
  -- entitlements + credit lot
  insert into entitlements(client_id, deal_item_id, product_id, type, starts_at, ends_at, status)
  select v_cid, di.id, di.product_id, 'membership', now() - make_interval(days => p_joined_days_ago), now() - make_interval(days => p_joined_days_ago) + make_interval(days => di.duration_days),
         case when now() - make_interval(days => p_joined_days_ago) + make_interval(days => di.duration_days) > now() then 'active' else 'expired' end::entitlement_status
  from deal_items di where di.deal_id = v_deal and di.product_type = 'membership';
  if p_pt_qty > 0 then
    if p_coach is null then raise exception 'seed: PT client % needs a coach', p_name; end if;
    select di.id into v_item from deal_items di where di.deal_id = v_deal and di.product_type = 'pt_pack';
    insert into credit_lots(client_id, deal_item_id, coach_membership_id, qty_issued, qty_remaining, per_session_value_piastres, tax_pct, net_per_session_value_piastres, issued_at, expires_at)
    select v_cid, di.id, p_coach, di.session_count, di.session_count, di.line_total_piastres / di.session_count, 14, round(di.line_total_piastres / di.session_count * 0.86),
           now() - make_interval(days => p_joined_days_ago), now() - make_interval(days => p_joined_days_ago) + make_interval(days => di.expiry_days)
    from deal_items di where di.id = v_item returning id into v_lot;
    insert into credit_ledger(client_id, lot_id, entry_type, qty, reason) values (v_cid, v_lot, 'issue', p_pt_qty, 'seed purchase');
    update deal_items set credits_issued = p_pt_qty where id = v_item;
    if p_coach is not null then
      insert into coach_assignments(client_id, coach_membership_id, assigned_by, started_at) values (v_cid, p_coach, (select profile_id from memberships where role = 'head_coach' and branch_id = p_branch limit 1), now() - make_interval(days => p_joined_days_ago - 1));
      update clients set coach_membership_id = p_coach where id = v_cid;
    end if;
  end if;
  return v_cid;
end $$;

-- Branch A clients (coaches: 20 head, 22, 23)
do $$ begin
  perform seed_client(1,  'b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000011', 'Hassan Ibrahim', 'male', 75, 24, 90);
  perform seed_client(2,  'b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000011', 'Mariam Adel', 'female', 60, 12, 90);
  perform seed_client(3,  'b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000012', 'Omar Sherif', 'male', 45, 12, 30);
  perform seed_client(4,  'b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000012', 'Nour Ehab', 'female', 40, 8, 30);
  perform seed_client(5,  'b0000000-0000-0000-0000-00000000000a', (select id from memberships where profile_id='00000000-0000-0000-0000-000000000020' and role='coach'), 'a0000000-0000-0000-0000-000000000011', 'Khaled Mounir', 'male', 30, 24, 90);
  perform seed_client(6,  'b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000011', 'Salma Rashad', 'female', 25, 12, 90);
  perform seed_client(7,  'b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000012', 'Amr Lotfy', 'male', 20, 8, 30);
  perform seed_client(8,  'b0000000-0000-0000-0000-00000000000a', null, 'a0000000-0000-0000-0000-000000000011', 'Farida Nabil', 'female', 15, 0, 90);
  perform seed_client(9,  'b0000000-0000-0000-0000-00000000000a', null, 'a0000000-0000-0000-0000-000000000012', 'Ziad Hany', 'male', 12, 0, 30);
  perform seed_client(10, 'b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000011', 'Rana Yousry', 'female', 10, 36, 365);
  perform seed_client(11, 'b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000012', 'Mostafa Kamel', 'male', 8, 12, 90);
  perform seed_client(12, 'b0000000-0000-0000-0000-00000000000a', null, 'a0000000-0000-0000-0000-000000000011', 'Yasmin Fouad', 'female', 5, 0, 30);
  perform seed_client(13, 'b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000012', 'Tarek Wagdy', 'male', 90, 12, 90);
  perform seed_client(14, 'b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000011', 'Heba Magdy', 'female', 120, 8, 30);
  perform seed_client(15, 'b0000000-0000-0000-0000-00000000000a', null, 'a0000000-0000-0000-0000-000000000012', 'Sherif Anwar', 'male', 150, 0, 30);
  perform seed_client(16, 'b0000000-0000-0000-0000-00000000000a', null, 'a0000000-0000-0000-0000-000000000011', 'Dalia Saad', 'female', 3, 0, 90);
  perform seed_client(17, 'b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000012', 'Bassem Nour', 'male', 55, 24, 90);
  perform seed_client(18, 'b0000000-0000-0000-0000-00000000000a', (select id from memberships where profile_id='00000000-0000-0000-0000-000000000020' and role='coach'), 'a0000000-0000-0000-0000-000000000011', 'Ingy Sameh', 'female', 35, 12, 90);
  perform seed_client(19, 'b0000000-0000-0000-0000-00000000000a', null, 'a0000000-0000-0000-0000-000000000012', 'Wael Fikry', 'male', 200, 0, 30);
  perform seed_client(20, 'b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000011', 'Aya Tolba', 'female', 2, 8, 30);
  -- PT-only case for the kiosk rule: 1-month membership expired 10 days ago, sessions still left with Mahmoud
  perform seed_client(41, 'b0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000011', 'Adel Nasser', 'male', 40, 36, 30);
end $$;
-- Branch B clients (coaches: 21 head, 24, 25)
do $$ begin
  perform seed_client(21, 'b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000013', 'Mohamed Abdo', 'male', 70, 24, 90);
  perform seed_client(22, 'b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000025', 'a0000000-0000-0000-0000-000000000013', 'Reem Hamdy', 'female', 65, 12, 90);
  perform seed_client(23, 'b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000014', 'Islam Gaber', 'male', 50, 12, 30);
  perform seed_client(24, 'b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000025', 'a0000000-0000-0000-0000-000000000014', 'Menna Osama', 'female', 42, 8, 30);
  perform seed_client(25, 'b0000000-0000-0000-0000-00000000000b', (select id from memberships where profile_id='00000000-0000-0000-0000-000000000021' and role='coach'), 'a0000000-0000-0000-0000-000000000013', 'Adham Sabry', 'male', 33, 24, 90);
  perform seed_client(26, 'b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000013', 'Jana Hesham', 'female', 28, 12, 90);
  perform seed_client(27, 'b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000025', 'a0000000-0000-0000-0000-000000000014', 'Seif Eldin', 'male', 22, 8, 30);
  perform seed_client(28, 'b0000000-0000-0000-0000-00000000000b', null, 'a0000000-0000-0000-0000-000000000013', 'Malak Ayman', 'female', 18, 0, 90);
  perform seed_client(29, 'b0000000-0000-0000-0000-00000000000b', null, 'a0000000-0000-0000-0000-000000000014', 'Karim Zaki', 'male', 14, 0, 30);
  perform seed_client(30, 'b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000013', 'Habiba Emad', 'female', 11, 36, 365);
  perform seed_client(31, 'b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000025', 'a0000000-0000-0000-0000-000000000014', 'Hazem Ragab', 'male', 9, 12, 90);
  perform seed_client(32, 'b0000000-0000-0000-0000-00000000000b', null, 'a0000000-0000-0000-0000-000000000013', 'Lina Maged', 'female', 6, 0, 30);
  perform seed_client(33, 'b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000014', 'Ramy Helmy', 'male', 95, 12, 90);
  perform seed_client(34, 'b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000025', 'a0000000-0000-0000-0000-000000000013', 'Nada Serag', 'female', 110, 8, 30);
  perform seed_client(35, 'b0000000-0000-0000-0000-00000000000b', null, 'a0000000-0000-0000-0000-000000000014', 'Fady Sobhy', 'male', 140, 0, 30);
  perform seed_client(36, 'b0000000-0000-0000-0000-00000000000b', null, 'a0000000-0000-0000-0000-000000000013', 'Sandra Nagy', 'female', 4, 0, 90);
  perform seed_client(37, 'b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000014', 'Moataz Hafez', 'male', 58, 24, 90);
  perform seed_client(38, 'b0000000-0000-0000-0000-00000000000b', (select id from memberships where profile_id='00000000-0000-0000-0000-000000000021' and role='coach'), 'a0000000-0000-0000-0000-000000000013', 'Shahd Wahba', 'female', 37, 12, 90);
  perform seed_client(39, 'b0000000-0000-0000-0000-00000000000b', null, 'a0000000-0000-0000-0000-000000000014', 'Ehab Salem', 'male', 210, 0, 30);
  perform seed_client(40, 'b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000025', 'a0000000-0000-0000-0000-000000000013', 'Marwa Kamal', 'female', 1, 8, 30);
end $$;

-- ---------------------------------------------------------------- weekly schedule slots for every coached client (3 days a week), then 60 days of history from those slots
do $$
declare c record; d date; k int; v_sid uuid; v_status session_status; v_lot credit_lots; v_when timestamptz; v_hour int; v_slot uuid; wd int; v_slot_id uuid;
begin
  for c in select cl.id as client_id, cl.coach_membership_id, cl.home_branch_id, cl.joined_at, m.id as mid, row_number() over (partition by cl.coach_membership_id order by cl.id) as rn
           from clients cl join memberships m on m.id = cl.coach_membership_id loop
    -- morning coaches (Sara, Laila) start at 07:00, everyone else at 15:00; each client of a coach gets a different hour
    v_hour := case when c.mid in ('a0000000-0000-0000-0000-000000000023','a0000000-0000-0000-0000-000000000025') then 7 + ((c.rn - 1) % 6) else 15 + ((c.rn - 1) % 6) end;
    -- half the clients train Sat/Mon/Wed, the other half Sun/Tue/Thu, so the demo has sessions on any day but Friday
    foreach wd in array (case when c.rn % 2 = 1 then array[6, 1, 3] else array[0, 2, 4] end) loop
      insert into schedule_slots(coach_membership_id, branch_id, weekday, start_time, duration_minutes, kind, client_id, starts_on)
      values (c.coach_membership_id, c.home_branch_id, wd, make_time(v_hour, 0, 0), 60, 'client', c.client_id, greatest(current_date - 60, c.joined_at::date + 2));
    end loop;
    k := 0;
    for d in select generate_series(greatest(current_date - 60, c.joined_at::date + 2), current_date - 1, interval '1 day')::date loop
      if extract(dow from d) = any(case when c.rn % 2 = 1 then array[6, 1, 3] else array[0, 2, 4] end) then
        select id into v_slot_id from schedule_slots x where x.client_id = c.client_id and x.coach_membership_id = c.coach_membership_id and x.weekday = extract(dow from d)::int limit 1;
        v_when := (d::text || ' ' || lpad(v_hour::text,2,'0') || ':00')::timestamp at time zone 'Africa/Cairo';
        v_status := case when k % 9 = 8 then 'no_show' when k % 13 = 12 then 'cancelled' else 'completed' end;
        select * into v_lot from credit_lots where client_id = c.client_id and coach_membership_id = c.coach_membership_id and status = 'active' and qty_remaining > 0 order by expires_at limit 1;
        if v_lot.id is null then exit; end if;   -- pack ran out: history stops here (the slot stays, so Today shows them and the coach flags sales)
        insert into sessions(client_id, coach_membership_id, branch_id, scheduled_at, status, outcome_recorded_at, credit_consumed, lot_id, slot_id, cancel_reason)
        values (c.client_id, c.coach_membership_id, c.home_branch_id, v_when, v_status, v_when + interval '1 hour',
                v_status = 'completed', case when v_status = 'completed' then v_lot.id end, v_slot_id, case when v_status = 'cancelled' then 'client cancelled' end)
        returning id into v_sid;
        if v_status = 'completed' then
          update credit_lots set qty_remaining = qty_remaining - 1, status = case when qty_remaining - 1 = 0 then 'exhausted' else status end where id = v_lot.id;
          insert into credit_ledger(client_id, lot_id, session_id, entry_type, qty, reason, created_at) values (c.client_id, v_lot.id, v_sid, 'consume', -1, 'completed', v_when);
          insert into events(type, branch_id, subject_table, subject_id, payload, occurred_at)
          values ('credit.consumed', c.home_branch_id, 'sessions', v_sid, jsonb_build_object('client_id', c.client_id, 'lot_id', v_lot.id, 'value', v_lot.per_session_value_piastres, 'net_value', v_lot.net_per_session_value_piastres, 'coach_membership_id', c.coach_membership_id, 'reason', 'completed', 'scheduled_at', v_when), v_when);
          insert into visits(client_id, branch_id, checked_in_at, method) values (c.client_id, c.home_branch_id, v_when - interval '10 minutes', 'session');
          update clients set last_visit_at = greatest(coalesce(last_visit_at, v_when), v_when) where id = c.client_id;
        end if;
        insert into events(type, branch_id, subject_table, subject_id, payload, occurred_at)
        values ('session.' || v_status::text, c.home_branch_id, 'sessions', v_sid, jsonb_build_object('client_id', c.client_id, 'coach_membership_id', c.coach_membership_id, 'credit_consumed', v_status = 'completed', 'scheduled_at', v_when), v_when);
        k := k + 1;
      end if;
    end loop;
  end loop;
  -- a class and a blocked hour on a couple of schedules, so the week view has non-client slots to show
  insert into schedule_slots(coach_membership_id, branch_id, weekday, start_time, duration_minutes, kind, label)
  values ('a0000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-00000000000a', 1, '11:00', 60, 'class', 'HIIT class'),
         ('a0000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-00000000000a', 3, '11:00', 60, 'class', 'HIIT class'),
         ('a0000000-0000-0000-0000-000000000024', 'b0000000-0000-0000-0000-00000000000b', 6, '13:00', 60, 'blocked', 'Team meeting');
  -- today and tomorrow materialized from the slots (what the Today screen would do on open)
  perform fn_materialize_sessions(current_date);
  perform fn_materialize_sessions(current_date + 1);
end $$;

-- floor visits for members without PT (2–3 a week)
insert into visits(client_id, branch_id, checked_in_at, method)
select c.id, c.home_branch_id, (d::date::text || ' 18:30')::timestamp at time zone 'Africa/Cairo', 'qr'
from clients c cross join generate_series(current_date - 45, current_date, interval '1 day') d
where c.coach_membership_id is null and c.status = 'active' and extract(dow from d) in (0, 2, 4) and random() < 0.6
  and d::date >= c.joined_at::date;
update clients c set last_visit_at = (select max(checked_in_at) from visits v where v.client_id = c.id) where coach_membership_id is null;

-- ---------------------------------------------------------------- open leads in the pipeline
insert into leads(branch_id, full_name, phone, source_id, owner_membership_id, status, interest_tags, first_contact_due_at, first_contact_at, created_at, onboarding_completed_at, onboarding_responses, lost_reason) values
 ('b0000000-0000-0000-0000-00000000000a', 'Noha Sami',   '+201200000001', (select id from lead_sources where code='instagram'), 'a0000000-0000-0000-0000-000000000011', 'new', '{pt}', now() + interval '2 hours', null, now() - interval '30 minutes', null, '{}', null),
 ('b0000000-0000-0000-0000-00000000000a', 'Mazen Adly',  '+201200000002', (select id from lead_sources where code='walk_in'),   'a0000000-0000-0000-0000-000000000012', 'contacted', '{membership}', now() - interval '20 hours', now() - interval '21 hours', now() - interval '1 day', null, '{}', null),
 ('b0000000-0000-0000-0000-00000000000a', 'Layla Amin',  '+201200000003', (select id from lead_sources where code='referral'),  'a0000000-0000-0000-0000-000000000011', 'onboarded', '{pt,nutrition}', now() - interval '3 days', now() - interval '3 days', now() - interval '3 days', now() - interval '2 days', '{"goal":{"primary":"fat_loss"},"interest":{"pt":"yes","nutrition":"yes","membership":"quarterly"},"pt_prefs":{"time":"morning","trainer_gender":"female","days":["sat","mon","wed"]},"health":{"conditions":["back"],"injuries":"Lower back pain when sitting long"}}', null),
 ('b0000000-0000-0000-0000-00000000000a', 'Kareem Fawzy','+201200000004', (select id from lead_sources where code='website'),   'a0000000-0000-0000-0000-000000000012', 'quoted', '{pt}', now() - interval '6 days', now() - interval '6 days', now() - interval '6 days', now() - interval '5 days', '{"goal":{"primary":"muscle"},"interest":{"pt":"yes"},"pt_prefs":{"time":"evening","trainer_gender":"male","days":["sun","tue","thu"]}}', null),
 ('b0000000-0000-0000-0000-00000000000a', 'Inbound Lead A','+201200000005', (select id from lead_sources where code='instagram'), null, 'new', '{}', now() + interval '1 hour', null, now() - interval '10 minutes', null, '{}', null),
 ('b0000000-0000-0000-0000-00000000000b', 'Rania Helal', '+201200000011', (select id from lead_sources where code='instagram'), 'a0000000-0000-0000-0000-000000000013', 'new', '{pt}', now() - interval '3 hours', null, now() - interval '5 hours', null, '{}', null),
 ('b0000000-0000-0000-0000-00000000000b', 'Sameh Badr',  '+201200000012', (select id from lead_sources where code='walk_in'),   'a0000000-0000-0000-0000-000000000014', 'contacted', '{membership}', now() - interval '2 days', now() - interval '2 days', now() - interval '2 days', null, '{}', null),
 ('b0000000-0000-0000-0000-00000000000b', 'Dina Lotfy',  '+201200000013', (select id from lead_sources where code='referral'),  'a0000000-0000-0000-0000-000000000013', 'onboarded', '{pt}', now() - interval '4 days', now() - interval '4 days', now() - interval '4 days', now() - interval '3 days', '{"goal":{"primary":"strength"},"interest":{"pt":"yes"},"pt_prefs":{"time":"afternoon","trainer_gender":"any","days":["sat","mon","wed"]}}', null),
 ('b0000000-0000-0000-0000-00000000000b', 'Inbound Lead B','+201200000015', (select id from lead_sources where code='website'), null, 'new', '{}', now() + interval '1 hour', null, now() - interval '25 minutes', null, '{}', null),
 ('b0000000-0000-0000-0000-00000000000b', 'Lost Example','+201200000016', (select id from lead_sources where code='event'),     'a0000000-0000-0000-0000-000000000014', 'lost', '{}', now() - interval '20 days', now() - interval '20 days', now() - interval '20 days', null, '{}', 'price');

insert into follow_ups(lead_id, assigned_to_membership_id, title, due_at)
select l.id, l.owner_membership_id, 'Call back ' || l.full_name, case when l.status = 'new' then now() + interval '1 hour' else now() - interval '1 day' end
from leads l where l.owner_membership_id is not null and l.status in ('new','contacted','quoted');

-- ---------------------------------------------------------------- targets for the current month
insert into targets(period, scope_type, scope_id, metric, value)
select to_char(now(), 'YYYY-MM'), 'branch', b.id, m.metric, m.value from branches b cross join (values ('won_revenue', 25000000), ('new_clients', 25), ('sessions_completed', 400)) as m(metric, value);
insert into targets(period, scope_type, scope_id, metric, value)
select to_char(now(), 'YYYY-MM'), 'membership', m.id, 'won_revenue', 6000000 from memberships m where m.role = 'sales_rep';
insert into targets(period, scope_type, scope_id, metric, value)
select to_char(now(), 'YYYY-MM'), 'membership', m.id, 'sessions_completed', 80 from memberships m where m.role = 'coach';

-- ---------------------------------------------------------------- a program for client 1 (used by the client app demo)
do $$ declare v_pid uuid; v_day uuid; begin
  insert into programs(client_id, coach_membership_id, name, goal, weeks, starts_at, status) values ('00000000-0000-0000-0002-000000000001', 'a0000000-0000-0000-0000-000000000022', 'Strength block 1', 'muscle', 4, current_date - 14, 'active') returning id into v_pid;
  insert into program_days(program_id, day_index, name) values (v_pid, 1, 'Day 1 — Lower') returning id into v_day;
  insert into program_exercises(program_day_id, exercise_id, order_index, sets, reps, rest_seconds, target_weight_kg) values
    (v_day, (select id from exercises where name='Back squat'), 1, 4, '6-8', 150, 80),
    (v_day, (select id from exercises where name='Romanian deadlift'), 2, 3, '8-10', 120, 70),
    (v_day, (select id from exercises where name='Walking lunge'), 3, 3, '12', 90, 16),
    (v_day, (select id from exercises where name='Plank'), 4, 3, '45s', 60, null);
  insert into program_days(program_id, day_index, name) values (v_pid, 2, 'Day 2 — Upper') returning id into v_day;
  insert into program_exercises(program_day_id, exercise_id, order_index, sets, reps, rest_seconds, target_weight_kg) values
    (v_day, (select id from exercises where name='Bench press'), 1, 4, '6-8', 150, 60),
    (v_day, (select id from exercises where name='Barbell row'), 2, 4, '8', 120, 55),
    (v_day, (select id from exercises where name='Dumbbell shoulder press'), 3, 3, '10', 90, 18),
    (v_day, (select id from exercises where name='Lat pulldown'), 4, 3, '10-12', 90, 50);
end $$;

-- risk scores for the demo
do $$ begin perform fn_compute_risk_scores(); perform fn_mark_lapsed(); end $$;

drop function seed_client(int, uuid, uuid, uuid, text, text, int, int, int);
drop function seed_user(uuid, text, text, text, text);

-- local notify wiring (M7): pg_cron → pg_net → the notify Edge Function through the local gateway, with the shared
-- secret from supabase/config.toml [edge_runtime.secrets]. The hosted project sets its own values (docs/03 §9).
select vault.create_secret('http://supabase_kong_gymos:8000/functions/v1/notify', 'notify_url', 'notify Edge Function URL (local)');
select vault.create_secret('local-notify-secret', 'notify_secret', 'shared secret for the notify Edge Function (local)');
