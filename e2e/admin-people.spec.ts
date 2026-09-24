import { expect, test } from "@playwright/test";
import { expectContext, latestEmailHtml, loginStaff, openNav, STAFF } from "./helpers";

async function invite(page: import("@playwright/test").Page, name: string, email: string, role: string, branch: string, phone?: string) {
  await page.getByRole("button", { name: "Invite staff" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Invite staff" });
  await dialog.getByLabel("Full name").fill(name);
  await dialog.getByLabel("Email").fill(email);
  if (phone) {
    await dialog.getByRole("textbox", { name: "Phone (optional)" }).fill(phone);
    await expect(dialog.getByText(/Saved as \+20/)).toBeVisible();
  }
  await dialog.getByLabel("Role").selectOption({ label: role });
  await dialog.getByLabel("Branch").selectOption({ label: branch });
  await dialog.getByRole("button", { name: "Send invite" }).click();
  await expect(dialog).toBeHidden();
}

test("top management creates a branch-B sales rep who can then log in", async ({ page, browser }, info) => {
  const email = `rep.${info.project.name}.${Date.now()}@gymos.local`;
  const localPhone = `010${String(Date.now()).slice(-8)}`;
  await loginStaff(page, STAFF.ceo);
  await openNav(page, "People");
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  await invite(page, "Nour Branch B", email, "Sales rep", "Branch B — Sheikh Zayed", localPhone);
  await page.getByRole("searchbox").fill(email);
  await expect(page.getByText("Nour Branch B").filter({ visible: true })).toBeVisible();

  // the invitee follows the email link, sets a password and lands on the sales home in branch B
  const html = await latestEmailHtml(email);
  const link = html.match(/href="([^"]*\/auth\/confirm[^"]*)"/)?.[1]?.replace(/&amp;/g, "&");
  expect(link).toBeTruthy();
  const invitee = await browser.newPage();
  await invitee.goto(link!);
  await expect(invitee.getByRole("heading", { name: "Welcome, Nour" })).toBeVisible();
  await invitee.getByLabel("New password").fill("new-rep-pass");
  await invitee.getByLabel("Repeat password").fill("new-rep-pass");
  await invitee.getByRole("button", { name: "Save and continue" }).click();
  await expect(invitee).toHaveURL("/sales");
  await expectContext(invitee, "Sales rep · Branch B — Sheikh Zayed");

  // and can log in again with that password
  await invitee.getByRole("button", { name: "Sign out" }).click();
  await loginStaff(invitee, email, "new-rep-pass");
  await expect(invitee).toHaveURL("/sales");
  await invitee.close();
});

test("a head coach role shows the automatically added coach role; deactivation removes access", async ({ page }, info) => {
  const email = `hc.${info.project.name}.${Date.now()}@gymos.local`;
  await loginStaff(page, STAFF.ceo);
  await page.goto("/admin/people");
  await invite(page, "Omar Head", email, "Head coach", "Branch B — Sheikh Zayed");
  await page.getByRole("searchbox").fill(email);
  await page.getByRole("button", { name: "Omar Head" }).filter({ visible: true }).first().click();
  const sheet = page.getByRole("dialog", { name: "Omar Head" });
  await expect(sheet.getByTestId("membership-row")).toHaveCount(2);
  await expect(sheet.getByText("Added with head coach")).toBeVisible();

  await sheet.getByRole("button", { name: "Deactivate" }).click();
  await sheet.getByRole("button", { name: "Deactivate" }).click();
  await expect(sheet.getByText("Inactive").first()).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Reactivate" })).toBeVisible();
});
