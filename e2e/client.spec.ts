import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, test, type Page } from "@playwright/test";
import { loginClient, loginStaff, sql, STAFF } from "./helpers";

const HASSAN = { id: "00000000-0000-0000-0002-000000000001", profile: "00000000-0000-0000-0001-000000000001", phone: "01110000001" };
const FARIDA = { id: "00000000-0000-0000-0002-000000000008", phone: "01110000008" };
const MONA_PROFILE = "00000000-0000-0000-0000-000000000011";
const MAHMOUD_PROFILE = "00000000-0000-0000-0000-000000000022";

/** Hassan's best estimated 1RM on the back squat so far (the PR trigger's Epley formula), with a history if he has none. */
function squatBest(): number {
  sql(`insert into workout_logs(client_id, performed_at)
       select '${HASSAN.id}', now() - interval '3 days' where not exists (select 1 from set_logs s join workout_logs w on w.id = s.workout_log_id
         where w.client_id = '${HASSAN.id}' and s.exercise_id = (select id from exercises where name = 'Back squat'))`);
  sql(`insert into set_logs(workout_log_id, exercise_id, set_index, weight_kg, reps)
       select w.id, (select id from exercises where name = 'Back squat'), 1, 80, 5 from workout_logs w
       where w.client_id = '${HASSAN.id}' and not exists (select 1 from set_logs s where s.workout_log_id = w.id) limit 1`);
  return Number(sql(`select max(s.weight_kg * (1 + s.reps / 30.0)) from set_logs s join workout_logs w on w.id = s.workout_log_id
    where w.client_id = '${HASSAN.id}' and s.exercise_id = (select id from exercises where name = 'Back squat')`));
}
const workoutCount = () => Number(sql(`select count(*) from workout_logs where client_id = '${HASSAN.id}'`));

async function logSet(page: Page, n: number, kg: string, reps: string) {
  await page.getByLabel(`Set ${n} kg, Back squat`).fill(kg);
  await page.getByLabel(`Set ${n} reps, Back squat`).fill(reps);
  await page.getByRole("button", { name: `Set ${n} done, Back squat` }).click();
}

test("Hassan logs a workout with no signal; back online it syncs once and the PR badge is on the set that beat his history", async ({ page, context }) => {
  const best = squatBest();
  const light = String(Math.floor(best * 0.5));
  const heavy = String(Math.ceil(best) + 5); // × 5 reps beats every set he has done
  const before = workoutCount();

  await loginClient(page, HASSAN.phone);
  await page.goto("/c/workout?day=1");
  await expect(page.getByTestId("exercise-card").first()).toContainText("Back squat");
  await expect(page.getByTestId("last-time").first()).toContainText("Last time");

  await context.setOffline(true);
  await logSet(page, 1, light, "5");
  await expect(page.getByTestId("rest-timer")).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  await logSet(page, 2, heavy, "5");
  await page.getByRole("button", { name: /Finish workout \(2 sets\)/ }).click();

  const summary = page.getByTestId("workout-summary");
  await expect(summary).toContainText("Saved on this phone");
  await expect(summary).toHaveAttribute("data-synced", "false");
  expect(workoutCount()).toBe(before); // nothing reached the server

  await context.setOffline(false);
  await expect(summary).toHaveAttribute("data-synced", "true", { timeout: 20_000 });
  await expect(summary.getByTestId("saved-set").filter({ hasText: `${heavy} kg` })).toHaveAttribute("data-pr", "true");
  await expect(summary.getByTestId("saved-set").filter({ hasText: `${light} kg` })).toHaveAttribute("data-pr", "false");
  await expect(summary.locator("[data-pr=\"true\"]")).toHaveCount(1);
  expect(workoutCount()).toBe(before + 1); // sent once
});

test("the app shell and the logger open with no signal after one visit (service worker + IndexedDB)", async ({ page, context }) => {
  await loginClient(page, HASSAN.phone);
  await page.goto("/c/workout");
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); // now controlled by the worker, which keeps the page
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("exercise-card").first()).toBeVisible();
  await expect(page.getByText("No signal. Log as usual")).toBeVisible();
  await context.setOffline(false);
});

