import { expect, test } from "@playwright/test";
import { loginStaff, sql, STAFF } from "./helpers";

test.afterEach(() => {
  sql("update settings set value = '24' where key = 'attendance.edit_window_hours'");
});

test("a settings edit persists and fn_setting_int reflects it", async ({ page }) => {
  await loginStaff(page, STAFF.ceo);
  await page.goto("/admin/settings");
  const row = page.getByTestId("setting-attendance.edit_window_hours");
  await row.getByRole("spinbutton").fill("48");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row.getByText("Saved")).toBeVisible();
  expect(sql("select fn_setting_int('attendance.edit_window_hours', 24)")).toBe("48");
  await page.reload();
  await expect(page.getByTestId("setting-attendance.edit_window_hours").getByRole("spinbutton")).toHaveValue("48");
});

test("commission tiers are edited as a table and bad tiers are refused before saving", async ({ page }) => {
  await loginStaff(page, STAFF.ceo);
  await page.goto("/admin/settings");
  const row = page.getByTestId("setting-commission.pt_tiers");
  await expect(row.getByLabel("Tier 1: up to sessions")).toHaveValue("160");
  await row.getByLabel("Tier 2: up to sessions").fill("100");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row.getByText(/larger than the tier above/)).toBeVisible();
  await row.getByRole("button", { name: "Cancel" }).click();
  await expect(row.getByLabel("Tier 2: up to sessions")).toHaveValue("200");
});
