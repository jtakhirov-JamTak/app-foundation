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
  const result = spawnSync("npm", ["run", "build"], {
    stdio: "inherit",
    env: { ...baseEnv, NEXT_PUBLIC_APP_VERSION: version },
  });
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

console.log("Service-worker build-version busting verified.");