test("Renew flags Mahmoud (his coach) and Mona (his rep) with a notification and a FLAG task", async ({ page }) => {
  sql(`update follow_ups set status = 'done', completed_at = now() where client_id = '${HASSAN.id}' and status = 'open' and title like 'FLAG:%'`);
  const since = sql("select now()");
  await loginClient(page, HASSAN.phone);
  await page.goto("/c/credits");
  await page.getByRole("button", { name: "Renew" }).click();
  await page.getByRole("dialog", { name: "Renew" }).getByRole("button", { name: "Ask to renew" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Mona will contact you" })).toBeVisible();
  await expect(page.getByTestId("renewal-open")).toBeVisible();

  expect(sql(`select count(*) from follow_ups where client_id = '${HASSAN.id}' and status = 'open' and title like 'FLAG:%' and assigned_to_membership_id = 'a0000000-0000-0000-0000-000000000011'`)).toBe("1");
  for (const who of [MONA_PROFILE, MAHMOUD_PROFILE]) {
    expect(sql(`select count(*) from notifications where recipient_profile_id = '${who}' and type = 'client.flagged' and data->>'kind' = 'renewal_request' and created_at >= '${since}'`)).toBe("1");
  }
});

test("the credits screen matches fn_credit_balances per coach with the next expiry; no self-service extension", async ({ page }) => {
  const expected = sql(`select coach_name || '|' || balance || '|' || next_expiry from fn_credit_balances('${HASSAN.id}')`).split("\n").filter(Boolean);
  await loginClient(page, HASSAN.phone);
  await page.goto("/c/credits");
  const rows = page.getByTestId("balance-row");
  await expect(rows).toHaveCount(expected.length);
  const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Cairo" });
  for (const line of expected) {
    const [coach, balance, expiry] = line.split("|");
    const row = rows.filter({ hasText: coach });
    await expect(row).toHaveAttribute("data-balance", balance);
    await expect(row.getByTestId("next-expiry")).toHaveText(`Next expiry ${dateFmt.format(new Date(expiry))}`);
  }
  await expect(page.getByRole("button", { name: /extend/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ask Mona on WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/20/);
});

test("Today shows the coach's slots read-only (no booking) and one tap checks in within the hour", async ({ page }) => {
  sql(`insert into sessions(client_id, coach_membership_id, branch_id, scheduled_at)
       select '${HASSAN.id}', 'a0000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-00000000000a', now() + interval '20 minutes'
       where not exists (select 1 from sessions where client_id = '${HASSAN.id}' and status = 'booked' and scheduled_at between now() and now() + interval '1 hour')`);
  await loginClient(page, HASSAN.phone);
  await page.goto("/c");
  const slots = page.getByTestId("my-slots");
  await expect(slots.getByRole("listitem")).toHaveCount(3);
  await expect(slots.getByRole("listitem").first()).toContainText(/Saturday\s*15:00\s*Mahmoud Gamal/);
  await expect(slots.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /book/i })).toHaveCount(0);

  const here = page.getByRole("button", { name: "I'm here" });
  if (await here.isVisible()) await here.click();
  await expect(page.getByTestId("next-session")).toContainText(/You're checked in/);
});

test("the kiosk's QR code of the day checks a member in from their phone", async ({ page, browser }) => {
  await loginStaff(page, STAFF.desk);
  await page.goto("/checkin");
  const url = await page.getByTestId("kiosk-qr").getAttribute("data-url");
  expect(url).toMatch(/\/c\/here\?b=.+&k=[0-9a-f]{16}$/);

  const member = await browser.newPage();
  await loginClient(member, FARIDA.phone);
  await member.goto(new URL(url!).pathname + new URL(url!).search);
  await expect(member.getByTestId("here-result")).toHaveAttribute("data-ok", "true");
  await member.goto("/c/here?b=b0000000-0000-0000-0000-00000000000a&k=0000000000000000");
  await expect(member.getByTestId("here-result")).toContainText("isn't today's");
  await member.close();
});

test("progress shows PRs and the streak; body weight and profile save", async ({ page }) => {
  squatBest();
  await loginClient(page, HASSAN.phone);
  await page.goto("/c/progress");
  await expect(page.getByTestId("pr-list")).toContainText("Back squat");
  await expect(page.getByTestId("streak")).toHaveText(/[1-9]\d* week/);
  await page.getByPlaceholder("Weight (kg)").fill("81.5");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved 81.5 kg" })).toBeVisible();
  await expect.poll(() => sql(`select count(*) from body_metrics where client_id = '${HASSAN.id}' and weight_kg = 81.5`)).not.toBe("0");

  await page.goto("/c/profile");
  await page.getByLabel("Time of day").selectOption("evening");
  await page.getByLabel("Instagram handle").fill("@hassan.lifts");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  expect(sql(`select onboarding_responses #>> '{pt_prefs,time}' || '|' || instagram_handle from clients where id = '${HASSAN.id}'`)).toBe("evening|@hassan.lifts");
});

test("PWA: installable (manifest, icons, service worker) and the first load is under 2 s on throttled 4G", async ({ page, browserName }, info) => {
  test.skip(browserName !== "chromium" || info.project.name !== "mobile-390", "Chromium DevTools protocol; measured once, on the phone profile");
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ display: "standalone", start_url: "/" });
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.clearBrowserCache");
  // Lighthouse's throttled ("slow") 4G: 150 ms RTT, 1.6 Mbps down, 750 kbps up; 4× CPU slowdown
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto("/login");
  const lcp = await page.evaluate(() => new Promise<number>((resolve) => {
    new PerformanceObserver((list) => resolve(list.getEntries().at(-1)!.startTime)).observe({ type: "largest-contentful-paint", buffered: true });
  }));
  const load = await page.evaluate(() => (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).loadEventEnd);
  info.annotations.push({ type: "first load (slow 4G, 4× CPU)", description: `LCP ${Math.round(lcp)} ms, load ${Math.round(load)} ms` });
  expect(lcp).toBeLessThan(2000);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  // Chrome doesn't evaluate installability in incognito, which is what Playwright contexts are: use a real profile
  const profile = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "gymos-pwa-")), {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    baseURL: info.project.use.baseURL,
  });
  const app = profile.pages()[0] ?? (await profile.newPage());
  await app.goto("/login");
  await app.evaluate(async () => { await navigator.serviceWorker.ready; });
  const appCdp = await profile.newCDPSession(app);
  await expect.poll(async () => (await appCdp.send("Page.getInstallabilityErrors")).installabilityErrors, { timeout: 15_000 }).toEqual([]);
  await profile.close();
});
