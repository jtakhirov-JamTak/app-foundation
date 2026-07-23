import { expect, test } from "@playwright/test";

test("mobile cold launch and scripted interaction stay within Web Vitals budgets", async ({
  page,
  browserName
}) => {
  test.skip(browserName !== "chromium", "Event Timing is checked in Chromium");

  await page.addInitScript(() => {
    const eventDurations: number[] = [];
    const lcpValues: number[] = [];
    Object.defineProperty(window, "__eventDurations", {
      value: eventDurations,
      configurable: true
    });
    Object.defineProperty(window, "__lcpValues", { value: lcpValues, configurable: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if ("interactionId" in entry && Number(entry.interactionId) > 0) {
          eventDurations.push(entry.duration);
        }
      }
    }).observe(
      { type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit & {
        durationThreshold: number;
      }
    );

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) lcpValues.push(entry.startTime);
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });

  await page.route("**/api/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        user: { id: "11111111-1111-4111-8111-111111111111" }
      })
    })
  );
  await page.route("**/api/events", (route) => route.fulfill({ status: 204, body: "" }));

  await page.goto("/");
  await expect(page.getByText("The protected shell is ready")).toBeVisible();

  await page.waitForTimeout(100);
  const lcp = await page.evaluate(() => {
    const values = (window as typeof window & { __lcpValues?: number[] }).__lcpValues ?? [];
    return values.at(-1) ?? Number.POSITIVE_INFINITY;
  });
  expect(lcp).toBeLessThanOrEqual(2500);

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.waitForTimeout(250);

  const inp = await page.evaluate(() => {
    const values = (window as typeof window & { __eventDurations?: number[] }).__eventDurations ?? [];
    return values.length ? Math.max(...values) : 0;
  });
  expect(inp).toBeLessThanOrEqual(200);
});
