import { expect, test, type Page } from "@playwright/test";
import { egp, freeTestPhone, loginClient, loginStaff, sql, STAFF } from "./helpers";

async function addProduct(page: Page, label: RegExp) {
  const select = page.getByRole("combobox", { name: "Add a product" });
  const value = await select.locator("option", { hasText: label }).first().getAttribute("value");
  await select.selectOption(value!);
  await page.getByRole("button", { name: "Add", exact: true }).click();
}

async function approveInQueue(page: Page, text: string) {
  await page.goto("/sales/queue");
  const item = page.getByTestId("approval-item").filter({ hasText: text });
  await item.getByRole("button", { name: "Approve" }).click();
  await expect(item).toHaveCount(0);
}

async function recordPayment(page: Page, egpAmount: string) {
  await page.getByRole("button", { name: "Record payment" }).click();
  const sheet = page.getByRole("dialog", { name: "Record payment" });
  await sheet.getByLabel("Amount (EGP)").fill(egpAmount);
  await sheet.getByRole("button", { name: "Record payment" }).click();
  return sheet;
}

test.describe.serial("M3: quote → approval → payment → client with credits", () => {
  let dealUrl = "";
  let phone = { local: "", e164: "" };
  let name = "";

  test("a PT pack needs a coach; Sara is suggested first for a female morning lead; a 20% discount goes to approval", async ({ page }, info) => {
    phone = freeTestPhone();
    name = `Money Lead ${info.project.name} ${Date.now() % 100000}`;
    const lead = sql(`insert into leads(branch_id, full_name, phone, owner_membership_id, status, onboarding_responses, first_contact_due_at)
      values ('b0000000-0000-0000-0000-00000000000a', '${name}', '${phone.e164}', 'a0000000-0000-0000-0000-000000000011', 'onboarded',
      '{"pt_prefs":{"time":"morning","trainer_gender":"female","days":["sat","mon","wed"]},"health":{"conditions":["back"]}}', now()) returning id`).split("\n")[0];
    await loginStaff(page, STAFF.rep);
    await page.goto(`/sales/leads/${lead}`);
    await page.getByRole("link", { name: "Create quote" }).click();
    await page.waitForURL(/\/sales\/deals\/[0-9a-f-]{36}$/);
    dealUrl = new URL(page.url()).pathname;

    await addProduct(page, /PT pack — 12 sessions/);
    await expect(page.getByTestId("coach-suggestions").getByRole("radio").first()).toContainText("Sara Fathy");
    await expect(page.getByTestId("deal-summary")).toContainText("Pick the coach");
    await expect(page.getByRole("button", { name: /^Submit/ })).toBeDisabled();

    await page.getByTestId("coach-suggestions").getByRole("radio", { name: /Sara Fathy/ }).click();
    await addProduct(page, /Membership — 1 month/);
    await page.getByLabel("Discount %").fill("20");
    await expect(page.getByTestId("deal-total")).toHaveText(egp(552000));
    await expect(page.getByTestId("approval-indicator")).toContainText("above your 10% allowance");
    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expect(page.getByTestId("deal-status")).toHaveText("Waiting for approval");
  });

  test("Karim approves; Mona records 50% cash → partially paid, client created, 6 of 12 credits with Sara", async ({ page, browser }) => {
    const karim = await browser.newPage();
    await loginStaff(karim, STAFF.salesManager);
    await approveInQueue(karim, name);
    await karim.close();

    await loginStaff(page, STAFF.rep);
    await page.goto(dealUrl);
    await expect(page.getByTestId("deal-status")).toHaveText("Approved");
    await recordPayment(page, "2760");
    await expect(page.getByTestId("payment-banner")).toContainText("Client created — coach Sara Fathy notified");
    await expect(page.getByTestId("deal-status")).toHaveText("Partially paid");
    await expect(page.getByTestId("credits-released")).toContainText("6 of 12 sessions released");

    const client = sql(`select id from clients where phone = '${phone.e164}'`);
    expect(sql(`select fn_credit_balance('${client}', 'a0000000-0000-0000-0000-000000000023')`)).toBe("6");
    expect(sql(`select count(*) from follow_ups where client_id = '${client}' and assigned_to_membership_id = 'a0000000-0000-0000-0000-000000000023' and title like 'Welcome call%'`)).toBe("1");
    expect(sql(`select count(*) from notifications where recipient_profile_id = '00000000-0000-0000-0000-000000000020' and type = 'client.pt_purchased' and data->>'client_id' = '${client}' and title like '%→ Sara Fathy'`)).toBe("1");
  });

  test("more than the remaining amount is refused; full payment → the client logs in and sees 12 sessions with Sara and the membership end", async ({ page, browser }) => {
    await loginStaff(page, STAFF.rep);
    await page.goto(dealUrl);
    const sheet = await recordPayment(page, "5000");
    await expect(sheet.getByRole("alert")).toContainText("more than the remaining 2760 EGP");
    await sheet.getByLabel("Amount (EGP)").fill("2760");
    await sheet.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByTestId("deal-status")).toHaveText("Paid");
    await expect(page.getByTestId("credits-released")).toContainText("12 of 12");

    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const client = await ctx.newPage();
    await loginClient(client, phone.local);
    await expect(client).toHaveURL("/c");
    await expect(client.getByTestId("credit-balances")).toContainText("12 sessions with Sara Fathy");
    await expect(client.getByText(/Membership until/)).toBeVisible();
    await ctx.close();
  });

  test("voiding a payment needs approval and refunds the unused credits", async ({ page, browser }) => {
    await loginStaff(page, STAFF.rep);
    await page.goto(dealUrl);
    await page.getByTestId("payment-row").nth(1).getByRole("button", { name: "Void" }).click();
    const sheet = page.getByRole("dialog", { name: "Void this payment?" });
    await sheet.getByLabel("Reason (required)").fill("Card charged twice");
    await sheet.getByRole("button", { name: "Ask to void" }).click();
    await expect(page.getByTestId("payment-row").nth(1)).toContainText("Void waiting for approval");
    const client = sql(`select id from clients where phone = '${phone.e164}'`);
    expect(sql(`select fn_credit_balance('${client}')`)).toBe("12");

    const karim = await browser.newPage();
    await loginStaff(karim, STAFF.salesManager);
    await approveInQueue(karim, "Card charged twice");
    await karim.close();
    await page.reload();
    await expect(page.getByTestId("payment-row").nth(1)).toContainText("Voided");
    await expect(page.getByTestId("deal-status")).toHaveText("Partially paid");
    expect(sql(`select fn_credit_balance('${client}')`)).toBe("0");
    expect(sql(`select string_agg(distinct status::text, ',') from credit_lots where client_id = '${client}'`)).toBe("refunded");
  });
});

