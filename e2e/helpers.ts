import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

/** Local stack coordinates, read from the running Supabase CLI (never hard-coded). */
export const local = (() => {
  const env = Object.fromEntries(
    execSync("supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => [m[1], m[2]]),
  );
  return { api: env.API_URL, serviceKey: env.SERVICE_ROLE_KEY, db: env.DB_URL, mailpit: env.MAILPIT_URL ?? env.INBUCKET_URL };
})();

export const PASSWORD = "gymos-dev";
export const STAFF = {
  ceo: "ceo@gymos.local",
  salesManager: "sales.manager@gymos.local",
  rep: "rep1.a@gymos.local",
  headCoach: "headcoach.a@gymos.local",
  coach: "coach1.a@gymos.local",
  desk: "desk.a@gymos.local",
  deskB: "desk.b@gymos.local",
  sara: "coach2.a@gymos.local",
} as const;
export const PROFILE_IDS = { rep: "00000000-0000-0000-0000-000000000011" } as const;

export function sql(query: string): string {
  return execSync(`psql "${local.db}" -Atc "${query.replace(/"/g, '\\"')}"`, { encoding: "utf8" }).trim();
}

export async function loginStaff(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByRole("tab", { name: "Staff" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export async function loginClient(page: Page, localNumber: string, code = "123456") {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Phone number" }).fill(localNumber);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export async function expectContext(page: Page, text: string | RegExp) {
  await expect(page.getByTestId("active-context")).toHaveText(text);
}

/** Opens a nav destination whether it sits in the side nav, the bottom bar, or under "More". */
export async function openNav(page: Page, name: string) {
  const direct = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name, exact: true }).filter({ visible: true });
  const more = page.getByRole("button", { name: "More" }).filter({ visible: true });
  await expect(direct.or(more).first()).toBeVisible();
  if (await direct.count()) {
    await direct.first().click();
  } else {
    await more.click();
    await page.getByRole("dialog", { name: "More" }).getByRole("link", { name, exact: true }).click();
  }
}

/** Newest email to an address in the local Mailpit inbox. */
export async function latestEmailHtml(to: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${local.mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const body = (await res.json()) as { messages: { ID: string }[] };
    if (body.messages?.length) {
      const msg = (await (await fetch(`${local.mailpit}/api/v1/message/${body.messages[0].ID}`)).json()) as { HTML: string };
      return msg.HTML;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no email for ${to}`);
}

export const MEMBERSHIP_IDS = {
  mona: "a0000000-0000-0000-0000-000000000011",
  youssef: "a0000000-0000-0000-0000-000000000012",
} as const;
export const BRANCH_A = "b0000000-0000-0000-0000-00000000000a";

let phoneSeq = 0;
/** A local Egyptian mobile number no test has used (010 + 8 digits from the clock). */
export function uniqueLocalPhone(): string {
  phoneSeq += 1;
  return `010${String((Date.now() + phoneSeq * 7919) % 100_000_000).padStart(8, "0")}`;
}
export const toE164 = (local: string) => `+20${local.slice(1)}`;

/** Test fixture: a lead owned by a rep, inserted directly (as the seed does). Returns its id. */
export function insertLead(name: string, ownerMembershipId: string | null, localPhone = uniqueLocalPhone()): string {
  const owner = ownerMembershipId ? `'${ownerMembershipId}'` : "null";
  return sql(
    `insert into leads(branch_id, full_name, phone, owner_membership_id, source_id, first_contact_due_at) values ('${BRANCH_A}', '${name}', '${toE164(localPhone)}', ${owner}, (select id from lead_sources where code = 'walk_in'), now() + interval '2 hours') returning id`,
  ).split("\n")[0];
}

export async function createLeadInUi(page: Page, name: string, localPhone: string) {
  await page.goto("/sales/leads/new");
  await page.getByLabel("Full name").fill(name);
  await page.getByRole("textbox", { name: "Phone number" }).fill(localPhone);
  await page.getByRole("button", { name: "Save lead" }).click();
  await expect(page.getByRole("status").filter({ hasText: `${name} saved` })).toBeVisible();
}

/** A reserved local test phone (+2010999000NN, OTP 123456 in supabase/config.toml) that no lead/client/profile uses yet. */
export function freeTestPhone(): { local: string; e164: string } {
  const used = new Set(sql("select phone from leads union select phone from clients union select coalesce(phone, '') from profiles").split("\n"));
  for (let n = 1; n <= 60; n++) {
    const e164 = `+2010999000${String(n).padStart(2, "0")}`;
    if (!used.has(e164)) return { local: `0${e164.slice(3)}`, e164 };
  }
  throw new Error("no reserved test phone left: reset the database (supabase db reset && pnpm seed:auth)");
}

/** Same formatting as the app (apps/web/src/lib/format.ts). */
export const egp = (piastres: number) => new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(piastres / 100);

/** Runs a SQL script as one psql session (dollar quotes and several statements allowed); returns the last result. */
export function sqlScript(script: string): string {
  const file = join(mkdtempSync(join(tmpdir(), "gymos-e2e-")), "fixture.sql");
  writeFileSync(file, script);
  return execSync(`psql "${local.db}" -Atq -v ON_ERROR_STOP=1 -f "${file}"`, { encoding: "utf8" }).trim().split("\n").at(-1) ?? "";
}

export const COACH_IDS = { sara: "a0000000-0000-0000-0000-000000000023", mahmoud: "a0000000-0000-0000-0000-000000000022" } as const;
const MONA_PROFILE = "00000000-0000-0000-0000-000000000011";

/**
 * Test fixture through the real RPCs (the M3 path): Mona sells a PT pack under a coach to a new onboarded lead, paid in full.
 * Returns the new client's id. The lead asked for Sat/Mon/Wed mornings.
 */
export function sellPtPack(name: string, coachMembershipId: string, productCode = "PT8"): string {
  return sqlScript(`
create function pg_temp.sell() returns uuid language plpgsql as $f$
declare v_lead uuid; v_deal uuid;
begin
  perform set_config('request.jwt.claim.sub', '${MONA_PROFILE}', true);
  perform set_config('request.jwt.claims', '{"sub":"${MONA_PROFILE}","role":"authenticated"}', true);
  insert into leads(branch_id, full_name, phone, owner_membership_id, status, onboarding_responses, first_contact_due_at)
  values ('${BRANCH_A}', '${name}', '${toE164(uniqueLocalPhone())}', '${MEMBERSHIP_IDS.mona}', 'onboarded',
          '{"pt_prefs":{"days":["sat","mon","wed"],"time":"morning"}}', now()) returning id into v_lead;
  v_deal := fn_create_deal(v_lead);
  perform fn_save_deal_draft(v_deal, jsonb_build_array(jsonb_build_object('product_id', (select id from products where code = '${productCode}' and branch_id is null), 'provider_membership_id', '${coachMembershipId}')));
  perform fn_submit_deal(v_deal);
  return (fn_record_payment(v_deal, (select total_piastres from deals where id = v_deal), 'cash')->>'client_id')::uuid;
end $f$;
select pg_temp.sell();`);
}

/** Runs SQL as a signed-in profile (fixture setup through the same RPCs the app calls). */
export function sqlAs(profileId: string, statement: string): string {
  return sqlScript(`
select set_config('request.jwt.claim.sub', '${profileId}', false), set_config('request.jwt.claims', '{"sub":"${profileId}","role":"authenticated"}', false);
${statement}`);
}

/** Today's date in Cairo (YYYY-MM-DD), and the weekday name the app shows. */
export function cairoDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const cairoWeekday = (iso = cairoDate()) => WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
