import { expect, test } from "@playwright/test";

import { adjacentPrimaryRoute, PRIMARY_ROUTES } from "@/lib/navigation/routes";

// The route reached from "/" by a forward swipe, and the label of the nav link that
// points at it. Both derived from the route set: a derived app that inserts its own
// second primary route should not have to edit this file.
const [, SECOND_ROUTE] = PRIMARY_ROUTES;
const SWIPE_DESTINATION = adjacentPrimaryRoute("/", 1);

test.beforeEach(async ({ page }) => {
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
});

test("prefetched primary navigation acknowledges within 100 ms on throttled 4G and back restores scroll", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "CDP network throttling is Chromium-only");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    connectionType: "cellular4g",
  });

  const feedback: number[] = [];
  await page.route("**/api/events", async (route) => {
    const body = route.request().postDataJSON() as {
      event_name?: string;
      properties?: { feedback_ms?: number };
    };
    if (
      body.event_name === "navigation_feedback_measured" &&
      typeof body.properties?.feedback_ms === "number"
    ) {
      feedback.push(body.properties.feedback_ms);
    }
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/");
  const secondLink = page.getByRole("link", { name: SECOND_ROUTE.label, exact: true });
  await expect(secondLink).toBeVisible();
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    document.body.style.minHeight = "2200px";
    window.scrollTo(0, 700);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);

  await secondLink.click();
  await expect(page).toHaveURL((url) => url.pathname === SECOND_ROUTE.href);
  await expect.poll(() => feedback.length).toBeGreaterThan(0);
  expect(feedback[0]).toBeLessThanOrEqual(100);
  await page.goBack();
  await expect(page.getByText("The protected shell is ready")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
});

test("horizontal swipe moves between adjacent primary routes", async ({ page }) => {
  await page.route("**/api/events", (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto("/");
  const main = page.locator("main");
  const box = await main.boundingBox();
  if (!box) throw new Error("Main content was not measurable");

  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.42);
  await page.mouse.up();

  // Assert the destination URL, not what the destination renders. The heading this
  // replaced coupled the gate to one route's content: a derived app whose second
  // primary route fetches data painted an error state here and had to mock an API
  // just to keep a navigation test passing (docs/FIX_LOG.md, 2026-08-02).
  if (!SWIPE_DESTINATION) throw new Error("No primary route adjacent to /");
  await expect(page).toHaveURL((url) => url.pathname === SWIPE_DESTINATION);
});
