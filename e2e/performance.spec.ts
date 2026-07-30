import { expect, test, type Page } from "@playwright/test";

// Both perf tests read the same two observers, so they are installed from one
// place: a second copy of this init script would let the measurement paths
// drift apart while still looking identical at the call site.
async function installVitalsObservers(page: Page) {
  await page.addInitScript(() => {
    const eventDurations: number[] = [];
    const lcpValues: number[] = [];
    Object.defineProperty(window, "__eventDurations", {
      value: eventDurations,
      configurable: true,
    });
    Object.defineProperty(window, "__lcpValues", { value: lcpValues, configurable: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if ("interactionId" in entry && Number(entry.interactionId) > 0) {
          eventDurations.push(entry.duration);
        }
      }
    }).observe({
      type: "event",
      buffered: true,
      durationThreshold: 16,
    } as PerformanceObserverInit & {
      durationThreshold: number;
    });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) lcpValues.push(entry.startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
}

// The last entry, not the first: LCP is whatever finally won, and Infinity when
// nothing painted so a missing observer fails the budget instead of passing it.
//
// Callers settle first (a later, larger paint must be allowed to win), then this
// polls for the entry to actually be there. Entry delivery is asynchronous and a
// fixed sleep alone is a race: 1 run in 13 recorded nothing within 100 ms and
// failed with Infinity (observed 2026-07-30, under parallel worker load). Polling
// after the settle cannot lower a measurement — it only extends the wait when the
// array is still empty — so absence of data still fails, but jitter does not.
async function readLcp(page: Page) {
  const count = () =>
    page.evaluate(
      () => ((window as typeof window & { __lcpValues?: number[] }).__lcpValues ?? []).length,
    );
  await expect.poll(count, { timeout: 5_000 }).toBeGreaterThan(0);

  return page.evaluate(() => {
    const values = (window as typeof window & { __lcpValues?: number[] }).__lcpValues ?? [];
    return values.at(-1) ?? Number.POSITIVE_INFINITY;
  });
}

async function readInp(page: Page) {
  return page.evaluate(() => {
    const values =
      (window as typeof window & { __eventDurations?: number[] }).__eventDurations ?? [];
    return values.length ? Math.max(...values) : 0;
  });
}

// Regression test for the read itself, not for the app: before `readLcp` polled,
// a run where Chromium delivered no LCP entry within the caller's 100 ms settle
// read an empty array, collapsed to Infinity, and failed the budget with a
// non-measurement. Reproduced 1 run in 13 under parallel worker load 2026-07-30.
// Here the same condition is made deterministic — the entry lands well after the
// read begins — so the pre-fix helper fails this every time.
test("the LCP read waits for entries that land after the settle window", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "LargestContentfulPaint is Chromium-only");

  await page.addInitScript(() => {
    Object.defineProperty(window, "__lcpValues", { value: [], configurable: true });
    setTimeout(() => {
      (window as typeof window & { __lcpValues: number[] }).__lcpValues.push(1234);
    }, 600);
  });

  await page.goto("/sign-in");

  expect(await readLcp(page)).toBe(1234);
});

test("mobile cold launch and scripted interaction stay within Web Vitals budgets", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Event Timing is checked in Chromium");

  await installVitalsObservers(page);

  await page.route("**/api/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        user: { id: "11111111-1111-4111-8111-111111111111" },
      }),
    }),
  );
  await page.route("**/api/events", (route) => route.fulfill({ status: 204, body: "" }));

  await page.goto("/");
  await expect(page.getByText("The protected shell is ready")).toBeVisible();

  await page.waitForTimeout(100);
  expect(await readLcp(page)).toBeLessThanOrEqual(2500);

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.waitForTimeout(250);

  expect(await readInp(page)).toBeLessThanOrEqual(200);
});

// The unauthenticated cold start — load `/`, verify the session, redirect, paint
// sign-in — is measured here and nowhere else. `lighthouserc.cjs` deliberately
// does not collect `/` (it would measure `/sign-in` twice under a misleading
// name), and lhci cannot hold a session either way.
//
// One observer legitimately spans two URLs: AuthBoundary redirects with
// `router.replace()` (src/components/app-shell/auth-boundary.tsx), a Next soft
// navigation, so the document is never torn down. LCP does not reset, and entry
// timestamps stay relative to the original navigation to `/`. Reading the last
// entry after the sign-in form is visible therefore yields the end-to-end
// number, not the skeleton paint. Do not "fix" this into two measurements — a
// hard navigation is what would break it.
//
// Verified by instrumenting the observer 2026-07-30: each run emits exactly two
// candidates — the pre-redirect shell text ("Application") at ~132–144 ms, then
// the sign-in subtitle from src/app/(public)/sign-in/page.tsx at ~276–296 ms.
// The winner is post-redirect content, so this genuinely measures the journey.
test("unauthenticated cold start paints sign-in within the LCP budget", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "LargestContentfulPaint is Chromium-only");

  await installVitalsObservers(page);

  await page.route("**/api/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false }),
    }),
  );
  await page.route("**/api/events", (route) => route.fulfill({ status: 204, body: "" }));

  await page.goto("/");

  // Both waits are load-bearing for the measurement, not just for the assertion:
  // reading before the redirect resolves would report the skeleton.
  await expect(page).toHaveURL(/\/sign-in\?next=%2F$/);
  await expect(page.getByLabel("Email")).toBeVisible();

  // Measured 268–408 ms across 19 local runs — roughly 6× headroom. The budget
  // is deliberately the field LCP number from ARCHITECTURE.md rather than a
  // tightened local one: a machine-calibrated threshold would mean something
  // different here than the same constant means everywhere else, and would flake
  // on a shared CI runner. Tighten it only against numbers from that runner.
  await page.waitForTimeout(100);
  expect(await readLcp(page)).toBeLessThanOrEqual(2500);
});
