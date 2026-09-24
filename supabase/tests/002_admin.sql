-- GymOS M1 admin tests: settings, memberships, staff profiles, deactivation, realtime publication.
-- Runs after 001_rules.sql in scripts/test-db.sh (same database; relies only on seed ids).
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;

create or replace function login(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p::text,''), false),
         set_config('request.jwt.claims', case when p is null then '' else json_build_object('sub', p, 'role', 'authenticated')::text end, false) $$;
create or replace function ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond then raise notice 'PASS %', msg; else raise exception 'FAIL %', msg; end if; end $$;

\set CEO '''00000000-0000-0000-0000-000000000001'''
\set MONA '''00000000-0000-0000-0000-000000000011'''
\set SM '''00000000-0000-0000-0000-000000000010'''
\set BRANCH_B '''b0000000-0000-0000-0000-00000000000b'''

select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications'), 'A1 notifications are published to Realtime');

set role authenticated;

-- ---------------------------------------------------------------- settings
select login(:CEO);
select fn_update_setting('attendance.edit_window_hours', '48');
select ok(fn_setting_int('attendance.edit_window_hours', 24) = 48, 'A2 top management updates a setting; fn_setting_int reflects it');
select ok(exists (select 1 from events where type = 'setting.updated' and payload->>'key' = 'attendance.edit_window_hours'), 'A3 setting change emits an event');
do $$ begin
  perform fn_update_setting('attendance.edit_window_hours', '"forty"');
  raise exception 'FAIL A4 type change accepted';
exception when check_violation then raise notice 'PASS A4 a number setting rejects text'; end $$;
do $$ begin
  perform fn_update_setting('no.such.key', 'true');
  raise exception 'FAIL A5 unknown key accepted';
exception when no_data_found then raise notice 'PASS A5 unknown key rejected'; end $$;
select fn_update_setting('commission.pt_tiers', '[{"up_to":150,"pct":30},{"up_to":200,"pct":40},{"up_to":null,"pct":55}]');
select ok(fn_pt_commission_pct(151) = 40 and fn_pt_commission_pct(250) = 55, 'A6 commission tiers editable');
do $$ begin
  perform fn_update_setting('commission.pt_tiers', '[{"up_to":200,"pct":30},{"up_to":100,"pct":40},{"up_to":null,"pct":50}]');
  raise exception 'FAIL A7 descending tiers accepted';
exception when check_violation then raise notice 'PASS A7 tiers must ascend'; end $$;
select fn_update_setting('commission.pt_tiers', '[{"up_to":160,"pct":30},{"up_to":200,"pct":40},{"up_to":null,"pct":50}]');
select fn_update_setting('attendance.edit_window_hours', '24');

select login(:MONA);
do $$ begin
  perform fn_update_setting('attendance.edit_window_hours', '1');
  raise exception 'FAIL A8 rep changed a setting';
exception when insufficient_privilege then raise notice 'PASS A8 only top management changes settings'; end $$;

-- ---------------------------------------------------------------- staff profile + memberships
reset role;
insert into auth.users(id, email) values ('00000000-0000-0000-0009-00000000a001', 'new.rep.b@gymos.local');
set role authenticated;
select login(:CEO);
select ok(fn_create_staff_profile('00000000-0000-0000-0009-00000000a001', 'New Rep', 'New.Rep.B@gymos.local', '01099990001') is not null, 'A9 staff profile created');
select ok((select email = 'new.rep.b@gymos.local' and phone = '+201099990001' from profiles where id = '00000000-0000-0000-0009-00000000a001'), 'A10 email lower-cased, phone normalized');
select fn_save_membership(null, '00000000-0000-0000-0009-00000000a001', 'sales_rep', :BRANCH_B, null, '{}', 5) as rep_m \gset
select ok((select role = 'sales_rep' and branch_id = :BRANCH_B::uuid and discount_allowance_pct = 5 from memberships where id = :'rep_m'), 'A11 rep membership in branch B');
do $$ begin
  perform fn_save_membership(null, '00000000-0000-0000-0009-00000000a001', 'sales_rep', 'b0000000-0000-0000-0000-00000000000b');
  raise exception 'FAIL A12 duplicate role accepted';
