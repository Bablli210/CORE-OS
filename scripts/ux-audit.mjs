// Screenshot audit: signs in as each role and captures every screen full-page at 390px and 1280px.
// Usage: node scripts/ux-audit.mjs <out-dir> [filter]   (web app on :3000, local Supabase with the seed)
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const out = process.argv[2] ?? "ux-audit";
const only = process.argv[3];
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const env = Object.fromEntries(
  execSync("supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const sql = (q) => execSync(`psql "${env.DB_URL}" -Atc "${q}"`, { encoding: "utf8" }).trim();

const lead = sql("select l.id from leads l join memberships m on m.id = l.owner_membership_id join profiles p on p.id = m.profile_id where p.email = 'rep1.a@gymos.local' and l.status not in ('won','lost') order by l.created_at desc limit 1");
const deal = sql("select id from deals order by created_at desc limit 1");
const client = "00000000-0000-0000-0002-000000000001"; // Hassan

const plans = [
  { who: "public", routes: ["/login", "/welcome", "/no-access"] },
  { who: "client", phone: "01110000001", routes: ["/c", "/c/workout", "/c/progress", "/c/credits", "/c/profile", "/c/here", "/notifications"] },
  { who: "coach", email: "coach1.a@gymos.local", routes: ["/coach", "/coach/schedule", "/coach/clients", `/coach/clients/${client}`, `/coach/clients/${client}/program`, "/coach/programs", "/coach/numbers"] },
  { who: "headcoach", email: "headcoach.a@gymos.local", routes: ["/coach", "/coach/team"] },
  { who: "rep", email: "rep1.a@gymos.local", routes: ["/sales", "/sales/pipeline", "/sales/leads", "/sales/leads/new", `/sales/leads/${lead}`, "/sales/deals", "/sales/deals/new", `/sales/deals/${deal}`, `/sales/clients/${client}`, "/sales/numbers", "/numbers/rows"] },
  { who: "salesmanager", email: "sales.manager@gymos.local", routes: ["/sales", "/sales/queue", "/sales/team"] },
  { who: "desk", email: "desk.a@gymos.local", routes: ["/sales", "/checkin"] },
  { who: "ceo", email: "ceo@gymos.local", routes: ["/admin", "/admin/branches", "/admin/sales", "/admin/coaching", "/admin/clients", "/admin/money", "/admin/targets", "/admin/people", "/admin/settings", "/admin/audit"] },
];

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
for (const plan of plans) {
  if (only && plan.who !== only) continue;
  for (const [vp, size] of [["390", { width: 390, height: 844 }], ["1280", { width: 1280, height: 800 }]]) {
    const ctx = await browser.newContext({ baseURL: BASE, viewport: size, isMobile: vp === "390", hasTouch: vp === "390" });
    const page = await ctx.newPage();
    if (plan.email) {
      await page.goto("/login");
      await page.getByRole("tab", { name: "Staff" }).click();
      await page.getByLabel("Email").fill(plan.email);
      await page.getByLabel("Password").fill("gymos-dev");
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    } else if (plan.phone) {
      await page.goto("/login");
      await page.getByRole("textbox", { name: "Phone number" }).fill(plan.phone);
      await page.getByRole("button", { name: "Send code" }).click();
      await page.getByLabel("6-digit code").fill("123456");
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    }
    mkdirSync(`${out}/${plan.who}`, { recursive: true });
    for (const route of plan.routes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await page.waitForFunction(() => !document.querySelector('main [role=status] .animate-pulse, main [role=status][aria-label]'), null, { timeout: 10_000 }).catch(() => console.log("  still loading:", plan.who, vp, route));
      await page.waitForTimeout(400);
      const name = route.replace(/^\//, "").replace(/[0-9a-f-]{36}/g, "id").replace(/\//g, "_") || "root";
      await page.screenshot({ path: `${out}/${plan.who}/${name}.${vp}.png`, fullPage: true });
    }
    await ctx.close();
  }
  console.log("done", plan.who);
}
await browser.close();
