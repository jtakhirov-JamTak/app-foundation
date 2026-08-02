import { readFile } from "node:fs/promises";

import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const generated = await readFile("public/sw.js", "utf8");
const appId = process.env.NEXT_PUBLIC_APP_ID ?? "application";
const version = process.env.NEXT_PUBLIC_APP_VERSION;
if (!version) {
  throw new Error(
    "NEXT_PUBLIC_APP_VERSION is unset. Refusing to pass vacuously — this check proves the " +
      "service-worker cache id tracks the build version, which is unprovable without it.",
  );
}
const cacheId = `${appId}-${version}`;

for (const required of ["/api/", "/offline"]) {
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

// One build is enough to prove cache names bust on release. `src/app/sw.ts` builds
// its cacheId as `${NEXT_PUBLIC_APP_ID}-${NEXT_PUBLIC_APP_VERSION}` from two inlined
// literals, so the bundler constant-folds it into a single string in the output.
// Asserting that exact string for the env this build ran with fails the moment the
// cache id stops tracking the version — hardcoded, dropped, or renamed — which is what
// the retired three-build verify:sw-version-bust existed to catch. CI builds with a
// distinct `ci-<sha>` version every run, so a stale or synthetic id cannot slip past.
// This also subsumes the appId marker: the cache id contains it by construction.
if (!generated.includes(cacheId)) {
  throw new Error(
    `Generated service worker does not use the cache id ${cacheId} derived from ` +
      "NEXT_PUBLIC_APP_ID and NEXT_PUBLIC_APP_VERSION. Either the build ran with different " +
      "env values than this check, or src/app/sw.ts no longer derives cacheId from them — " +
      "in which case cached assets survive a release instead of busting.",
  );
}

console.log(
  `Service-worker contract verified for cache id ${cacheId} across ${precachedUrls.length} precache entries.`,
);
