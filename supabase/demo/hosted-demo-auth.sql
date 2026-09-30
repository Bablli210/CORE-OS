-- Hosted DEMO environment only: make the seeded users (supabase/seed.sql) able to sign in on a hosted project.
--
-- Locally, `pnpm seed:auth` does this through the Auth admin API. A hosted demo is set up from SQL alone
-- (SQL editor or the Supabase MCP), so this script fills the auth.users columns Supabase Auth needs, sets one
-- shared demo password for every staff login, confirms emails and phones, and adds the auth.identities rows.
--
-- Before running: replace __DEMO_PASSWORD__ with the password you will hand out for the demo (12+ characters).
-- Members sign in with phone + code: add their numbers as test OTPs in the dashboard (docs/03 §9, hosted demo).
--
-- Refuses to run if any auth user is not a seeded demo user, so it can never touch a project with real people.

do $$
begin
  if '__DEMO_PASSWORD__' = '__DEMO' || '_PASSWORD__' then
    raise exception 'replace __DEMO_PASSWORD__ with the demo password first';
  end if;
  if exists (
    select 1 from auth.users u
    where not (coalesce(u.email, '') like '%@gymos.local'
               or u.id::text like '00000000-0000-0000-0001-%')
  ) then
    raise exception 'this project has users that are not seeded demo users; refusing to change auth';
  end if;
end $$;

update auth.users set
  instance_id = coalesce(instance_id, '00000000-0000-0000-0000-000000000000'),
  phone = ltrim(phone, '+'),
  aud = coalesce(aud, 'authenticated'),
  role = coalesce(role, 'authenticated'),
  encrypted_password = case when email is not null
    then extensions.crypt('__DEMO_PASSWORD__', extensions.gen_salt('bf')) else encrypted_password end,
  email_confirmed_at = case when email is not null then coalesce(email_confirmed_at, now()) end,
  phone_confirmed_at = case when phone is not null then coalesce(phone_confirmed_at, now()) end,
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  email_change = coalesce(email_change, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  raw_app_meta_data = case when email is not null
    then '{"provider":"email","providers":["email"]}' else '{"provider":"phone","providers":["phone"]}' end::jsonb,
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb),
  created_at = coalesce(created_at, now()),
  updated_at = now();

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       case when u.email is not null
         then jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true)
         else jsonb_build_object('sub', u.id::text, 'phone', u.phone, 'phone_verified', true) end,
       case when u.email is not null then 'email' else 'phone' end,
       now(), now(), now()
from auth.users u
where not exists (select 1 from auth.identities i where i.user_id = u.id);

select count(*) filter (where email is not null) as staff_logins,
       count(*) filter (where email is null)     as member_logins
from auth.users;
