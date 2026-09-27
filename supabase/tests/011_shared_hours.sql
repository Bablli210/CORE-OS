-- GymOS shared-hours tests (docs/06 #20, the owner's rule of 2026-09-27: "a coach can have 2 or more clients book the same
-- session and hour, it is totally up to him/her"). Two clients in one hour: both slots accepted, both sessions materialize,
-- each outcome and each session used is the client's own. Still refused: anything over a Blocked hour, a Blocked hour over
-- existing slots or the coach's booked one-offs, the same client in two places at once (with any coach; weekly slots and one-offs are checked against each
-- other). One-off sessions follow the same rules.
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

create or replace function login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p::text,''), false),
         set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, false) $$;
create or replace function ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond then raise notice 'PASS %', msg; else raise exception 'FAIL %', msg; end if; end $$;
-- runs a statement that must be refused with exactly this message (check_violation)
create or replace function refused(stmt text, expected text, msg text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL % (accepted)', msg;
exception when check_violation then
  if sqlerrm = expected then raise notice 'PASS %', msg; else raise exception 'FAIL % — wrong message: %', msg, sqlerrm; end if;
end $$;

\set MONA '''00000000-0000-0000-0000-000000000011'''
\set SARA '''00000000-0000-0000-0000-000000000023'''
\set MAHMOUD '''00000000-0000-0000-0000-000000000022'''
\set SARA_M '''a0000000-0000-0000-0000-000000000023'''
\set MAHMOUD_M '''a0000000-0000-0000-0000-000000000022'''
\set BRANCH_A '''b0000000-0000-0000-0000-00000000000a'''

-- ---------------------------------------------------------------- fixtures: two new clients with 8 sessions each with Sara (the M3 path);
-- Ali also buys 8 with Mahmoud, so "the same client with another coach" can be tried
reset role;
insert into leads(branch_id, full_name, phone, owner_membership_id, status, first_contact_due_at)
values (:BRANCH_A, 'Shared Hour Ali', '+201055580001', 'a0000000-0000-0000-0000-000000000011', 'onboarded', now()),
       (:BRANCH_A, 'Shared Hour Bea', '+201055580002', 'a0000000-0000-0000-0000-000000000011', 'onboarded', now());
select id as lead_a from leads where phone = '+201055580001' \gset
select id as lead_b from leads where phone = '+201055580002' \gset
select id as pt8 from products where code = 'PT8' and branch_id is null \gset
set role authenticated;
select login(:MONA);
select fn_create_deal(:'lead_a') as deal_a \gset
select fn_save_deal_draft(:'deal_a', ('[{"product_id":"' || :'pt8' || '","provider_membership_id":"a0000000-0000-0000-0000-000000000023"}]')::jsonb) is not null as saved \gset
select (fn_submit_deal(:'deal_a')).status as st \gset
select (fn_record_payment(:'deal_a', (select total_piastres from deals where id = :'deal_a'), 'cash'))->>'client_id' as ali \gset
select fn_create_deal(:'lead_b') as deal_b \gset
select fn_save_deal_draft(:'deal_b', ('[{"product_id":"' || :'pt8' || '","provider_membership_id":"a0000000-0000-0000-0000-000000000023"}]')::jsonb) is not null as saved \gset
select (fn_submit_deal(:'deal_b')).status as st \gset
select (fn_record_payment(:'deal_b', (select total_piastres from deals where id = :'deal_b'), 'cash'))->>'client_id' as bea \gset
select fn_create_deal(null, :'ali') as deal_a2 \gset
select fn_save_deal_draft(:'deal_a2', ('[{"product_id":"' || :'pt8' || '","provider_membership_id":"a0000000-0000-0000-0000-000000000022"}]')::jsonb) is not null as saved \gset
select (fn_submit_deal(:'deal_a2')).status as st \gset
select (fn_record_payment(:'deal_a2', (select total_piastres from deals where id = :'deal_a2'), 'cash'))->>'deal_status' as st \gset
select ok(fn_credit_balance(:'ali', :SARA_M) = 8 and fn_credit_balance(:'ali', :MAHMOUD_M) = 8 and fn_credit_balance(:'bea', :SARA_M) = 8,
          'S0 (fixture) Ali has 8 with Sara and 8 with Mahmoud, Bea 8 with Sara');

-- today's weekday; h1 = a free hour on Sara's week that day, h2 = the next free hour at least two hours later
select login(:SARA);
select extract(dow from cairo_date(now()))::int as dow, (array['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[extract(dow from cairo_date(now()))::int + 1] as dayname \gset
select to_char(h, 'HH24:MI') as h1 from generate_series(timestamp '2000-01-01 05:00', timestamp '2000-01-01 20:00', interval '1 hour') h
where not exists (select 1 from schedule_slots x where x.coach_membership_id = :SARA_M::uuid and x.is_active and x.weekday = :dow
                  and x.start_time < h::time + interval '1 hour' and x.start_time + make_interval(mins => x.duration_minutes) > h::time)
order by h limit 1 \gset
select to_char(h, 'HH24:MI') as h2 from generate_series(timestamp '2000-01-01 05:00', timestamp '2000-01-01 22:00', interval '1 hour') h
where h::time >= :'h1'::time + interval '2 hours'
  and not exists (select 1 from schedule_slots x where x.coach_membership_id = :SARA_M::uuid and x.is_active and x.weekday = :dow
                  and x.start_time < h::time + interval '1 hour' and x.start_time + make_interval(mins => x.duration_minutes) > h::time)
order by h limit 1 \gset
select set_config('test.ali', :'ali', false), set_config('test.bea', :'bea', false), set_config('test.dow', :'dow', false),
       set_config('test.h1', :'h1', false), set_config('test.h2', :'h2', false) is not null as cfg \gset

-- ---------------------------------------------------------------- two clients in the same hour
select fn_upsert_schedule_slot(:SARA_M, :dow, :'h1', 'client', :'ali', null, 60, cairo_date(now())) as slot_ali \gset
select fn_upsert_schedule_slot(:SARA_M, :dow, :'h1', 'client', :'bea', null, 60, cairo_date(now())) as slot_bea \gset
select ok((select count(*) = 2 from schedule_slots where id in (:'slot_ali', :'slot_bea') and is_active and start_time = :'h1'::time and weekday = :dow),
          'S1 Ali and Bea are both on Sara''s week at the same hour');
select ok(jsonb_array_length(jsonb_path_query_array(fn_coach_week(:SARA_M, cairo_date(now())), '$.slots[*] ? (@.start_time == $t && @.weekday == $d && @.kind == "client")',
                                                    jsonb_build_object('t', :'h1', 'd', :dow))) = 2,
          'S2 the week read shape carries both slots at that hour');
select ok(cardinality(fn_add_weekly_slots(:SARA_M, array[:dow], (:'h1'::time + interval '30 minutes')::time, 'class', null, 'Stretch', 30, cairo_date(now()))) = 1,
          'S3 a class may share the hour with clients too (the coach decides)');

-- both sessions materialize; each client has their own outcome and uses one session from their own pack
select (fn_coach_today(:SARA_M)) is not null as opened \gset
select id as s_ali from sessions where slot_id = :'slot_ali' and cairo_date(scheduled_at) = cairo_date(now()) \gset
select id as s_bea from sessions where slot_id = :'slot_bea' and cairo_date(scheduled_at) = cairo_date(now()) \gset
select ok((select count(*) = 2 from sessions where id in (:'s_ali', :'s_bea') and status = 'booked' and scheduled_at = (cairo_date(now())::text || ' ' || :'h1')::timestamp at time zone 'Africa/Cairo'),
          'S4 both sessions materialize for today at the same time, one per client');
select ok((select count(*) = 2 from jsonb_array_elements((fn_coach_today(:SARA_M))->'sessions') s where s->>'id' in (:'s_ali', :'s_bea')),
          'S5 Today lists both, each as its own session');
select fn_record_attendance(:'s_ali', 'completed') is not null as rec \gset
select fn_record_attendance(:'s_bea', 'no_show') is not null as rec \gset
select ok(fn_credit_balance(:'ali', :SARA_M) = 7 and fn_credit_balance(:'bea', :SARA_M) = 8
          and (select status from sessions where id = :'s_ali') = 'completed' and (select status from sessions where id = :'s_bea') = 'no_show',
          'S6 each has their own outcome: Ali completed (7 left), Bea no-show (8 left)');
select fn_record_attendance(:'s_bea', 'completed') is not null as rec \gset
select ok(fn_credit_balance(:'ali', :SARA_M) = 7 and fn_credit_balance(:'bea', :SARA_M) = 7 and fn_credit_balance(:'ali', :MAHMOUD_M) = 8,
          'S7 both completed: one session each from their own pack with Sara; Ali''s pack with Mahmoud is untouched');
reset role;  -- read as the owner: Ali's primary coach is now Mahmoud (his last pack), so Sara's RLS view of his lots is narrower
select ok((select count(*) = 2 and count(distinct s.lot_id) = 2 and bool_and(l.client_id = s.client_id and l.coach_membership_id = :SARA_M::uuid and s.credit_consumed and not s.unpaid)
           from sessions s join credit_lots l on l.id = s.lot_id where s.id in (:'s_ali', :'s_bea')),
          'S8 each session burned a lot of its own client with Sara, none unpaid');
select ok((select count(*) = 2 from events where type = 'credit.consumed' and subject_id in (:'s_ali', :'s_bea') and payload->>'coach_membership_id' = :SARA_M),
          'S9 two credit.consumed events for Sara: commission counts each completed session');
set role authenticated;

-- ---------------------------------------------------------------- the same client is never in two places at once
select refused(format('select fn_upsert_schedule_slot(%L, %s, %L, ''client'', %L, null, 60, cairo_date(now()))', :SARA_M, :dow, (:'h1'::time + interval '30 minutes')::time, :'ali'),
               'client already has a slot at that time', 'S10 the same client in an overlapping slot with the same coach is refused');
select refused(format('select fn_add_weekly_slots(%L, array[%s], %L, ''client'', %L, null, 60, cairo_date(now()))', :SARA_M, :dow, :'h1', :'bea'),
               :'dayname' || ': client already has a slot at that time', 'S11 through the sheet''s call the day is named');
select login(:MAHMOUD);
select refused(format('select fn_upsert_schedule_slot(%L, %s, %L, ''client'', %L, null, 60, cairo_date(now()))', :MAHMOUD_M, :dow, :'h1', :'ali'),
               'client already has a slot at that time', 'S12 the same client with another coach at that time is refused too');

-- ---------------------------------------------------------------- a Blocked hour blocks
select login(:SARA);
select fn_upsert_schedule_slot(:SARA_M, :dow, :'h2', 'blocked', null, 'Team meeting', 60, cairo_date(now())) as blk \gset
select set_config('test.blk', :'blk', false) is not null as cfg \gset
select refused(format('select fn_upsert_schedule_slot(%L, %s, %L, ''client'', %L, null, 60, cairo_date(now()))', :SARA_M, :dow, (:'h2'::time + interval '30 minutes')::time, :'bea'),
               'overlaps a blocked hour on that day', 'S13 a client slot over a Blocked hour is refused');
select refused(format('select fn_add_weekly_slots(%L, array[%s], %L, ''class'', null, ''Yoga'', 60, cairo_date(now()))', :SARA_M, :dow, :'h2'),
               :'dayname' || ': overlaps a blocked hour on that day', 'S14 a class over a Blocked hour is refused, the day named');
select refused(format('select fn_upsert_schedule_slot(%L, %s, %L, ''blocked'', null, ''Admin'', 60, cairo_date(now()))', :SARA_M, :dow, :'h1'),
               'a blocked hour cannot overlap another slot on that day', 'S15 a Blocked hour over the clients'' hour is refused');
select refused(format('select fn_upsert_schedule_slot(%L, %s, %L, ''client'', %L, null, 60, cairo_date(now()), null, %L)', :SARA_M, :dow, :'h2', :'bea', :'slot_bea'),
               'overlaps a blocked hour on that day', 'S16 moving a client slot onto a Blocked hour is refused');
select ok((select start_time = :'h1'::time and is_active from schedule_slots where id = :'slot_bea'), 'S17 the refused move left Bea''s slot where it was');
select ok(cardinality(fn_add_weekly_slots(:SARA_M, array[(:dow + 2) % 7], :'h2', 'client', :'bea', null, 60, cairo_date(now()) + 1)) = 1,
          'S18 the same hour on another weekday is free (the Blocked hour is only on its own day)');

-- ---------------------------------------------------------------- one-off sessions follow the same rules
select (cairo_date(now()) + 7) as d7, (cairo_date(now()) + 8) as d8 \gset
select fn_add_session(:'ali', :SARA_M, (:'d8' || ' 20:00')::timestamp at time zone 'Africa/Cairo') as o_ali \gset
select fn_add_session(:'bea', :SARA_M, (:'d8' || ' 20:00')::timestamp at time zone 'Africa/Cairo') as o_bea \gset
select ok((select count(*) = 2 from sessions where id in (:'o_ali', :'o_bea') and status = 'booked'), 'S19 a one-off for a second client at the same time is accepted');
select refused(format('select fn_add_session(%L, %L, (%L || '' 20:30'')::timestamp at time zone ''Africa/Cairo'')', :'ali', :SARA_M, :'d8'),
               'client already has a session at that time', 'S20 the same client twice at the same time is refused');
select refused(format('select fn_add_session(%L, %L, (%L || '' '' || %L)::timestamp at time zone ''Africa/Cairo'')', :'ali', :SARA_M, :'d7', :'h1'),
               'client already has a session at that time', 'S21 a one-off over the client''s own weekly slot (session not created yet) is refused');
select refused(format('select fn_add_session(%L, %L, (%L || '' '' || %L)::timestamp at time zone ''Africa/Cairo'' + interval ''15 minutes'')', :'bea', :SARA_M, :'d7', :'h2'),
               'overlaps a blocked hour on that day', 'S22 a one-off inside the coach''s Blocked hour is refused');
select login(:MAHMOUD);
select refused(format('select fn_add_session(%L, %L, (%L || '' 20:00'')::timestamp at time zone ''Africa/Cairo'')', :'ali', :MAHMOUD_M, :'d8'),
               'client already has a session at that time', 'S23 the same client with another coach at that time is refused');
select login(:SARA);
select fn_skip_slot(:'blk', :'d7'::date, 'meeting moved');
select ok(fn_add_session(:'bea', :SARA_M, (:'d7' || ' ' || :'h2')::timestamp at time zone 'Africa/Cairo') is not null,
          'S24 once the Blocked hour is skipped on that date, a one-off fits in it');
-- and a weekly slot is checked against the client's booked one-offs (Bea has one on d8 at 20:00)
select refused(format('select fn_upsert_schedule_slot(%L, %s, ''20:30'', ''client'', %L, null, 60, cairo_date(now()))', :SARA_M, extract(dow from :'d8'::date)::int, :'bea'),
               'client already has a session at that time', 'S25 a weekly slot over the client''s booked one-off is refused');
select ok(fn_upsert_schedule_slot(:SARA_M, extract(dow from :'d8'::date)::int, '20:30', 'client', :'bea', null, 60, :'d8'::date + 1) is not null,
          'S26 the same weekly slot starting after the one-off''s date is accepted');
-- a Blocked hour is checked against the coach's booked one-offs too (Ali and Bea on d8 at 20:00; only that date, so no weekly
-- slot of Sara is in the way and the one-offs alone refuse it)
select ok(not exists (select 1 from schedule_slots x where x.coach_membership_id = :SARA_M::uuid and x.is_active and x.weekday = extract(dow from :'d8'::date)::int
                      and x.starts_on <= :'d8'::date and (x.ends_on is null or x.ends_on >= :'d8'::date)
                      and x.start_time < '20:30'::time and x.start_time + make_interval(mins => x.duration_minutes) > '20:00'::time),
          'S27a (fixture) no weekly slot of Sara at 20:00 on d8');
select refused(format('select fn_upsert_schedule_slot(%L, %s, ''20:00'', ''blocked'', null, ''Admin'', 30, %L::date, %L::date)', :SARA_M, extract(dow from :'d8'::date)::int, :'d8', :'d8'),
               'a blocked hour cannot overlap another slot on that day', 'S27 a Blocked hour over the coach''s booked one-offs is refused');

reset role;
drop function login(uuid); drop function ok(boolean, text); drop function refused(text, text, text);
select 'ALL SHARED-HOURS TESTS PASSED' as result;