test("a list-price deal submits straight to approved", async ({ page }) => {
  const phone = freeTestPhone();
  const lead = sql(`insert into leads(branch_id, full_name, phone, owner_membership_id) values ('b0000000-0000-0000-0000-00000000000a', 'List Price ${Date.now() % 100000}', '${phone.e164}', 'a0000000-0000-0000-0000-000000000011') returning id`).split("\n")[0];
  await loginStaff(page, STAFF.rep);
  await page.goto(`/sales/deals/new?lead=${lead}`);
  await page.waitForURL(/\/sales\/deals\/[0-9a-f-]{36}$/);
  await addProduct(page, /Membership — 3 months/);
  await expect(page.getByTestId("approval-indicator")).toContainText("approved as soon as you submit");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByTestId("deal-status")).toHaveText("Approved");
});

test("expiry: Mona's extension becomes an approval; Karim extends at once and an expired pack comes back with its sessions", async ({ page, browser }, info) => {
  void info;
  const usable = `from clients c join credit_lots l on l.client_id = c.id where c.home_branch_id = 'b0000000-0000-0000-0000-00000000000a' and l.status = 'active' and l.qty_remaining > 0 and l.expires_at > now()
    and not exists (select 1 from approvals a where a.subject_id = l.id and a.status = 'pending')`;
  const monaClient = sql(`select c.id ${usable} and c.rep_membership_id = 'a0000000-0000-0000-0000-000000000011' order by c.id limit 1`);
  const expiredClient = sql(`select c.id ${usable} and c.id <> '${monaClient}' order by c.id desc limit 1`);
  const future = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);

  await loginStaff(page, STAFF.rep);
  await page.goto(`/sales/clients/${monaClient}`);
  await page.getByTestId("lot-row").filter({ hasText: "Active" }).filter({ has: page.getByRole("button", { name: "Extend" }) }).first().getByRole("button", { name: "Extend" }).click();
  let sheet = page.getByRole("dialog", { name: /Extend the pack/ });
  await sheet.getByLabel("New expiry date").fill(future);
  await sheet.getByLabel("Reason (required)").fill("Travelling for work");
  await sheet.getByRole("button", { name: "Ask the sales manager" }).click();
  await expect(page.getByText("Sent to the sales manager for approval.")).toBeVisible();
  await expect(page.getByTestId("lot-row").filter({ hasText: "Extension waiting for approval" }).first()).toBeVisible();

  sql(`update credit_lots set expires_at = now() - interval '1 day' where client_id = '${expiredClient}' and status = 'active' and qty_remaining > 0`);
  sql("select fn_expire_credits()");
  const lot = sql(`select id from credit_lots where client_id = '${expiredClient}' and status = 'expired' order by issued_at desc limit 1`);
  const lost = sql(`select -qty from credit_ledger where lot_id = '${lot}' and entry_type = 'expire' order by created_at desc limit 1`);

  const karim = await browser.newPage();
  await loginStaff(karim, STAFF.salesManager);
  await karim.goto(`/sales/clients/${expiredClient}`);
  await karim.getByTestId("lot-row").filter({ hasText: "Expired" }).first().getByRole("button", { name: "Extend" }).click();
  sheet = karim.getByRole("dialog", { name: /Extend the pack/ });
  await expect(sheet).toContainText(`brings back its ${lost} unused sessions`);
  await sheet.getByLabel("New expiry date").fill(future);
  await sheet.getByLabel("Reason (required)").fill("Medical note");
  await sheet.getByRole("button", { name: "Extend now" }).click();
  await expect(karim.getByText("Expiry extended.")).toBeVisible();
  expect(sql(`select status || ':' || qty_remaining from credit_lots where id = '${lot}'`)).toBe(`active:${lost}`);
  await karim.close();
});

