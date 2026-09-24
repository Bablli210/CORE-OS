import { expect, test } from "@playwright/test";

// Scaffold smoke test; M1 replaces it with one login test per role on seed data.
test("home page renders the app name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "GymOS" })).toBeVisible();
});
