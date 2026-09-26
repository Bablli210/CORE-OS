import { defineConfig, devices } from "@playwright/test";

// e2e tests run against a production build (E2E_DEV=1 for `pnpm dev`) and the local Supabase seed (docs/05: every screen has a test on seed data).
// Two viewports per the definition of done: 390px (one-handed mobile) and 1280px (desktop).
export default defineConfig({
  testDir: "./e2e",
  // One shared seeded database: run serially so tests that change settings or send OTPs don't interfere.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "mobile-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: "desktop-1280", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: process.env.E2E_DEV ? "pnpm --filter @gymos/web dev" : "pnpm --filter @gymos/web build && pnpm --filter @gymos/web start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