test("admin money: liability equals remaining credits × value; per-session net = gross × 0.86", async ({ page }) => {
  sql("select fn_refresh_views(true)");
  const liability = Number(sql("select coalesce(sum(qty_remaining * per_session_value_piastres), 0) from credit_lots where status = 'active' and expires_at > now()"));
  await loginStaff(page, STAFF.ceo);
  await page.goto("/admin/money");
  await expect(page.getByTestId("liability-total")).toHaveText(egp(liability));
  const rows = page.getByTestId("coach-row");
  await expect(rows.first()).toBeVisible();
  let checked = 0;
  for (const row of await rows.all()) {
    const gross = await row.getAttribute("data-gross");
    const net = await row.getAttribute("data-net");
    if (!gross) continue;
    expect(Math.abs(Number(net) - Math.round(Number(gross) * 0.86))).toBeLessThanOrEqual(1);
    checked++;
  }
  expect(checked).toBeGreaterThan(0);
});

test("products editor: a branch price for a pack is saved and used in that branch's catalog", async ({ page }, info) => {
  const price = info.project.name.startsWith("mobile") ? "4100" : "4200";
  sql("delete from products where code = 'PT8' and branch_id is not null and not exists (select 1 from deal_items where product_id = products.id)");
  await loginStaff(page, STAFF.ceo);
  await page.goto("/admin/settings");
  await page.getByRole("tab", { name: "Products" }).click();
  await page.getByTestId("product-PT8-all").getByRole("button", { name: "Branch price" }).click();
  const sheet = page.getByRole("dialog", { name: "Add product" });
  await sheet.getByLabel("Branch").selectOption({ label: "Branch B — Sheikh Zayed" });
  await sheet.getByLabel("Price (EGP)").fill(price);
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("product-PT8-B")).toContainText(egp(Number(price) * 100));
  expect(sql("select price_piastres from products where code = 'PT8' and branch_id = 'b0000000-0000-0000-0000-00000000000b'")).toBe(String(Number(price) * 100));
});
