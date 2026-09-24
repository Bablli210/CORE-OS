import { expect, test } from "@playwright/test";
import { createLeadInUi, loginStaff, sql, STAFF, toE164, uniqueLocalPhone } from "./helpers";

test("onboarding link: no login, survives a refresh mid-way, completes; Mona is notified and sees a readable summary", async ({ page, browser }) => {
  const name = `Wizard Lead ${Date.now()}`;
  const phone = uniqueLocalPhone();
  await loginStaff(page, STAFF.rep);
  await createLeadInUi(page, name, phone);
  await page.getByRole("button", { name: "Send onboarding link" }).click();
  const url = await page.getByTestId("share-fill").getAttribute("href");
  expect(url).toContain("/onboard/");
  expect(await page.getByTestId("share-whatsapp").getAttribute("href")).toContain(`https://wa.me/${toE164(phone).slice(1)}?text=`);
  const leadId = sql(`select id from leads where phone = '${toE164(phone)}'`);

  // the lead's phone: no session, 360px wide
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const lead = await ctx.newPage();
  await lead.goto(url!);
  await expect(lead.getByTestId("wizard-progress")).toHaveText("Step 1 of 7");
  await expect(lead.getByLabel("Your full name")).toHaveValue(name);
  await lead.getByRole("radio", { name: "Female" }).click();
  await lead.getByRole("button", { name: "Continue" }).click();
  await lead.getByRole("radio", { name: "Fat loss" }).click();
  await lead.getByRole("button", { name: "Continue" }).click();
  await lead.getByRole("radiogroup", { name: "Membership" }).getByRole("radio", { name: "Monthly" }).click();
  await lead.getByRole("radiogroup", { name: "Personal training?" }).getByRole("radio", { name: "Yes" }).click();
  await lead.getByRole("radiogroup", { name: "Nutrition plan?" }).getByRole("radio", { name: "No" }).click();
  await lead.getByRole("button", { name: "Continue" }).click();
  await expect(lead.getByRole("heading", { name: "Personal training" })).toBeVisible();

  // refresh mid-way: progress kept
  await lead.reload();
  await expect(lead.getByTestId("wizard-progress")).toHaveText("Step 4 of 7");
  await lead.getByRole("button", { name: "Back" }).click();
  await expect(lead.getByRole("radiogroup", { name: "Membership" }).getByRole("radio", { name: "Monthly" })).toHaveAttribute("aria-checked", "true");
  await lead.getByRole("button", { name: "Continue" }).click();

  await lead.getByRole("radio", { name: "Morning" }).click();
  await lead.getByRole("checkbox", { name: "Sat" }).click();
  await lead.getByRole("checkbox", { name: "Mon" }).click();
  await lead.getByRole("radiogroup", { name: "Trainer preference" }).getByRole("radio", { name: "Female" }).click();
  await lead.getByRole("radio", { name: "3" }).click();
  await lead.getByRole("button", { name: "Continue" }).click();

  await lead.getByRole("button", { name: "Continue" }).click(); // nothing answered: required answers are flagged
  await expect(lead.getByText("Please answer this one.").first()).toBeVisible();
  await lead.getByRole("checkbox", { name: "Knee" }).click();
  await lead.getByRole("radiogroup", { name: "Has a doctor cleared you for exercise?" }).getByRole("radio", { name: "Yes" }).click();
  const parq = lead.getByRole("group", { name: "Health questions" }).getByRole("radiogroup");
  await expect(parq).toHaveCount(7);
  for (const group of await parq.all()) await group.getByRole("radio", { name: "No" }).click();
  await lead.getByRole("checkbox", { name: /My answers are true/ }).check();
  await lead.getByRole("button", { name: "Continue" }).click();

  await lead.getByRole("radio", { name: "Beginner" }).click();
  await lead.getByRole("button", { name: "Continue" }).click();
  await lead.getByRole("radiogroup", { name: "OK to appear in our photos and videos?" }).getByRole("radio", { name: "No" }).click();
  await lead.getByRole("radiogroup", { name: "OK to receive offers and news?" }).getByRole("radio", { name: "Yes" }).click();
  expect(await lead.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await lead.getByRole("button", { name: "Finish" }).click();
  await expect(lead.getByRole("heading", { name: "Thank you!" })).toBeVisible();
  await expect(lead.getByText(/Your advisor Mona will call you/)).toBeVisible();
  await ctx.close();

  // Mona: notified, lead onboarded, answers readable
  expect(sql(`select count(*) from notifications where type = 'lead.onboarded' and data->>'lead_id' = '${leadId}'`)).toBe("1");
  await page.goto(`/sales/leads/${leadId}`);
  await expect(page.getByTestId("lead-stage")).toContainText("Onboarded");
  const summary = page.getByTestId("onboarding-summary");
  await expect(summary).toContainText("Fat loss");
  await expect(summary).toContainText("Morning");
  await expect(summary).toContainText("Sat, Mon");
});
