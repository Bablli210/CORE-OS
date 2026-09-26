import { expect, test, type Page } from "@playwright/test";
import { sql } from "../helpers";

// M8 acceptance (docs/05), on the Expo app's web build (react-native-web: the same screens, shared hooks and RPC layer
// as the iOS/Android build) against the same local Supabase:
// - Coach Today works, including attendance outcomes (also with no signal: queued, then sent) and walk-ins.
// - Client workout logging works offline.
// The third box, "shared package has zero React-DOM imports", is packages/api/shared.test.ts plus its lint rule.

const COACH_M = "a0000000-0000-0000-0000-000000000024"; // coach1.b, not used by the web specs
const HABIBA = "00000000-0000-0000-0002-000000000030"; // 32 sessions with coach1.b
const MOATAZ = "00000000-0000-0000-0002-000000000037";
const HASSAN = "00000000-0000-0000-0002-000000000001";

/** The app opens at "/" (a phone has no address bar); sign-in happens in the app. */
async function openApp(page: Page) {
  await page.goto("/");
  await page.waitForURL(/\/(login|today|home)$/);
}

async function signInStaff(page: Page, email: string) {
  await openApp(page);
  await page.getByRole("tab", { name: "Staff" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("gymos-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function signInMember(page: Page, localNumber: string) {
  await openApp(page);
  await page.getByLabel("Phone number").fill(localNumber);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("coach app", () => {
  let fixture: string[] = [];
  let lots = "";
  test.beforeAll(() => {
    lots = sql(`select coalesce(string_agg(id || ':' || qty_remaining || ':' || status, ','), '') from credit_lots where coach_membership_id = '${COACH_M}' and client_id in ('${HABIBA}', '${MOATAZ}')`);
    // two booked sessions for coach1.b that started a few minutes ago, so outcomes can be recorded
    fixture = sql(`with s as (insert into sessions(client_id, coach_membership_id, branch_id, scheduled_at, status)
        select c, '${COACH_M}', m.branch_id, t, 'booked' from memberships m,
        (values ('${HABIBA}'::uuid, date_trunc('minute', now()) - interval '10 minutes'), ('${MOATAZ}'::uuid, date_trunc('minute', now()) - interval '5 minutes')) v(c, t)
        where m.id = '${COACH_M}' returning id) select string_agg(id::text, ',') from s`).split(",");
  });
  test.afterAll(() => {
    const mine = `coach_membership_id = '${COACH_M}' and (id = any('{${fixture.join(",")}}') or (is_walk_in and client_id = '${MOATAZ}' and cairo_date(scheduled_at) = cairo_date(now())))`;
    sql(`delete from credit_ledger where session_id in (select id from sessions where ${mine})`);
    sql(`delete from notifications where data->>'session_id' in (select id::text from sessions where ${mine})`);
    sql(`delete from sessions where ${mine}`);
    for (const l of lots.split(",").filter(Boolean)) {
      const [id, qty, status] = l.split(":");
      sql(`update credit_lots set qty_remaining = ${qty}, status = '${status}' where id = '${id}'`);
    }
  });

  test("Today: one tap per outcome, a no-signal tap waits and is sent, walk-ins; Clients and Schedule open", async ({ page, context }) => {
    await signInStaff(page, "coach1.b@gymos.local");
    await page.waitForURL(/\/today$/);
    const habiba = page.locator(`[data-testid="session-row"][data-id="${fixture[0]}"]`);
    const moataz = page.locator(`[data-testid="session-row"][data-id="${fixture[1]}"]`);
    await expect(habiba).toBeVisible();
    const before = Number(sql(`select fn_credit_balance('${HABIBA}', '${COACH_M}')`));

    // Completed: the row changes at once, the database burns one session with this coach
    await habiba.getByRole("radio", { name: "Completed" }).click();
    await expect(habiba).toHaveAttribute("data-status", "completed");
    await expect.poll(() => sql(`select status from sessions where id = '${fixture[0]}'`)).toBe("completed");
    expect(Number(sql(`select fn_credit_balance('${HABIBA}', '${COACH_M}')`))).toBe(before - 1);
    await expect(habiba.getByTestId("credits-left")).toContainText(`${before - 1} left`);

    // No signal: the tap shows, waits on the phone, and is sent when signal returns
    await context.setOffline(true);
    await moataz.getByRole("radio", { name: "No-show" }).click();
    await expect(moataz).toHaveAttribute("data-status", "no_show");
    await expect(moataz.getByTestId("queued")).toBeVisible();
    await expect(page.getByTestId("queue-banner")).toBeVisible();
    expect(sql(`select status from sessions where id = '${fixture[1]}'`)).toBe("booked");
    await context.setOffline(false);
    await expect.poll(() => sql(`select status from sessions where id = '${fixture[1]}'`), { timeout: 30_000 }).toBe("no_show");
    await expect(page.getByTestId("queue-banner")).toHaveCount(0);

    // Walk-in: pick the client, start; a completed walk-in session is recorded now
    await page.getByRole("button", { name: "Record a walk-in" }).click();
    const sheet = page.getByTestId("walk-in-sheet");
    await sheet.getByRole("radio", { name: /Moataz Hafez/ }).click();
    await sheet.getByRole("button", { name: "Start walk-in session" }).click();
    await expect(page.getByText("Walk-in recorded for Moataz Hafez.")).toBeVisible();
    expect(sql(`select count(*) from sessions where client_id = '${MOATAZ}' and coach_membership_id = '${COACH_M}' and is_walk_in and status = 'completed' and cairo_date(scheduled_at) = cairo_date(now())`)).toBe("1");

    // the other tabs
    await page.getByTestId("tab-clients").click();
    await expect(page.getByTestId("client-row").filter({ hasText: "Habiba Emad" })).toBeVisible();
    await page.getByTestId("client-row").filter({ hasText: "Habiba Emad" }).click();
    await expect(page.getByTestId("coach-client")).toContainText("Habiba Emad");
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByTestId("tab-schedule").click();
    await expect(page.getByTestId("schedule-day")).toHaveCount(7);
    await expect(page.getByTestId("schedule-slot").first()).toBeVisible();
  });
});

test.describe("client app", () => {
  test("a workout logged with no signal is kept on the phone and sent once when signal returns", async ({ page, context }) => {
    const count = () => Number(sql(`select count(*) from workout_logs where client_id = '${HASSAN}'`));
    await signInMember(page, "01110000001");
    await page.waitForURL(/\/home$/);
    await expect(page.getByTestId("client-balances")).toBeVisible();
    await page.getByTestId("tab-workout").click();
    const firstSet = page.getByTestId("exercise-card").first().getByTestId("set-row").first();
    await expect(firstSet).toBeVisible();
    const before = count();

    await context.setOffline(true);
    await expect(page.getByTestId("offline-banner")).toBeVisible();
    await firstSet.getByRole("textbox").first().fill("62.5");
    await firstSet.getByRole("button").click();
    await page.getByRole("button", { name: "Finish workout (1 sets)" }).click();
    await expect(page.getByTestId("workout-finished")).toContainText("Saved on this phone");
    expect(count()).toBe(before);

    await context.setOffline(false);
    await expect(page.getByTestId("workout-finished")).toContainText("Workout saved.", { timeout: 30_000 });
    expect(count()).toBe(before + 1);
    expect(sql(`select weight_kg from set_logs s join workout_logs w on w.id = s.workout_log_id where w.client_id = '${HASSAN}' order by w.performed_at desc, s.set_index limit 1`)).toBe("62.50");

    // Credits tab
    await page.getByTestId("tab-credits").click();
    await expect(page.getByTestId("credit-balance").first()).toBeVisible();
  });
});
