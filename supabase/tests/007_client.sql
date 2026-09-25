-- GymOS M5 client app tests: the client's read shapes, direct workout / body writes under RLS with phone-made ids
-- (idempotent replays, PR marking), renewals and freezes, profile, self check-in (one tap, kiosk code of the day).
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

create or replace function login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p::text,''), false),
         set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, false) $$;
create or replace function ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond then raise notice 'PASS %', msg; else raise exception 'FAIL %', msg; end if; end $$;

\set HASSAN_P '''00000000-0000-0000-0001-000000000001'''
\set HASSAN '''00000000-0000-0000-0002-000000000001'''
\set FARIDA_P '''00000000-0000-0000-0001-000000000008'''
\set MONA '''00000000-0000-0000-0000-000000000011'''
\set MAHMOUD '''00000000-0000-0000-0000-000000000022'''
\set DESK_A '''00000000-0000-0000-0000-000000000030'''
\set BRANCH_A '''b0000000-0000-0000-0000-00000000000a'''
\set W1 '''e0000000-0000-0000-0000-000000000001'''
\set W2 '''e0000000-0000-0000-0000-000000000002'''

reset role;
select id as squat from exercises where name = 'Back squat' \gset
select set_config('test.squat', :'squat', false);

set role authenticated;
select login(:HASSAN_P);

-- ---------------------------------------------------------------- read shapes
select fn_client_home() as home \gset
select ok((:'home'::jsonb)->>'first_name' = 'Hassan' and (:'home'::jsonb)->>'coach_name' = 'Mahmoud Gamal'
          and ((:'home'::jsonb)->'balances'->0->>'balance')::int = fn_credit_balance(:HASSAN::uuid), 'L1 Today: name, coach, sessions left per coach');
