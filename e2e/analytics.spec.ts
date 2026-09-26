import { expect, test, type Page } from "@playwright/test";
import { loginStaff as login, sql, STAFF } from "./helpers";

/** Signs in afresh (a signed-in visit to /login would redirect away from the form). */
async function loginStaff(page: Page, email: string) {
  await page.context().clearCookies();
  await login(page, email);
}

// M6 acceptance (docs/05): every tile opens rows that add up to it; the heatmap cell lists its sessions; targets set in
// /admin/targets show on the rep's and coach's own screens; the admin "today" strip moves within 30s of a kiosk check-in;
// booked − collected = outstanding and deferred = the liability view; PT tiers 33 → 30%, 165 → 40% on all 165.

const REP_M = "a0000000-0000-0000-0000-000000000011"; // Mona, rep1.a
const COACH_M = "a0000000-0000-0000-0000-000000000022"; // coach1.a
const LAILA_M = "a0000000-0000-0000-0000-000000000025"; // coach2.b
const FIXTURE_CLIENT = "00000000-0000-0000-0009-0000000000e2";
const FIXTURE_LOT = "00000000-0000-0000-0009-0000000000e3";

const refresh = () => sql("select fn_refresh_views(false)");

/** Opens every tile on the screen in turn and checks its rows add up to the tile. */
async function everyTileMatchesItsRows(page: Page, path: string) {
  await page.goto(path);
  const tiles = page.getByTestId("stat-tile");
  await expect(tiles.first()).toBeVisible();
  const list = await tiles.evaluateAll((els) => els.map((e) => ({ key: e.getAttribute("data-key")!, value: e.getAttribute("data-value")!, href: e.getAttribute("href")! })));
  expect(list.length).toBeGreaterThan(3);
  for (const tile of list) {
    await page.goto(tile.href);
    const total = page.getByTestId("rows-total");
    await expect(total, tile.key).toBeVisible();
    expect(Number(await total.getAttribute("data-total")), `${path} ${tile.key}`).toBe(Number(tile.value));
  }
  return list;
}

test.describe("tiles click through to rows that equal them", () => {
  test.beforeAll(refresh);

  test("top management: every /admin tile", async ({ page }) => {
    await loginStaff(page, STAFF.ceo);
    const tiles = await everyTileMatchesItsRows(page, "/admin");
    expect(tiles.map((t) => t.key)).toEqual(expect.arrayContaining(["admin.booked", "admin.coach_commission", "admin.rep_commission", "admin.sessions"]));
    // the reconciliation figures open their rows too
    await page.goto("/admin");
    for (const k of ["booked", "collected_on_booked", "outstanding", "deferred"]) {
      const link = page.getByTestId(`recon-${k}`);
      const [value, href] = [await link.getAttribute("data-value"), await link.getAttribute("href")];
      await page.goto(href!);
      await expect(page.getByTestId("rows-total"), k).toHaveAttribute("data-total", String(Number(value)));
      await page.goto("/admin");
    }
    // the first one by clicking, as a person would
    await page.goto("/admin");
    await page.getByTestId("stat-tile").filter({ has: page.getByText("Sessions completed", { exact: true }) }).click();
    await expect(page.getByRole("heading", { name: "Sessions completed" })).toBeVisible();
    await expect(page.getByTestId("metric-row").first()).toBeVisible();
  });

  test("sales manager and rep: every /sales/numbers tile", async ({ page }) => {
    await loginStaff(page, STAFF.salesManager);
    await everyTileMatchesItsRows(page, "/sales/numbers");
    await loginStaff(page, STAFF.rep);
    const tiles = await everyTileMatchesItsRows(page, "/sales/numbers");
    expect(tiles.map((t) => t.key)).toEqual(expect.arrayContaining(["rep.membership_collected", "rep.commission"]));
  });

  test("coach: every /coach/numbers tile, with the tier meter", async ({ page }) => {
    await loginStaff(page, STAFF.coach);
    await everyTileMatchesItsRows(page, "/coach/numbers");
    await page.goto("/coach/numbers");
    await expect(page.getByTestId("tier-meter")).toBeVisible();
  });

  test("admin branch comparison cells open the branch's rows", async ({ page }) => {
    await loginStaff(page, STAFF.ceo);
    await page.goto("/admin");
    await page.getByTestId("page-tab-branches").click();
    const cell = page.getByTestId("compare-cell").and(page.locator('[data-key="admin.collected"]')).first();
    const value = await cell.getAttribute("data-value");
    await cell.click();
    await expect(page.getByTestId("rows-total")).toHaveAttribute("data-total", String(Number(value)));
  });
});

