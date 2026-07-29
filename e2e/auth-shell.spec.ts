import { expect, test, type Page } from "@playwright/test";

const userId = "11111111-1111-4111-8111-111111111111";

function authenticatedSession() {
  return {
    authenticated: true,
    user: { id: userId },
  } as const;
}

async function mockPasswordLogin(page: Page) {
  await page.route("https://example.supabase.co/auth/v1/token**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "test-access-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "test-refresh-token",
        user: {
          id: userId,
          aud: "authenticated",
          role: "authenticated",
          email: "a@example.invalid",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          identities: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_anonymous: false,
        },
      }),
    }),
  );
  await page.route("**/api/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(authenticatedSession()),
    }),
  );
  await page.route("**/api/events", (route) => route.fulfill({ status: 204, body: "" }));
}

test("safe shell paints before session verification and analytics", async ({ page }) => {
  let resolveSession: (() => void) | undefined;

  await page.route("**/api/session", async (route) => {
    await new Promise<void>((resolve) => {
      resolveSession = resolve;
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(authenticatedSession()),
    });
  });

  await page.route("**/api/events", async () => {
    await new Promise(() => {});
  });

  await page.goto("/");
  await expect(page.locator("[data-safe-shell]")).toBeVisible();
  await expect(page.getByRole("navigation").locator(".skeleton")).toHaveCount(2);

  // The session request may not have fired yet; resolving before the route
  // callback runs would leave the request blocked forever.
  await expect.poll(() => resolveSession !== undefined).toBe(true);
  resolveSession?.();
  await expect(page.getByText("The protected shell is ready")).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
});

test("unauthenticated and expired sessions redirect without exposing protected content", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/session", (route) => {
    calls += 1;
    return route.fulfill({
      status: calls === 1 ? 200 : 401,
      contentType: "application/json",
      body: JSON.stringify(calls === 1 ? authenticatedSession() : { authenticated: false }),
    });
  });
  await page.route("**/api/events", (route) => route.fulfill({ status: 204, body: "" }));

  await page.goto("/");
  await expect(page.getByText("The protected shell is ready")).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await expect(page.getByText("The protected shell is ready")).toHaveCount(0);
});

test("sign out clears the protected shell and redirects", async ({ page }) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(authenticatedSession()),
    }),
  );
  await page.route("**/api/events", (route) => route.fulfill({ status: 204, body: "" }));
  await page.route("https://example.supabase.co/**", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );

  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=/);
});

// With JavaScript off the browser sees exactly the server-delivered HTML, so
// this fails if anything in the sign-in tree stops being prerendered.
//
// This locks in an invariant that already holds; it is not a regression test for
// a past bug. `useSearchParams()` does NOT force a client-only render here:
// under `dynamic = "force-static"` Next returns empty params during prerender
// rather than bailing out, so the fields ship in the static HTML and the
// Suspense fallback never reaches the browser. Verified 2026-07-28 by building
// and reading .next/server/app/sign-in.html. Keep this test so a future change
// (dropping force-static, or adding a genuinely dynamic read) is caught.
test.describe("sign-in prerender", () => {
  test.use({ javaScriptEnabled: false });

  test("sign-in fields are in the static HTML, not gated behind hydration", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create an account" })).toBeVisible();
    await expect(page.locator(".skeleton")).toHaveCount(0);
  });
});

test("an invalid confirmation link is explained on the sign-in page", async ({ page }) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false }),
    }),
  );

  await page.goto("/sign-in?error=confirmation");
  await expect(
    page.getByText("The confirmation link was invalid or expired. Request a new one."),
  ).toBeVisible();

  await page.goto("/sign-in");
  await expect(page.getByText("The confirmation link was invalid")).toHaveCount(0);
});

test("password login honours a safe next destination", async ({ page }) => {
  await mockPasswordLogin(page);

  await page.goto("/sign-in?next=%2Fsettings");
  await page.getByLabel("Email").fill("a@example.invalid");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/settings");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("password login reaches the protected shell", async ({ page }) => {
  await mockPasswordLogin(page);

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("a@example.invalid");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("The protected shell is ready")).toBeVisible();
});
