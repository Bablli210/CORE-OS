import { expect, test, type Page } from "@playwright/test";
import { expectContext, latestEmailHtml, loginStaff as login, sql, STAFF } from "./helpers";

// M7 acceptance (docs/05): a session booked for tomorrow gets its −24h reminder within the hour and it is delivered
// (sandbox); "time to renew" once a week, not once an hour; freeze request → approve → frozen → auto-end → expiry
// extended; the nightly job at 03:30 Cairo with its job.nightly counts. Plus the refund / transfer / digest flows.
// Delivery runs the real path: fn_invoke_notify → pg_net → notify (sandbox provider) → signed whatsapp-webhook.

const HASSAN = "00000000-0000-0000-0002-000000000001";
const MAHMOUD_M = "a0000000-0000-0000-0000-000000000022";
const BRANCH_A = "b0000000-0000-0000-0000-00000000000a";
const RANA = sql("select id from clients where phone = '+201110000010'");
const KHALED = sql("select id from clients where phone = '+201110000005'");
const YASMIN = sql("select id from clients where phone = '+201110000012'");

async function loginStaff(page: Page, email: string) {
  await page.context().clearCookies();
  await login(page, email);
}

/** The sales manager works both branches; these clients are Branch A's. */
async function managerQueueA(page: Page) {
  await loginStaff(page, STAFF.salesManager);
  await page.goto("/sales/queue");
  await page.getByRole("combobox", { name: "Switch role or branch" }).selectOption({ label: "Sales manager · Branch A — New Cairo" });
  await expectContext(page, "Sales manager · Branch A — New Cairo");
  await page.goto("/sales/queue");
}

/** Runs the notify function the way pg_cron does (again while earlier rows are still queued) until the delivery reaches a state. */
async function deliver(notificationId: string, state = "delivered") {
  await expect.poll(() => {
    const now = sql(`select coalesce((select state from notification_deliveries where notification_id = '${notificationId}'), 'none')`);
    if (now === "none") sql("select fn_invoke_notify()");
    return now;
  }, { timeout: 45_000, intervals: [1_000, 2_000] }).toBe(state);
}

test.describe.configure({ mode: "serial" });

test.describe("reminders and renewals", () => {
  let session = "";
  test.afterAll(() => {
    if (session) sql(`delete from notifications where data->>'session_id' = '${session}'; delete from sessions where id = '${session}'`);
  });

  test("a session booked for tomorrow gets one −24h reminder within the hour, delivered to the sandbox number", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1280", "one delivery run is enough; the admin screen is checked on desktop");
    session = sql(`with s as (insert into sessions(client_id, coach_membership_id, branch_id, scheduled_at, status)
                   values ('${HASSAN}', '${MAHMOUD_M}', '${BRANCH_A}', date_trunc('minute', now() + interval '24 hours'), 'booked') returning id) select id from s`);
    sql("select fn_hourly_notifications()"); // the hourly job (pg_cron, :05 past each hour)
    sql("select fn_hourly_notifications()");
    const ids = sql(`select string_agg(id::text, ',') from notifications where type = 'session.reminder_24h' and data->>'session_id' = '${session}'`).split(",");
    expect(ids).toHaveLength(1);
    await deliver(ids[0]);
    expect(sql(`select provider || ' ' || to_address from notification_deliveries where notification_id = '${ids[0]}'`)).toBe("sandbox +201110000001");

    // top management sees it in the audit explorer's deliveries
    await loginStaff(page, STAFF.ceo);
    await page.goto(`/admin/audit?source=deliveries&search=${encodeURIComponent("session.reminder_24h")}`);
    const row = page.getByTestId("audit-row").filter({ hasText: "Hassan" }).first();
    await expect(row).toContainText("delivered");
    await row.locator("summary").click();
    await expect(row.getByTestId("audit-diff")).toContainText("+201110000001");
  });

  test("a client with 2 credits gets one \"time to renew\" message per week, not one per hour", async ({}, info) => {
    test.skip(info.project.name !== "desktop-1280", "database behaviour; once is enough");
    expect(Number(sql(`select fn_credit_balance('${HASSAN}')`))).toBe(2);
    for (let i = 0; i < 3; i++) sql("select fn_hourly_notifications()");
    expect(sql(`select count(*) from notifications where type = 'credits.low' and channel = 'whatsapp' and data->>'client_id' = '${HASSAN}' and created_at > now() - interval '7 days'`)).toBe("1");
  });
});

