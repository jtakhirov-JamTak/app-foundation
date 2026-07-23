import { expect, test } from "@playwright/test";

test("service worker serves the repeat-open shell and never caches API responses", async ({
  page,
  context,
}) => {
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
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  const cacheSnapshot = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls = (
      await Promise.all(
        keys.map(async (key) => {
          const cache = await caches.open(key);
          return (await cache.keys()).map((request) => request.url);
        }),
      )
    ).flat();
    return { keys, urls };
  });

  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "e2e";
  expect(cacheSnapshot.keys.some((key) => key.includes(version))).toBe(true);
  expect(cacheSnapshot.urls.some((url) => url.includes("/api/"))).toBe(false);
  expect(cacheSnapshot.urls.some((url) => url.includes("supabase.co"))).toBe(false);

  await page.unroute("**/api/session");
  await context.setOffline(true);
  const response = await page.reload({ waitUntil: "domcontentloaded" });
  expect(response?.fromServiceWorker()).toBe(true);
  await expect(page.locator("[data-safe-shell]")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();

  const firstContentfulPaint = await page.evaluate(() => {
    const entry = performance.getEntriesByName("first-contentful-paint")[0];
    return entry?.startTime ?? Number.POSITIVE_INFINITY;
  });
  expect(firstContentfulPaint).toBeLessThanOrEqual(500);
});
