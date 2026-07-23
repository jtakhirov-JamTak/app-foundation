import { createClient } from "@supabase/supabase-js";

import { loadEnvLocal } from "../scripts/load-env-local.mjs";

// Must match the credentials used by "password login reaches the protected
// shell" in e2e/auth-shell.spec.ts.
const TEST_USER_EMAIL = "a@example.invalid";
const TEST_USER_PASSWORD = "password123";

const PLACEHOLDER_URL = "https://example.supabase.co";

export default async function globalSetup() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  // Hermetic runs (placeholder URL) intercept all Supabase traffic in-page;
  // there is no real auth server to seed.
  if (!url || !secretKey || url.startsWith(PLACEHOLDER_URL)) return;

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    console.warn(
      `[global-setup] Skipping e2e user creation: NEXT_PUBLIC_SUPABASE_URL "${url}" is not a valid URL.`,
    );
    return;
  }

  // Never create fixture users on a non-local stack (e.g. a cloud project).
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    console.warn(
      `[global-setup] Skipping e2e user creation: ${url} is not a local Supabase stack ` +
        `(host must be 127.0.0.1 or localhost). ` +
        `"password login reaches the protected shell" requires ${TEST_USER_EMAIL} to exist there.`,
    );
    return;
  }

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
    },
  });

  const { error } = await admin.auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
  });

  if (!error || error.code === "email_exists") return;

  // Only the password-login spec needs this user; every other spec mocks the
  // network, so an unreachable stack should fail one test, not the whole run.
  console.warn(
    `[global-setup] Could not ensure e2e user ${TEST_USER_EMAIL} at ${url}: ${error.message}. ` +
      `If local Supabase is not running, start it with "npx supabase start"; ` +
      `"password login reaches the protected shell" will fail without this user.`,
  );
}
