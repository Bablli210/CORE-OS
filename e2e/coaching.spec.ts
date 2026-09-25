import { expect, test, type Page } from "@playwright/test";
import { cairoDate, cairoWeekday, COACH_IDS, loginClient, loginStaff, sellPtPack, sql, sqlAs, STAFF } from "./helpers";

const SARA_PROFILE = "00000000-0000-0000-0000-000000000023";
const AYA = { id: "00000000-0000-0000-0002-000000000020", phone: "01110000020" };
const MARIAM = "00000000-0000-0000-0002-000000000002"; // Sara's client, pack used up in the seed

/** On a phone the week shows one day: pick its tab first (desktop shows all seven). */
async function showDay(page: Page, weekday: string) {
  await expect(page.getByTestId("week-grid")).toBeVisible();
  if ((page.viewportSize()?.width ?? 1280) < 768) await page.getByRole("tab", { name: weekday, exact: true }).click();
}
async function openCell(page: Page, weekday: string, time: string) {
  await showDay(page, weekday);
  await page.getByRole("button", { name: `Add at ${weekday} ${time}` }).click();
  return page.getByRole("dialog", { name: "Add to the week" });
}
const row = (page: Page, name: string) => page.getByTestId("session-row").filter({ hasText: name });

test.describe.serial("M4: the week, the day, the head coach", () => {
  let name = "";
  let clientId = "";

  test.beforeAll(({}, info) => {
    name = `Coach Test ${info.project.name} ${Date.now() % 100000}`;
    clientId = sellPtPack(name, COACH_IDS.sara);
  });
  test.afterAll(() => {
    // leave Sara's 08:00 / 13:00 free for the other viewport's run even if a step failed
    if (clientId) sql(`update schedule_slots set is_active = false, ends_on = current_date where client_id = '${clientId}' and is_active`);
  });

  test("Sara puts the new client on 08:00 Sat/Mon/Wed in two taps; overlaps and clients without credits are refused with the reason", async ({ page }) => {
    await loginStaff(page, STAFF.sara);
    await page.goto(`/coach/clients/${clientId}`);
    await page.getByRole("link", { name: "Add to my week" }).click();
    await expect(page.getByTestId("preset-client")).toContainText(name);

    // tap 1: the free Saturday 08:00 cell; the client and their preferred days are preselected
    const sheet = await openCell(page, "Saturday", "08:00");
    await expect(sheet.getByLabel("Client")).toHaveValue(clientId);
    for (const d of ["Saturday", "Monday", "Wednesday"]) await expect(sheet.getByRole("button", { name: d })).toHaveAttribute("aria-pressed", "true");
    // tap 2: save
    await sheet.getByRole("button", { name: "Add on 3 days" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Added 3 weekly slot(s)." })).toBeVisible();
    await showDay(page, "Saturday");
    await expect(page.getByTestId("slot").filter({ hasText: name }).first()).toContainText("08:00");
    expect(sql(`select count(*) from schedule_slots where client_id = '${clientId}' and is_active and start_time = '08:00' and weekday in (6,1,3)`)).toBe("3");

    // Sunday 08:00–09:00 is Nour's: a slot at 08:30 is refused, the day named, nothing kept
    const overlap = await openCell(page, "Sunday", "09:00");
    await overlap.getByLabel("Starts at").fill("08:30");
    await overlap.getByRole("button", { name: /^Add/ }).click();
    await expect(overlap.getByRole("alert")).toContainText("Sunday: that hour overlaps another slot");
    await overlap.getByRole("button", { name: "Close" }).click();
    expect(sql(`select count(*) from schedule_slots where client_id = '${clientId}' and is_active`)).toBe("3");

    // Mariam has no sessions left with Sara: refused with the reason
    await page.goto(`/coach/schedule?client=${MARIAM}`);
    const noCredits = await openCell(page, "Friday", "13:00");
    await noCredits.getByRole("button", { name: /^Add/ }).click();
    await expect(noCredits.getByRole("alert")).toContainText("this client has no sessions left with you");
    expect(sql(`select count(*) from schedule_slots where client_id = '${MARIAM}' and weekday = 5`)).toBe("0");
  });

  test("Ahmed sees the slot on Sara's week from Team", async ({ page }) => {
    await loginStaff(page, STAFF.headCoach);
    await page.goto("/coach/team");
    await page.getByRole("link", { name: "Open Sara Fathy's week" }).click();
    await expect(page.getByRole("heading", { name: "Sara Fathy's week" })).toBeVisible();
    await showDay(page, "Saturday");
    await expect(page.getByTestId("slot").filter({ hasText: name }).first()).toBeVisible();
  });

  test("Today: Completed burns one with Sara, Cancelled restores it, a no-show without signal is queued, then syncs; adherence drops", async ({ page, context }) => {
    await loginStaff(page, STAFF.sara);
    // a slot on today's weekday so the day has this client's session
    const today = cairoWeekday();
    await page.goto(`/coach/schedule?client=${clientId}`);
    const sheet = await openCell(page, today, "13:00");
    for (const d of ["Saturday", "Monday", "Wednesday"]) {
      if (d !== today) await sheet.getByRole("button", { name: d }).click();
    }
    await sheet.getByRole("button", { name: "Add to the week" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Added 1 weekly slot(s)." })).toBeVisible();

    await page.goto("/coach");
    // (on a Sat/Mon/Wed the 08:00 slot has a session today too: this test works on the 13:00 one)
    const r = row(page, name).filter({ hasText: "13:00" });
    await expect(r.getByTestId("credits-left")).toHaveText("8 left");
    await r.getByRole("button", { name: "Completed" }).click();
    await expect(r).toHaveAttribute("data-status", "completed");
    await expect(r.getByTestId("credits-left")).toHaveText("7 left");
    await expect.poll(() => sql(`select coalesce(sum(qty_remaining), 0) from credit_lots where client_id = '${clientId}' and status = 'active'`)).toBe("7");

    await page.goto(`/coach/clients/${clientId}`);
    await expect(page.getByTestId("client-adherence")).toHaveText("100%");
    await page.goto("/coach");

    await r.getByRole("button", { name: "Cancelled" }).click();
    await expect(r.getByTestId("credits-left")).toHaveText("8 left");
    await expect.poll(() => sql(`select coalesce(sum(qty_remaining), 0) from credit_lots where client_id = '${clientId}' and status = 'active'`)).toBe("8");

    // no signal: the tap shows at once and waits; back online it is sent
    await context.setOffline(true);
    await r.getByRole("button", { name: "No-show" }).click();
    await expect(r).toHaveAttribute("data-status", "no_show");
    await expect(r.getByTestId("queued")).toBeVisible();
    await expect(page.getByTestId("queue-banner")).toContainText("waiting for signal");
    await context.setOffline(false);
    await expect(page.getByTestId("queue-banner")).toHaveCount(0, { timeout: 20_000 });
    await expect.poll(() => sql(`select status from sessions where client_id = '${clientId}' and to_char(scheduled_at at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI') = '${cairoDate()} 13:00'`)).toBe("no_show");
    await expect(r.getByTestId("credits-left")).toHaveText("8 left");

    await page.goto(`/coach/clients/${clientId}`);
    await expect(page.getByTestId("client-adherence")).toHaveText("0%");
  });

  test("a client with zero sessions left still shows; Completed asks, keeps it unpaid, and Mona sees the flag without a refresh", async ({ page, browser }) => {
    const zeroName = `Zero ${Date.now() % 100000}`;
    const zero = sellPtPack(zeroName, COACH_IDS.sara);
    sqlAs(SARA_PROFILE, `select fn_add_weekly_slots('${COACH_IDS.sara}', array[extract(dow from (now() at time zone 'Africa/Cairo'))::int], '06:00', 'client', '${zero}', null, 60, '${cairoDate()}');`);
    sql(`update credit_lots set qty_remaining = 0, status = 'exhausted' where client_id = '${zero}'`);

    const mona = await browser.newPage();
    await loginStaff(mona, STAFF.rep);
    await mona.goto("/sales");
    await expect(mona.getByRole("heading", { name: "Today" }).first()).toBeVisible();

    await loginStaff(page, STAFF.sara);
    await page.goto("/coach");
    const r = row(page, zeroName);
    await expect(r.getByTestId("credits-left")).toHaveText("0 left");
    await r.getByRole("button", { name: "Completed" }).click();
    const confirm = page.getByRole("dialog", { name: "Deliver anyway?" });
    await expect(confirm).toContainText("sales is flagged now");
    await confirm.getByRole("button", { name: "Deliver anyway and flag sales" }).click();
    await expect(r).toHaveAttribute("data-status", "completed");
    await expect(r.getByText("Unpaid")).toBeVisible();
    expect(sql(`select unpaid from sessions where client_id = '${zero}' and status = 'completed'`)).toBe("t");

    await expect(mona.getByTestId("flag-banner")).toContainText(zeroName, { timeout: 5_000 });
    await mona.close();
    sql(`update schedule_slots set is_active = false, ends_on = current_date where client_id = '${zero}'`);
  });

  test("editing a 3-day-old outcome as Sara becomes an approval; Ahmed approves it from Team; outcome and credit apply", async ({ page, browser }) => {
    const day = cairoDate(-3);
    const session = sqlAs(SARA_PROFILE, `select fn_add_session('${clientId}', '${COACH_IDS.sara}', ('${day} 22:00')::timestamp at time zone 'Africa/Cairo');`);
    await loginStaff(page, STAFF.sara);
    await page.goto(`/coach?date=${day}`);
    const r = row(page, name);
    await r.getByRole("button", { name: "Completed" }).click();
    await expect(page.getByRole("status").filter({ hasText: "went to the head coach" })).toBeVisible();
    await expect(r.getByText("Waiting for head coach")).toBeVisible();
    expect(sql(`select status from sessions where id = '${session}'`)).toBe("booked");

    const ahmed = await browser.newPage();
    await loginStaff(ahmed, STAFF.headCoach);
    await ahmed.goto("/coach/team");
    const edit = ahmed.getByTestId("pending-edit").filter({ hasText: name });
    await edit.getByRole("button", { name: "Approve" }).click();
    await expect(ahmed.getByRole("status").filter({ hasText: `Approved: ${name}` })).toBeVisible();
    await ahmed.close();
    expect(sql(`select status || ',' || credit_consumed from sessions where id = '${session}'`)).toBe("completed,true");
    expect(sql(`select sum(qty_remaining) from credit_lots where client_id = '${clientId}' and status = 'active'`)).toBe("7");
  });

  test("Ahmed reassigns the client to Mahmoud with a reason: sessions move, Sara's slots close, both coaches are told", async ({ page }) => {
    await loginStaff(page, STAFF.headCoach);
    await page.goto("/coach/team");
    const select = page.getByLabel("Client", { exact: true });
    await select.selectOption({ label: `${name} — Sara Fathy, 7 left` });
    await page.getByTestId("reassign-suggestions").getByRole("radio", { name: /Mahmoud Gamal/ }).click();
    await page.getByLabel("Reason (required)").fill("Client moved to evenings");
    await page.getByRole("button", { name: "Reassign", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: `${name} now trains with Mahmoud Gamal` })).toBeVisible();

    expect(sql(`select string_agg(distinct coach_membership_id::text, ',') from credit_lots where client_id = '${clientId}' and status = 'active'`)).toBe(COACH_IDS.mahmoud);
    expect(sql(`select count(*) from schedule_slots where client_id = '${clientId}' and coach_membership_id = '${COACH_IDS.sara}' and is_active`)).toBe("0");
    expect(sql(`select count(*) from notifications where recipient_profile_id = '${SARA_PROFILE}' and type = 'client.reassigned' and data->>'client_id' = '${clientId}'`)).toBe("1");
    expect(sql(`select count(*) from notifications where recipient_profile_id = '00000000-0000-0000-0000-000000000022' and type = 'coach.assigned' and data->>'client_id' = '${clientId}'`)).toBe("1");
  });
});

test("program builder: 2 days × 4 exercises from a template in under 2 minutes, survives a refresh, activate; the client is told and sees it", async ({ page, browser }, info) => {
  const started = Date.now();
  const programName = `Aya block ${info.project.name}`;
  await loginStaff(page, STAFF.sara);
  await page.goto(`/coach/clients/${AYA.id}?tab=program`);
  await page.getByRole("link", { name: /Build a program|New program|Continue the draft/ }).click();
  await page.getByLabel("Program name").fill(programName);
  await page.getByRole("radio", { name: /Full body — 2 days/ }).click();
  await page.getByRole("button", { name: "Create the draft" }).click();
  await page.waitForURL(/program=[0-9a-f-]{36}/);
  await expect(page.getByTestId("program-exercise")).toHaveCount(4);
  await page.getByRole("tab", { name: "Day B — Full body" }).click();
  await expect(page).toHaveURL(/day=2/);
  await expect(page.getByTestId("program-exercise")).toHaveCount(4);

  // an edit, then a refresh: the route and the saved draft bring it back
  await page.getByRole("spinbutton", { name: "Sets" }).first().fill("5");
  await expect(page.getByTestId("save-state")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByRole("tab", { name: "Day B — Full body" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("spinbutton", { name: "Sets" }).first()).toHaveValue("5");

  await page.getByRole("button", { name: "Activate" }).click();
  await expect(page.getByTestId("program-status")).toHaveText("Active");
  expect(Date.now() - started).toBeLessThan(120_000);

  const client = await browser.newPage();
  await loginClient(client, AYA.phone);
  await client.goto("/c");
  await expect(client.getByTestId("my-program")).toContainText(programName);
  await expect(client.getByTestId("my-program")).toContainText("Day A — Full body");
  await client.goto("/notifications");
  await expect(client.getByText("Your new program is ready").first()).toBeVisible();
  await client.close();
});

test.describe("kiosk", () => {
  async function checkIn(page: Page, phone: string) {
    await page.goto("/checkin");
    await page.getByLabel("Your phone number").fill(phone);
    await page.getByRole("button", { name: "Check in" }).click();
    return page.getByTestId("kiosk-result");
  }

  test("Farida checks in at either branch; Adel only at branch A; a lapsed client is refused and Notify sales flags her rep", async ({ page, browser }) => {
    await loginStaff(page, STAFF.desk);
    const farida = await checkIn(page, "01110000008");
    await expect(farida).toHaveAttribute("data-ok", "true");
    await expect(farida).toContainText("Farida");
    await expect(await checkIn(page, "01110000041")).toHaveAttribute("data-ok", "true");

    const heba = await checkIn(page, "01110000014");
    await expect(heba).toHaveAttribute("data-ok", "false");
    await expect(heba).toContainText("No active membership");
    await heba.getByRole("button", { name: "Notify sales" }).click();
    await expect(heba).toContainText("Mona has been told");
    expect(Number(sql(`select count(*) from follow_ups where client_id = '00000000-0000-0000-0002-000000000014' and status = 'open' and title like 'FLAG:%'`))).toBeGreaterThan(0);

    const deskB = await browser.newPage();
    await loginStaff(deskB, STAFF.deskB);
    await expect(await checkIn(deskB, "01110000008")).toHaveAttribute("data-ok", "true");
    const adel = await checkIn(deskB, "01110000041");
    await expect(adel).toHaveAttribute("data-ok", "false");
    await expect(adel).toContainText("PT sessions can be used at Branch A");
    await deskB.close();
  });
});
