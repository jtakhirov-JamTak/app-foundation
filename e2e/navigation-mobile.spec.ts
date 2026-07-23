import { expect, test } from "@playwright/test";

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
  const settings = page.getByRole("link", { name: "Settings" });
  await expect(settings).toBeVisible();
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    document.body.style.minHeight = "2200px";
    window.scrollTo(0, 700);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);

  await settings.click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
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

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});
