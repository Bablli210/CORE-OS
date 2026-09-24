import { execSync } from "node:child_process";
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
