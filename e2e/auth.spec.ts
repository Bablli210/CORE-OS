import { expect, test } from "@playwright/test";
import { expectContext, loginClient, loginStaff, openNav, STAFF } from "./helpers";

test.describe("M1 login and role routing", () => {
  const homes: [string, string, RegExp][] = [
    [STAFF.ceo, "/admin", /Top management · All branches/],
    [STAFF.salesManager, "/sales", /Sales manager · Branch/],
    [STAFF.rep, "/sales", /Sales rep · Branch A/],
    [STAFF.headCoach, "/coach", /Head coach · Branch A/],
    [STAFF.coach, "/coach", /Coach · Branch A/],
    [STAFF.desk, "/sales", /Front desk · Branch A/],
  ];
  for (const [email, home, context] of homes) {
    test(`${email} lands on ${home}`, async ({ page }) => {
      await loginStaff(page, email);
      await expect(page).toHaveURL(home);
      await expectContext(page, context);
    });
  }

  test("Karim switches between branch A and B, and the choice is remembered", async ({ page }) => {
    await loginStaff(page, STAFF.salesManager);
    const switcher = page.getByRole("combobox", { name: "Switch role or branch" });
    await switcher.selectOption({ label: "Sales manager · Branch B — Sheikh Zayed" });
    await expectContext(page, "Sales manager · Branch B — Sheikh Zayed");
    await page.reload();
    await expectContext(page, "Sales manager · Branch B — Sheikh Zayed");
    await switcher.selectOption({ label: "Sales manager · Branch A — New Cairo" });
    await expectContext(page, "Sales manager · Branch A — New Cairo");
    await openNav(page, "Queue");
    await expect(page.getByRole("heading", { name: "Queue", exact: true })).toBeVisible();
  });

  test("Ahmed sees the coach tabs and Team; as plain coach Team disappears and a direct link switches him back", async ({ page }) => {
    await loginStaff(page, STAFF.headCoach);
    const nav = page.getByRole("navigation", { name: "Main navigation" }).filter({ visible: true });
    for (const tab of ["Today", "Clients", "Programs", "Numbers", "Team"]) await expect(nav.getByRole("link", { name: tab, exact: true })).toBeVisible();
    await nav.getByRole("link", { name: "Team", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();
    await page.getByRole("combobox", { name: "Switch role or branch" }).selectOption({ label: "Coach · Branch A — New Cairo" });
    await expectContext(page, "Coach · Branch A — New Cairo");
    await expect(nav.getByRole("link", { name: "Team", exact: true })).toHaveCount(0);
    await page.goto("/coach/team");
    await expectContext(page, "Head coach · Branch A — New Cairo");
  });

  test("Hassan logs in with phone OTP and sees his name and sessions left", async ({ page }) => {
    await loginClient(page, "01110000001");
    await expect(page).toHaveURL("/c");
    await expect(page.getByRole("heading", { name: "Hi Hassan" })).toBeVisible();
    await expect(page.getByTestId("credit-balances")).toContainText(/\d+ sessions with Mahmoud Gamal/);
  });

  test("an unknown phone gets a clear error", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Phone number" }).fill("01099999999");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "No member account uses this number" })).toBeVisible();
  });

  test("a wrong password gets a clear error", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("tab", { name: "Staff" }).click();
    await page.getByLabel("Email").fill(STAFF.rep);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Email or password is wrong" })).toBeVisible();
  });

  test("private pages need a session; other roles' areas redirect home", async ({ page }) => {
    await page.goto("/admin/people");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fpeople/);
    await loginStaff(page, STAFF.rep);
    await page.goto("/admin/people");
    await expect(page).toHaveURL("/sales");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/login");
  });
});