select ok(jsonb_array_length((:'home'::jsonb)->'slots') = 3 and (:'home'::jsonb)->'next_session'->>'starts_at' is not null, 'L2 Today: his three weekly slots (read-only) and the next session');
select ok((:'home'::jsonb)#>>'{program,name}' = 'Strength block 1' and ((:'home'::jsonb)#>>'{program,next_day_index}')::int between 1 and 2, 'L3 Today: the active program and the suggested day');
select ok(jsonb_array_length((fn_client_training())#>'{program,days}') = 2, 'L4 the logger has the program days');

-- ---------------------------------------------------------------- direct writes under RLS, ids made on the phone
insert into workout_logs(id, client_id, program_day_id, performed_at) values (:W1, :HASSAN, (select id from program_days where name = 'Day 1 — Lower'), now() - interval '2 days');
insert into set_logs(id, workout_log_id, exercise_id, set_index, weight_kg, reps) values
  ('f0000000-0000-0000-0000-000000000001', :W1, :'squat', 1, 500, 5),
  ('f0000000-0000-0000-0000-000000000002', :W1, :'squat', 2, 250, 5);
select ok((select is_pr from set_logs where id = 'f0000000-0000-0000-0000-000000000001') and not (select is_pr from set_logs where id = 'f0000000-0000-0000-0000-000000000002'),
          'L5 a squat set above his history is a PR, a lighter one in the same workout is not');
-- the same workout replayed from the offline queue: nothing doubles
insert into workout_logs(id, client_id, performed_at) values (:W1, :HASSAN, now()) on conflict (id) do nothing;
insert into set_logs(id, workout_log_id, exercise_id, set_index, weight_kg, reps) values ('f0000000-0000-0000-0000-000000000001', :W1, :'squat', 1, 500, 5) on conflict (id) do nothing;
select ok((select count(*) = 1 from workout_logs where id = :W1) and (select count(*) = 2 from set_logs where workout_log_id = :W1), 'L6 a replayed write with the same ids is a no-op (idempotent)');
insert into workout_logs(id, client_id) values (:W2, :HASSAN);
insert into set_logs(id, workout_log_id, exercise_id, set_index, weight_kg, reps) values ('f0000000-0000-0000-0000-000000000003', :W2, :'squat', 1, 505, 5);
select ok((select is_pr from set_logs where id = 'f0000000-0000-0000-0000-000000000003'), 'L7 beating his history marks the set as a PR');
reset role;
select ok(exists (select 1 from events where type = 'workout.logged' and subject_id = :W2), 'L8 a logged workout emits workout.logged');
set role authenticated; select login(:HASSAN_P);
do $$ begin
  insert into workout_logs(client_id) values ('00000000-0000-0000-0002-000000000002');
  raise exception 'FAIL L9 logged a workout for another client';
exception when insufficient_privilege then raise notice 'PASS L9 a client writes only their own logs (RLS)'; end $$;
insert into body_metrics(client_id, weight_kg) values (:HASSAN, 82.5);
select ok(((fn_client_progress())->'body'->-1->>'weight_kg')::numeric = 82.5, 'L10 body weight written directly shows in progress');
select ok((select (x->>'weight_kg')::numeric = 505 from jsonb_array_elements((fn_client_progress())->'prs') x where x->>'exercise_id' = :'squat')
          and ((fn_client_progress())->>'streak_weeks')::int >= 1, 'L11 progress: the squat PR and a weekly streak');
select ok(((fn_client_training())#>'{history}'->:'squat'->'sets'->0->>'weight_kg')::numeric = 505, 'L12 "last time" is the latest workout''s sets');

-- ---------------------------------------------------------------- credits, renew, freeze, profile
select fn_client_credits() as cr \gset
select ok(((:'cr'::jsonb)->'balances'->0->>'balance')::int = fn_credit_balance(:HASSAN::uuid) and (:'cr'::jsonb)#>>'{advisor,first_name}' = 'Mona'
          and jsonb_array_length((:'cr'::jsonb)->'payments') >= 1, 'L13 credits: balances match fn_credit_balances, the advisor, payments');
select fn_flag_for_sales(:HASSAN, 'Wants to renew', 'renewal_request');
reset role;
select ok(exists (select 1 from follow_ups where client_id = :HASSAN and status = 'open' and title like 'FLAG:%' and assigned_to_membership_id = 'a0000000-0000-0000-0000-000000000011')
          and exists (select 1 from notifications where recipient_profile_id = :MONA and type = 'client.flagged' and data->>'client_id' = :HASSAN)
          and exists (select 1 from notifications where recipient_profile_id = :MAHMOUD and type = 'client.flagged' and data->>'kind' = 'renewal_request'), 'L14 Renew: FLAG task for Mona, Mona and Mahmoud notified');
set role authenticated; select login(:HASSAN_P);
select ok(((fn_client_credits())->>'renewal_open')::boolean, 'L15 the credits screen knows a renewal is already asked for');
select fn_request_freeze(:HASSAN, now() + interval '1 day', now() + interval '8 days', 'travel') as fz \gset
select ok((select status = 'pending' and approval_id is not null from freezes where id = :'fz'), 'L16 a freeze request goes to the sales manager');
select fn_update_my_profile('{"time":"evening","days":["sun","tue"],"hacked":true}', '@hassan', 'ar', true);
reset role;
select ok((select onboarding_responses #>> '{pt_prefs,time}' = 'evening' and not (onboarding_responses->'pt_prefs' ? 'hacked') and instagram_handle = '@hassan'
                  and (onboarding_responses #>> '{social,consent_marketing}')::boolean from clients where id = :HASSAN)
          and (select preferred_language = 'ar' from profiles where id = :HASSAN_P), 'L17 profile: preferences (known keys only), handle, consent, language');
set role authenticated;

-- ---------------------------------------------------------------- self check-in
select login(:FARIDA_P);
select ok((fn_client_check_in())->>'reason' = 'no_session_soon', 'L18 one tap needs a session within the hour');
select ok((fn_client_check_in(:BRANCH_A, 'nope'))->>'reason' = 'bad_code', 'L19 a wrong kiosk code is refused');
do $$ begin
  perform fn_kiosk_code('b0000000-0000-0000-0000-00000000000a');
  raise exception 'FAIL L20 a client read the kiosk code';
exception when insufficient_privilege then raise notice 'PASS L20 only staff read the kiosk code'; end $$;
select login(:DESK_A);
select fn_kiosk_code(:BRANCH_A) as code \gset
select login(:FARIDA_P);
select ok((fn_client_check_in(:BRANCH_A, :'code'))->>'ok' = 'true', 'L21 the kiosk code of the day checks her in');
select login(:HASSAN_P);
reset role;
insert into sessions(client_id, coach_membership_id, branch_id, scheduled_at) values (:HASSAN, 'a0000000-0000-0000-0000-000000000022', :BRANCH_A, now() + interval '30 minutes');
set role authenticated; select login(:HASSAN_P);
select ok((fn_client_check_in())->>'ok' = 'true', 'L22 one tap works with a session in the next hour');
select login(:MONA);
do $$ begin
  perform fn_client_home();
  raise exception 'FAIL L23 staff read a client home';
exception when no_data_found then raise notice 'PASS L23 client screens are for clients'; end $$;
reset role;
select ok(not has_table_privilege('authenticated', 'app_secrets', 'select'), 'L24 the kiosk secret is not readable over the API');

drop function login(uuid); drop function ok(boolean, text);
select 'ALL CLIENT APP TESTS PASSED' as result;
