import { expect, test } from "@playwright/test";

const userId = "11111111-1111-4111-8111-111111111111";

function authenticatedSession() {
  return {
    authenticated: true,
    user: { id: userId },
  } as const;
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

test("password login reaches the protected shell", async ({ page }) => {
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

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("a@example.invalid");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("The protected shell is ready")).toBeVisible();
});
