import { defineConfig, devices } from "@playwright/test";

import { loadEnvLocal } from "./scripts/load-env-local.mjs";

// e2e/global-setup.ts already reads .env.local to decide where to seed the
// fixture user, but webServer.env is built here — so without this the app under
// test ran against the placeholder stack while the setup and the specs believed
// a local one. Reading it here makes all four processes agree, the way CI does
// by exporting the stack's credentials.
loadEnvLocal();

const port = Number(process.env.PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: ".",
  testMatch: ["e2e/**/*.spec.ts", "src/app/**/_tests/**/*.spec.ts"],
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // page.route mocks are bypassed once a service worker controls the page
    // (clientsClaim fires mid-test), so app-logic specs run without workers.
    // e2e/service-worker.spec.ts re-enables them to test SW behavior itself.
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 15"] },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_APP_ID: process.env.NEXT_PUBLIC_APP_ID ?? "test-application",
      NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION ?? "e2e",
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        "sb_publishable_test_000000000000000000000000000000",
      APP_ENV: "test",
      SUPABASE_SECRET_KEY:
        process.env.SUPABASE_SECRET_KEY ?? "sb_secret_test_000000000000000000000000000000",
      // Deliberately empty, overriding whatever the environment supplies: a
      // limiter built from an unreachable placeholder host throws on every
      // call, which the route correctly reports as 503 RATE_LIMIT_UNAVAILABLE.
      // That made any spec hitting a real route impossible. Empty selects the
      // in-memory limiter (APP_ENV=test), so routes can be exercised end to
      // end; distributed rate limiting is not what the browser suite tests.
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
    },
  },
});