test.describe("freeze", () => {
  test("request → approve → frozen → auto-end at the date → expiry extended by the frozen days; nightly at 03:30 Cairo shows its counts", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1280", "one freeze per client per run (freeze.max_count)");
    sql(`update freezes set status = 'rejected' where client_id = '${RANA}' and status in ('pending', 'active')`);
    sql(`delete from freezes where client_id = '${RANA}'`);

    // the rep asks on Rana's behalf
    await loginStaff(page, STAFF.rep);
    await page.goto(`/sales/clients/${RANA}`);
    const card = page.getByTestId("freeze-card");
    await card.getByRole("button", { name: "Request freeze" }).click();
    await page.getByLabel("Days (max 30)").fill("7");
    await page.getByLabel("Reason (required)").fill("Travelling for work");
    await page.getByRole("button", { name: "Send for approval" }).click();
    await expect(page.getByText("Freeze sent to the sales manager for approval.")).toBeVisible();
    await expect(card.getByTestId("freeze-row").first()).toHaveAttribute("data-status", "pending");

    // the sales manager approves in the queue
    await managerQueueA(page);
    const item = page.getByTestId("approval-item").filter({ hasText: "Rana" }).filter({ hasText: "Freeze" });
    await item.getByRole("button", { name: "Approve" }).click();
    await expect(item).toHaveCount(0);
    expect(sql(`select status from clients where id = '${RANA}'`)).toBe("frozen");
    await page.goto(`/sales/clients/${RANA}`);
    await expect(page.getByTestId("freeze-row").first()).toHaveAttribute("data-status", "active");

    // time passes: the freeze's last day is behind us; the nightly job runs at 03:30 Cairo
    const before = sql(`select string_agg(id::text || '=' || extract(epoch from expires_at)::bigint, ',' order by id) from credit_lots where client_id = '${RANA}' and status = 'active'`);
    sql(`update freezes set starts_at = now() - interval '7 days 1 minute', ends_at = now() - interval '1 minute' where client_id = '${RANA}' and status = 'active'`);
    sql(`delete from events where type = 'job.nightly' and payload->>'cairo_date' = cairo_date(now())::text`);
    expect(sql("select fn_nightly_if_due((cairo_date(now())::text || ' 02:30')::timestamp at time zone 'Africa/Cairo') is null")).toBe("t");
    const nightly = JSON.parse(sql("select fn_nightly_if_due((cairo_date(now())::text || ' 03:30')::timestamp at time zone 'Africa/Cairo')"));
    expect(nightly.freezes_ended).toBeGreaterThanOrEqual(1);

    expect(sql(`select status from clients where id = '${RANA}'`)).toBe("active");
    const after = sql(`select string_agg(id::text || '=' || extract(epoch from expires_at)::bigint, ',' order by id) from credit_lots where client_id = '${RANA}' and status = 'active'`);
    const days = (a: string, b: string) => a.split(",").map((x, i) => (Number(x.split("=")[1]) - Number(b.split(",")[i].split("=")[1])) / 86400);
    expect(days(after, before).every((d) => d === 7)).toBe(true);
    await page.reload();
    await expect(page.getByTestId("freeze-row").first()).toHaveAttribute("data-status", "ended");

    // Rana is told on WhatsApp (sandbox), and the job's counts are in the audit explorer
    const told = sql(`select id from notifications where type = 'freeze.ended' and client_id = '${RANA}' order by created_at desc limit 1`);
    await deliver(told);
    await loginStaff(page, STAFF.ceo);
    await page.goto("/admin/audit?source=events&table=job");
    const job = page.getByTestId("audit-row").filter({ hasText: "job.nightly" }).first();
    await job.locator("summary").click();
    await expect(job.getByTestId("audit-diff")).toContainText("freezes_ended");
  });
});

