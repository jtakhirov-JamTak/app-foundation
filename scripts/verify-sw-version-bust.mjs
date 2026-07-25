import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const baseEnv = {
  ...process.env,
  NEXT_PUBLIC_APP_ID: process.env.NEXT_PUBLIC_APP_ID ?? "test-application",
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "sb_publishable_test_000000000000000000000000000000",
  APP_ENV: "test",
  SUPABASE_SECRET_KEY:
    process.env.SUPABASE_SECRET_KEY ?? "sb_secret_test_000000000000000000000000000000",
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ?? "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN:
    process.env.UPSTASH_REDIS_REST_TOKEN ?? "test-token-000000000000000000000000",
};

function build(version) {
  // spawnSync can't launch npm's .cmd shim on Windows without a shell; the
  // command and args are fixed literals, so shell interpolation is not a risk.
  const result = spawnSync("npm", ["run", "build"], {
    stdio: "inherit",
    // The restore build must match a plain `npm run build` exactly, so it
    // gets untouched process.env and Next resolves .env.local itself;
    // baseEnv's hermetic defaults would override .env.local values.
    env: version ? { ...baseEnv, NEXT_PUBLIC_APP_VERSION: version } : process.env,
    shell: process.platform === "win32",
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

build("cache-contract-v1");
const first = await readFile("public/sw.js", "utf8");
if (!first.includes("cache-contract-v1")) {
  throw new Error("First service worker does not contain its build version");
}

build("cache-contract-v2");
const second = await readFile("public/sw.js", "utf8");
if (!second.includes("cache-contract-v2") || second.includes("cache-contract-v1")) {
  throw new Error("Service-worker cache version did not bust cleanly");
}

// Rebuild with the ambient version: later steps (check:sw, e2e, Lighthouse)
// read public/sw.js and .next and must not see the synthetic
// cache-contract versions this script leaves behind.
build();

console.log("Service-worker build-version busting verified.");
