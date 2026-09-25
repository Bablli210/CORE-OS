/**
 * pnpm seed:auth — make the seeded users able to log in on the LOCAL Supabase stack.
 *
 *   staff (every seeded user with an email): password `gymos-dev`, email confirmed
 *   clients (seeded users with a phone and no email): phone confirmed, so phone OTP login works
 *     (local OTP for every seeded client phone is 123456 — supabase/config.toml [auth.sms.test_otp])
 *
 * supabase/seed.sql inserts bare auth.users rows (id, email, phone). Supabase Auth ignores rows without
 * instance_id/aud/role and cannot scan NULL token columns, so the admin API reports them as "user not found";
 * it also stores auth.users.phone without the leading "+" (profiles/clients keep E.164; only auth.users changes).
 * Step 1 fills those columns (local database only, via psql); step 2 uses the admin API as intended.
 *
 * Run after `supabase db reset`. Idempotent. Refuses to run against anything but localhost.
 */
import { execFileSync } from "node:child_process";
import { createClient, type User } from "@supabase/supabase-js";

const STAFF_PASSWORD = "gymos-dev";
const NIL_INSTANCE = "00000000-0000-0000-0000-000000000000";

function localStatus(): Record<string, string> {
  const out = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return Object.fromEntries(
    out
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
}

function assertLocal(name: string, url: string) {
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error(`${name} points at ${host}; seed-auth only runs against the local Supabase stack.`);
  }
}

function repairAuthRows(dbUrl: string): number {
  const sql = `
    with fixed as (
      update auth.users set
        instance_id = coalesce(instance_id, '${NIL_INSTANCE}'),
        phone = ltrim(phone, '+'),
        aud = coalesce(aud, 'authenticated'),
        role = coalesce(role, 'authenticated'),
        confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change_token_current = coalesce(email_change_token_current, ''),
        email_change = coalesce(email_change, ''),
        phone_change = coalesce(phone_change, ''),
        phone_change_token = coalesce(phone_change_token, ''),
        reauthentication_token = coalesce(reauthentication_token, ''),
        raw_app_meta_data = coalesce(raw_app_meta_data, case when email is not null
          then '{"provider":"email","providers":["email"]}' else '{"provider":"phone","providers":["phone"]}' end::jsonb),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb),
        created_at = coalesce(created_at, now()),
        updated_at = coalesce(updated_at, now())
      where instance_id is null or aud is null or role is null or confirmation_token is null or phone like '+%'
      returning 1
    ) select count(*) from fixed;`;
  const out = execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], { encoding: "utf8" });
  return Number(out.trim());
}

async function listAllUsers(admin: ReturnType<typeof createClient>["auth"]["admin"]): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function main() {
  const status = localStatus();
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? status.API_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || status.SERVICE_ROLE_KEY;
  const dbUrl = status.DB_URL;
  if (!apiUrl || !serviceKey || !dbUrl) throw new Error("Local Supabase is not running. Run `supabase start` first.");
  assertLocal("API URL", apiUrl);
  assertLocal("DB URL", dbUrl);

  const repaired = repairAuthRows(dbUrl);
  console.log(`auth.users rows repaired: ${repaired}`);

  const admin = createClient(apiUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }).auth.admin;
  const users = await listAllUsers(admin);
  const staff = users.filter((u) => u.email);
  const clients = users.filter((u) => !u.email && u.phone);

  for (const u of staff) {
    const { error } = await admin.updateUserById(u.id, { password: STAFF_PASSWORD, email_confirm: true });
    if (error) throw new Error(`staff ${u.email}: ${error.message}`);
  }
  for (const u of clients) {
    const { error } = await admin.updateUserById(u.id, { phone_confirm: true });
    if (error) throw new Error(`client +${u.phone}: ${error.message}`);
  }
  console.log(`staff with password "${STAFF_PASSWORD}": ${staff.length}`);
  console.log(`clients with phone login (local OTP 123456): ${clients.length}`);

  // The dashboards read materialized views that pg_cron refreshes every 5 minutes; fill them now so a freshly seeded
  // demo shows its numbers straight away.
  execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-At", "-c", "select fn_refresh_views(true)"], { encoding: "utf8" });
  console.log("dashboards refreshed");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