test("the heatmap shows the busiest hours and a cell lists its sessions", async ({ page }) => {
  refresh();
  await loginStaff(page, STAFF.headCoach);
  await page.goto("/coach/team");
  const cells = page.getByTestId("heat-cell");
  await expect(cells.first()).toBeVisible();
  const ns = await cells.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-n"))));
  const max = Math.max(...ns);
  expect(max).toBeGreaterThan(0);
  // the darkest step is the busiest cell
  const busiest = cells.and(page.locator(`[data-n="${max}"]`)).first();
  await expect(busiest).toHaveClass(/bg-seq-5/);
  await busiest.click();
  await expect(page.getByTestId("rows-total")).toHaveAttribute("data-total", String(max));
  await expect(page.getByTestId("metric-row")).toHaveCount(Math.min(max, 500));
});

test.describe("targets", () => {
  const month = sql("select to_char(cairo_date(now()), 'YYYY-MM')");
  const mine = `period = '${month}' and scope_id in ('${REP_M}', '${COACH_M}')`;
  let saved = "[]";
  // put back the seed's targets for Mona and Mahmoud afterwards, so the demo keeps them
  test.beforeAll(() => {
    saved = sql(`select coalesce(json_agg(t), '[]') from targets t where ${mine}`);
  });
  test.afterAll(() => {
    sql(`delete from targets where ${mine}`);
    sql(`insert into targets select * from json_populate_recordset(null::targets, '${saved}')`);
  });

  test("targets entered in /admin/targets appear as progress bars on the rep's and coach's own screens", async ({ page }) => {
    await loginStaff(page, STAFF.ceo);
    await page.goto("/admin/targets");
    const rep = page.locator(`[data-testid="target-input"][data-scope="${REP_M}"][data-metric="won_revenue"]`);
    await rep.fill("123456");
    await rep.press("Enter");
    await expect.poll(() => sql(`select value from targets where period = '${month}' and scope_id = '${REP_M}' and metric = 'won_revenue'`)).toBe("12345600");
    const coach = page.locator(`[data-testid="target-input"][data-scope="${COACH_M}"][data-metric="sessions_completed"]`);
    await coach.fill("77");
    await coach.blur();
    await expect.poll(() => sql(`select value from targets where period = '${month}' and scope_id = '${COACH_M}' and metric = 'sessions_completed'`)).toBe("77");
    expect(Number(sql(`select count(*) from events where type = 'target.saved'`))).toBeGreaterThan(0);

    await loginStaff(page, STAFF.rep);
    await page.goto("/sales/numbers");
    await expect(page.getByText("Your targets")).toBeVisible();
    // the "Your targets" card and the won-revenue tile both carry it
    await expect(page.getByRole("meter", { name: /of EGP 123,456 target/ })).toHaveCount(2);
    await expect(page.locator('[data-key="rep.won_revenue"]').getByRole("meter")).toBeVisible();

    await loginStaff(page, STAFF.coach);
    await page.goto("/coach/numbers");
    await expect(page.getByText("Your targets")).toBeVisible();
    await expect(page.getByRole("meter", { name: /of 77 target/ })).toHaveCount(2);
    await expect(page.locator('[data-key="coach.sessions"]').getByRole("meter")).toBeVisible();
  });
});

