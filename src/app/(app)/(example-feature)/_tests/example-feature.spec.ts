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
  await page.route("**/api/events", (route) => route.fulfill({ status: 204, body: "" }));
});

test("example creates domain data and tracks only the typed creation event", async ({ page }) => {
  const records: Array<{ id: string; title: string; created_at: string }> = [];
  const events: unknown[] = [];
  await page.unroute("**/api/events");
  await page.route("**/api/events", async (route) => {
    events.push(route.request().postDataJSON());
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/api/example-records", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ records }),
      });
      return;
    }

    const payload = route.request().postDataJSON() as { title: string };
    const record = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: payload.title,
      created_at: new Date().toISOString(),
    };
    records.unshift(record);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ record }),
    });
  });

  await page.goto("/example");
  await page.getByLabel("Record title").fill("Saved record");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved record")).toBeVisible();
  await expect.poll(() => events.length).toBeGreaterThan(0);
  const creationEvent = events.find(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      "event_name" in value &&
      value.event_name === "example_record_created",
  );
  expect(creationEvent).toEqual(
    expect.objectContaining({
      event_name: "example_record_created",
      properties: { source: "example_form" },
    }),
  );
  expect(JSON.stringify(creationEvent)).not.toContain("Saved record");
});

test("SWR cache restores records while back-navigation revalidation is still pending", async ({
  page,
}) => {
  let reads = 0;
  let releaseRevalidation: (() => void) | undefined;
  const revalidationBlocked = new Promise<void>((resolve) => {
    releaseRevalidation = resolve;
  });
  const record = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "Cached record",
    created_at: new Date().toISOString(),
  };

  await page.route("**/api/example-records", async (route) => {
    reads += 1;
    if (reads > 1) await revalidationBlocked;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ records: [record] }),
    });
  });

  await page.goto("/example");
  await expect(page.getByText("Cached record")).toBeVisible();
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  await page.goBack({ waitUntil: "commit" });
  await expect(page.getByText("Cached record")).toBeVisible();
  expect(reads).toBeGreaterThan(1);
  releaseRevalidation?.();
});

test("failed save preserves input and offers retry", async ({ page }) => {
  await page.route("**/api/example-records", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ records: [] }),
      });
      return;
    }
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "EXAMPLE_SAVE_FAILED", request_id: "request-1", recoverable: true },
      }),
    });
  });

  await page.goto("/example");
  const input = page.getByLabel("Record title");
  await input.fill("Keep this");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("alert")).toContainText("Save failed");
  await expect(input).toHaveValue("Keep this");
  await expect(page.getByRole("button", { name: "Try save again" })).toBeVisible();
});

test("unsaved form state survives in-app back navigation", async ({ page }) => {
  await page.route("**/api/example-records", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ records: [] }),
    }),
  );

  await page.goto("/example");
  await page.getByLabel("Record title").fill("Unsaved state");
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("Record title")).toHaveValue("Unsaved state");
});

test("offline state prevents sensitive writes", async ({ page, context }) => {
  await page.route("**/api/example-records", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ records: [] }),
    }),
  );

  await page.goto("/example");
  await page.getByLabel("Record title").fill("Not queued");
  await context.setOffline(true);
  await expect(page.getByText(/Reconnect before saving/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
});

test("unauthorized example request redirects to sign in", async ({ page }) => {
  await page.unroute("**/api/session");
  await page.route("**/api/session", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false }),
    }),
  );

  await page.goto("/example");
  await expect(page).toHaveURL(/\/sign-in\?next=/);
});
