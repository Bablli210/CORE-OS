import { expect, test } from "@playwright/test";
import { createLeadInUi, insertLead, loginStaff, MEMBERSHIP_IDS, sql, STAFF, toE164, uniqueLocalPhone } from "./helpers";

test.describe("M2 sales", () => {
  test("Mona types a duplicate phone: she sees the existing record and no duplicate is created", async ({ page }) => {
    await loginStaff(page, STAFF.rep);
    await page.goto("/sales/leads/new");
    await page.getByLabel("Full name").fill("Noha Again");
    await page.getByRole("textbox", { name: "Phone number" }).fill("01200000001"); // Noha Sami, Mona's lead in the seed
    const notice = page.getByTestId("duplicate-notice");
    await expect(notice).toContainText("Noha Sami is already a lead");
    await expect(page.getByRole("button", { name: "Save lead" })).toBeDisabled();
    await notice.getByRole("link", { name: "Open the existing record" }).click();
    await expect(page.getByRole("heading", { name: "Noha Sami" })).toBeVisible();
    expect(sql("select count(*) from leads where phone = '+201200000001'")).toBe("1");
  });

  test("front desk leads reach Karim's queue; round robin alternates reps and skips a paused rep", async ({ page, browser }) => {
    const desk = await browser.newPage();
    await loginStaff(desk, STAFF.desk);
    const phones = [uniqueLocalPhone(), uniqueLocalPhone()];
    await createLeadInUi(desk, "RR One", phones[0]);
    await createLeadInUi(desk, "RR Two", phones[1]);

    await loginStaff(page, STAFF.salesManager);
    await page.goto("/sales/queue");
    const unassigned = page.getByTestId("queue-unassigned");
    await expect(unassigned.getByText("RR One")).toBeVisible();
    await expect(unassigned.getByText("RR Two")).toBeVisible();
    await unassigned.getByRole("button", { name: "Round robin all" }).click();
    await expect(unassigned.getByText("Nothing waiting.")).toBeVisible();
    const owners = phones.map((p) => sql(`select owner_membership_id from leads where phone = '${toE164(p)}'`));
    expect(new Set(owners)).toEqual(new Set([MEMBERSHIP_IDS.mona, MEMBERSHIP_IDS.youssef]));

    try {
      await page.goto("/sales/team");
      await page.getByRole("switch", { name: "Round robin for Youssef Tarek" }).click();
      await expect(page.getByTestId("team-rep").filter({ hasText: "Youssef Tarek" }).getByText("Paused")).toBeVisible();

      const third = uniqueLocalPhone();
      await createLeadInUi(desk, "RR Three", third);
      await page.goto("/sales/queue");
      await unassigned.getByRole("button", { name: "Round robin all" }).click();
      await expect(unassigned.getByText("Nothing waiting.")).toBeVisible();
      expect(sql(`select owner_membership_id from leads where phone = '${toE164(third)}'`)).toBe(MEMBERSHIP_IDS.mona);
    } finally {
      sql(`update memberships set rotation_paused = false where id = '${MEMBERSHIP_IDS.youssef}'`);
      await desk.close();
    }
  });

  test("moving a card to Lost without a reason is impossible", async ({ page }) => {
    const name = `Lost Test ${Date.now()}`;
    const id = insertLead(name, MEMBERSHIP_IDS.mona);
    await loginStaff(page, STAFF.rep);
    await page.goto("/sales/pipeline");
    const card = page.getByTestId("lead-card").filter({ hasText: name });
    await card.getByRole("combobox", { name: `Move ${name} to` }).selectOption("lost");
    const sheet = page.getByRole("dialog", { name: `Why did ${name} not join?` });
    await expect(sheet.getByRole("button", { name: "Mark lost" })).toBeDisabled();
    await sheet.getByRole("button", { name: "Close" }).click();
    expect(sql(`select status from leads where id = '${id}'`)).toBe("new");

    await card.getByRole("combobox", { name: `Move ${name} to` }).selectOption("lost");
    await sheet.getByRole("radio", { name: "Price" }).check();
    await sheet.getByRole("button", { name: "Mark lost" }).click();
    await expect(sheet).toBeHidden();
    await expect(card).toHaveCount(0);
    expect(sql(`select status || ':' || lost_reason from leads where id = '${id}'`)).toBe("lost:price");
  });

  test("Today lists overdue follow-ups first and completing one takes one tap", async ({ page }) => {
    const tag = Date.now();
    const lead = insertLead(`Today Lead ${tag}`, MEMBERSHIP_IDS.mona);
    sql(`insert into follow_ups(lead_id, assigned_to_membership_id, title, due_at) values ('${lead}', '${MEMBERSHIP_IDS.mona}', 'Later ${tag}', now() + interval '5 minutes')`);
    sql(`insert into follow_ups(lead_id, assigned_to_membership_id, title, due_at) values ('${lead}', '${MEMBERSHIP_IDS.mona}', 'Overdue ${tag}', now() - interval '2 hours')`);
    await loginStaff(page, STAFF.rep);
    const items = page.getByTestId("today-follow-up");
    await expect(items.filter({ hasText: `Overdue ${tag}` })).toBeVisible();
    const texts = await items.allInnerTexts();
    const firstNotOverdue = texts.findIndex((x) => !x.includes("Overdue"));
    const lastOverdue = texts.map((x) => x.includes("Overdue")).lastIndexOf(true);
    expect(lastOverdue).toBeLessThan(firstNotOverdue === -1 ? Infinity : firstNotOverdue);
    expect(texts.findIndex((x) => x.includes(`Overdue ${tag}`))).toBeLessThan(texts.findIndex((x) => x.includes(`Later ${tag}`)));

    await items.filter({ hasText: `Overdue ${tag}` }).getByRole("button", { name: /^Mark done/ }).click();
    await expect(items.filter({ hasText: `Overdue ${tag}` })).toHaveCount(0);
    expect(sql(`select status from follow_ups where title = 'Overdue ${tag}'`)).toBe("done");
  });

  test("reassigning a lead requires a reason and notifies both reps", async ({ page }) => {
    const name = `Reassign Test ${Date.now()}`;
    const id = insertLead(name, MEMBERSHIP_IDS.mona);
    await loginStaff(page, STAFF.salesManager);
    await page.goto(`/sales/leads/${id}`);
    await page.getByRole("button", { name: "Reassign" }).click();
    const sheet = page.getByRole("dialog", { name: `Reassign ${name}` });
    await sheet.getByLabel("Rep").selectOption({ label: "Youssef Tarek" });
    await sheet.getByRole("button", { name: "Reassign" }).click();
    await expect(sheet.getByText("Give a reason: reassigning notifies both reps.")).toBeVisible();
    await sheet.getByLabel("Reason (required)").fill("Mona is on leave this week");
    await sheet.getByRole("button", { name: "Reassign" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText("Owner: Youssef Tarek")).toBeVisible();
    expect(sql(`select count(*) from notifications where type = 'lead.assigned' and data->>'lead_id' = '${id}' and recipient_profile_id = '00000000-0000-0000-0000-000000000012'`)).toBe("1");
    expect(sql(`select count(*) from notifications where type = 'lead.reassigned' and data->>'lead_id' = '${id}' and recipient_profile_id = '00000000-0000-0000-0000-000000000011'`)).toBe("1");
  });
});