exception when unique_violation then raise notice 'PASS A12 same role twice in a branch rejected'; end $$;
do $$ begin
  perform fn_save_membership(null, '00000000-0000-0000-0009-00000000a001', 'coach', null);
  raise exception 'FAIL A13 branchless coach accepted';
exception when check_violation then raise notice 'PASS A13 branch roles need a branch'; end $$;
select fn_save_membership(null, '00000000-0000-0000-0009-00000000a001', 'head_coach', :BRANCH_B, 12, '{rehab}', 0);
select ok(exists (select 1 from memberships where profile_id = '00000000-0000-0000-0009-00000000a001' and role = 'coach' and branch_id = :BRANCH_B::uuid and is_active), 'A14 head coach gets a coach membership automatically');
select fn_save_membership(:'rep_m', '00000000-0000-0000-0009-00000000a001', 'sales_rep', :BRANCH_B, null, '{}', 15, false);
select ok((select not is_active and discount_allowance_pct = 15 from memberships where id = :'rep_m'), 'A15 membership edited and deactivated');
select ok(exists (select 1 from events where type = 'membership.saved' and subject_id = :'rep_m'), 'A16 membership change emits an event');
select ok(exists (select 1 from audit_log where table_name = 'memberships' and row_id = :'rep_m' and action = 'UPDATE'), 'A17 membership change audited');

select login(:SM);
do $$ begin
  perform fn_save_membership(null, '00000000-0000-0000-0009-00000000a001', 'sales_rep', 'b0000000-0000-0000-0000-00000000000b');
  raise exception 'FAIL A18 sales manager changed roles';
exception when insufficient_privilege then raise notice 'PASS A18 only top management changes roles'; end $$;

select login(:CEO);
select fn_set_profile_active('00000000-0000-0000-0009-00000000a001', false);
select ok((select not bool_or(is_active) from memberships where profile_id = '00000000-0000-0000-0009-00000000a001')
          and (select not is_active from profiles where id = '00000000-0000-0000-0009-00000000a001'), 'A19 deactivating a person deactivates every role');
do $$ begin
  perform fn_set_profile_active('00000000-0000-0000-0000-000000000001', false);
  raise exception 'FAIL A20 deactivated self';
exception when check_violation then raise notice 'PASS A20 cannot deactivate yourself'; end $$;

-- deactivated staff lose access: my_roles() is empty
select login('00000000-0000-0000-0009-00000000a001');
select ok((select count(*) = 0 from my_roles()), 'A21 deactivated person has no roles');

-- ---------------------------------------------------------------- notifications: mark read (own rows only)
reset role;
select fn_notify('00000000-0000-0000-0000-000000000011', 'test.ping', 'for Mona') as mona_n \gset
select fn_notify('00000000-0000-0000-0000-000000000001', 'test.ping', 'for CEO') as ceo_n \gset
set role authenticated;
select login(:CEO);
select ok(fn_mark_notifications_read(array[:'mona_n'::uuid]) = 0, 'A22 cannot mark someone else''s notification read');
select ok(fn_mark_notifications_read(array[:'ceo_n'::uuid]) = 1, 'A23 marks own notification read');
select ok((select read_at is not null and status = 'read' from notifications where id = :'ceo_n'), 'A24 read_at and status set');
select login(:MONA);
select ok(fn_mark_notifications_read() >= 1, 'A25 mark all read updates rows');
select ok((select count(*) = 0 from notifications where recipient_profile_id = :MONA::uuid and read_at is null), 'A26 nothing left unread');

reset role;
drop function login(uuid); drop function ok(boolean, text);
select 'ALL ADMIN TESTS PASSED' as result;
