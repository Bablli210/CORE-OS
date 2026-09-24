import { expect, test } from "@playwright/test";
import { loginStaff, PROFILE_IDS, sql, STAFF } from "./helpers";

test("the bell updates live when a notification is inserted, and reading clears it", async ({ page }) => {
  sql(`update notifications set read_at = now() where recipient_profile_id = '${PROFILE_IDS.rep}' and read_at is null`);
  await loginStaff(page, STAFF.rep);
  await expect(page.getByTestId("notification-count")).toHaveCount(0);
  await page.waitForTimeout(1500); // let the Realtime channel join

  const title = `E2E ping ${Date.now()}`;
  sql(`insert into notifications(recipient_profile_id, type, title, body, data) values ('${PROFILE_IDS.rep}', 'test.ping', '${title}', 'inserted via SQL', '{}')`);
  await expect(page.getByTestId("notification-count")).toHaveText("1", { timeout: 10_000 });

  await page.getByTestId("notification-bell").click();
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await page.getByTestId("notification-item").filter({ hasText: title }).click();
  await expect(page.getByTestId("notification-count")).toHaveCount(0);
});
