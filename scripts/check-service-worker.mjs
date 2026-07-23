import { readFile } from "node:fs/promises";

const generated = await readFile("public/sw.js", "utf8");
const appId = process.env.NEXT_PUBLIC_APP_ID ?? "application";
const version = process.env.NEXT_PUBLIC_APP_VERSION;

for (const required of ["/api/", "/offline", appId]) {
  if (!generated.includes(required)) {
    throw new Error(`Generated service worker is missing required marker: ${required}`);
  }
}

if (version && !generated.includes(version)) {
  throw new Error("Generated service worker does not include the build version");
}

console.log(`Service-worker contract verified for app ${appId}.`);
