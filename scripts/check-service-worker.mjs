import { readFile } from "node:fs/promises";

import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const generated = await readFile("public/sw.js", "utf8");
const appId = process.env.NEXT_PUBLIC_APP_ID ?? "application";
const version = process.env.NEXT_PUBLIC_APP_VERSION;

for (const required of ["/api/", "/offline", appId]) {
  if (!generated.includes(required)) {
    throw new Error(`Generated service worker is missing required marker: ${required}`);
  }
}

// The "/api/" marker above is also satisfied by precache manifest URLs, so it
// cannot prove the network-only policy exists. Check the manifest directly:
// no precached URL may reference /api/ or Supabase.
const precachedUrls = [...generated.matchAll(/['"]url['"]\s*:\s*['"]([^'"]+)['"]/g)].map(
  (match) => match[1],
);
if (precachedUrls.length === 0) {
  throw new Error("No precache manifest entries found in the generated service worker");
}
const forbidden = precachedUrls.filter((url) => url.includes("/api/") || url.includes("supabase"));
if (forbidden.length > 0) {
  throw new Error(`Precache manifest contains forbidden URLs:\n${forbidden.join("\n")}`);
}

if (version && !generated.includes(version)) {
  throw new Error("Generated service worker does not include the build version");
}

console.log(`Service-worker contract verified for app ${appId}.`);