test.describe("refunds and transfers", () => {
  test("a refund asked in /admin/money is decided in /sales/queue and voids the payment", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1280", "a payment can be refunded once");
    const [pay, month, amount] = sql(`select x.id || '|' || to_char(x.received_at at time zone 'Africa/Cairo', 'YYYY-MM') || '|' || x.amount_piastres from payments x join deals d on d.id = x.deal_id
                                      join clients c on c.id = d.client_id where c.phone = '+201110000006' and x.voided_at is null order by x.received_at desc limit 1`).split("|");
    await loginStaff(page, STAFF.ceo);
    await page.goto("/admin/money?tab=payments");
    await page.getByLabel("Month").selectOption(month);
    await page.getByLabel("Branch").selectOption(BRANCH_A);
    const row = page.getByTestId("money-payment").filter({ hasText: "Salma Rashad" }).first();
    await row.getByRole("button", { name: "Refund" }).click();
    await page.getByLabel("Reason (required)").fill("Moved abroad");
    await page.getByRole("button", { name: "Send for approval" }).click();
    await expect(page.getByText("Refund sent to the sales manager for approval.")).toBeVisible();
    await expect(page.getByTestId("money-request").filter({ hasText: "Salma" }).first()).toHaveAttribute("data-status", "pending");

    await managerQueueA(page);
    const item = page.getByTestId("approval-item").filter({ hasText: "Refund" }).filter({ hasText: "Salma" });
    await expect(item).toContainText(`EGP ${(Number(amount) / 100).toLocaleString("en-US")}`);
    await item.getByRole("button", { name: "Approve" }).click();
    await expect(item).toHaveCount(0);
    expect(sql(`select voided_at is not null from payments where id = '${pay}'`)).toBe("t");

    await loginStaff(page, STAFF.ceo);
    await page.goto("/admin/money?tab=payments");
    await page.getByLabel("Month").selectOption(month);
    await expect(page.getByTestId("money-request").filter({ hasText: "Salma" }).first()).toHaveAttribute("data-status", "approved");
  });

  test("a rep asks to transfer a pack by the other client's phone; approved, the sessions move", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1280", "a pack moves once");
    const lot = sql(`select id from credit_lots where client_id = '${KHALED}' and status = 'active' and qty_remaining > 0 order by expires_at limit 1`);
    const qty = sql(`select qty_remaining from credit_lots where id = '${lot}'`);
    await loginStaff(page, STAFF.rep);
    await page.goto(`/sales/clients/${KHALED}`);
    await page.getByTestId("lot-row").filter({ hasText: `${qty} of ` }).first().getByRole("button", { name: "Transfer" }).click();
    await page.getByRole("textbox", { name: "To the client with this phone" }).fill("01110000012");
    await page.getByRole("button", { name: "Find" }).click();
    await expect(page.getByTestId("transfer-target")).toContainText("Yasmin Fouad");
    await page.getByLabel("Reason (required)").fill("Gift to her sister");
    await page.getByRole("button", { name: "Send for approval" }).click();
    await expect(page.getByText("Transfer sent to the sales manager for approval.")).toBeVisible();

    await managerQueueA(page);
    const item = page.getByTestId("approval-item").filter({ hasText: "Credit transfer" }).filter({ hasText: "Yasmin" });
    await expect(item).toContainText(`${qty} sessions`);
    await item.getByRole("button", { name: "Approve" }).click();
    await expect(item).toHaveCount(0);
    expect(sql(`select client_id from credit_lots where id = '${lot}'`)).toBe(YASMIN);
  });
});

test("the daily digest is emailed to the sales manager at 20:00 Cairo, with the numbers they may see", async ({}, info) => {
  test.skip(info.project.name !== "desktop-1280", "one digest per day per person");
  sql(`delete from notifications where type = 'digest.daily' and data->>'period' = cairo_date(now())::text`);
  sql("select fn_queue_digests((cairo_date(now())::text || ' 20:10')::timestamp at time zone 'Africa/Cairo')");
  const id = sql(`select id from notifications where type = 'digest.daily' and recipient_profile_id = '00000000-0000-0000-0000-000000000010' and data->>'branch_id' = '${BRANCH_A}' order by created_at desc limit 1`);
  await deliver(id, "sent");
  const html = await latestEmailHtml("sales.manager@gymos.local");
  expect(html).toContain("Daily digest");
  expect(html).toContain("Reps this month");
});

test("the new freeze, transfer and refund controls fit a 390px phone", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile-390", "the layout check is for the phone");
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await loginStaff(page, STAFF.rep);
  await page.goto(`/sales/clients/${RANA}`);
  await expect(page.getByTestId("freeze-card")).toBeVisible();
  await page.getByTestId("lot-row").getByRole("button", { name: "Transfer" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await noOverflow()).toBeLessThanOrEqual(0);
  await loginStaff(page, STAFF.ceo);
  await page.goto("/admin/money");
  await page.getByTestId("page-tab-payments").click();
  await expect(page.getByTestId("money-requests")).toBeVisible();
  await page.getByTestId("money-payment").getByRole("button", { name: "Refund" }).first().click();
  await expect(page.getByRole("dialog", { name: "Request a refund" })).toBeVisible();
  expect(await noOverflow()).toBeLessThanOrEqual(0);
});