test("the admin today strip updates within 30s of a kiosk check-in", async ({ page, browser }, info) => {
  // the kiosk ignores a second check-in within 3 hours, so each viewport checks in its own client
  const phone = info.project.name.startsWith("mobile") ? "01110000005" : "01110000006";
  await loginStaff(page, STAFF.ceo);
  await page.goto("/admin");
  const visits = page.getByTestId("today-visits");
  await expect(visits).not.toHaveAttribute("data-value", "");
  const before = Number(await visits.getAttribute("data-value"));

  const desk = await browser.newPage();
  await loginStaff(desk, STAFF.desk);
  await desk.goto("/checkin");
  await desk.getByLabel("Your phone number").fill(phone);
  await desk.getByRole("button", { name: "Check in" }).click();
  await expect(desk.getByTestId("kiosk-result")).toHaveAttribute("data-ok", "true");
  await desk.close();

  await expect(visits).toHaveAttribute("data-value", String(before + 1), { timeout: 30_000 });
});

test("booked − collected = outstanding; deferred = the liability view", async ({ page }) => {
  refresh();
  await loginStaff(page, STAFF.ceo);
  await page.goto("/admin");
  const recon = page.getByTestId("reconciliation");
  await expect(recon).toHaveAttribute("data-balanced", "true");
  const v = async (k: string) => Number(await page.getByTestId(`recon-${k}`).getAttribute("data-value"));
  expect((await v("booked")) - (await v("collected_on_booked"))).toBe(await v("outstanding"));
  expect(await v("deferred")).toBe(Number(sql("select coalesce(sum(liability_piastres), 0) from mv_liability")));
});

test.describe("PT commission tiers", () => {
  const month = sql("select to_char(cairo_date(now()), 'YYYY-MM')");
  test.afterAll(() => {
    sql(`delete from sessions where client_id = '${FIXTURE_CLIENT}'`);
    sql(`delete from credit_lots where id = '${FIXTURE_LOT}'`);
    sql(`delete from clients where id = '${FIXTURE_CLIENT}'`);
    refresh();
  });

  test("33 sessions burned shows tier 30%; 165 shows 40% applied to all 165", async ({ page }) => {
    sql(`insert into clients(id, home_branch_id, full_name, phone, coach_membership_id)
         select '${FIXTURE_CLIENT}', branch_id, 'Tier Fixture', '+201099999002', id from memberships where id = '${LAILA_M}' on conflict do nothing`);
    sql(`insert into credit_lots(id, client_id, coach_membership_id, qty_issued, qty_remaining, per_session_value_piastres, tax_pct, net_per_session_value_piastres, expires_at)
         values ('${FIXTURE_LOT}', '${FIXTURE_CLIENT}', '${LAILA_M}', 400, 0, 40000, 14, 34400, now() + interval '90 days') on conflict do nothing`);
    const burned = () => Number(sql(`select count(*) from sessions where coach_membership_id = '${LAILA_M}' and credit_consumed and to_char(cairo_date(scheduled_at), 'YYYY-MM') = '${month}'`));
    const topUp = (to: number) => {
      const n = to - burned();
      if (n > 0)
        sql(`insert into sessions(client_id, coach_membership_id, branch_id, scheduled_at, status, credit_consumed, lot_id, outcome_recorded_at)
             select '${FIXTURE_CLIENT}', '${LAILA_M}', m.branch_id, greatest(date_trunc('month', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo' + interval '1 hour', now() - make_interval(mins => i)), 'completed', true, '${FIXTURE_LOT}', now()
             from generate_series(1, ${n}) i, memberships m where m.id = '${LAILA_M}'`);
      refresh();
    };

    topUp(33);
    await loginStaff(page, "coach2.b@gymos.local");
    await page.goto("/coach/numbers");
    const meter = page.getByTestId("tier-meter");
    await expect(meter).toHaveAttribute("data-sessions", "33");
    await expect(meter).toHaveAttribute("data-pct", "30");

    topUp(165);
    await page.reload();
    await expect(meter).toHaveAttribute("data-sessions", "165");
    await expect(meter).toHaveAttribute("data-pct", "40");
    // 40% of the whole month's net delivered, not just the sessions above the line
    const net = Number(sql(`select revenue_delivered_net from mv_coach_month where membership_id = '${LAILA_M}' and month = '${month}'`));
    const commission = page.locator('[data-key="coach.commission"]');
    await expect(commission).toHaveAttribute("data-value", String(Math.round(net * 0.4)));
    await commission.click();
    await expect(page.getByTestId("rows-total")).toHaveAttribute("data-total", String(Math.round(net * 0.4)));
  });
});
