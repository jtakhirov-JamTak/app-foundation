import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ignored = new Set(["node_modules", ".next", "coverage", "public"]);
const sourceFiles = [];

async function walk(directory) {
  for (const entry of await readdir(directory)) {
    const path = join(directory, entry);
    const rel = relative(process.cwd(), path);
    if ([...ignored].some((value) => rel === value || rel.startsWith(`${value}/`))) continue;
    const info = await stat(path);
    if (info.isDirectory()) {
      await walk(path);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      sourceFiles.push(path);
    }
  }
}

await walk(join(process.cwd(), "src"));

const eventNames = new Set();
for (const path of sourceFiles) {
  const text = await readFile(path, "utf8");
  if (
    /from\s+["'](?:@sentry|posthog|segment|mixpanel)/.test(text) &&
    !path.endsWith("vendor-adapter.ts")
  ) {
    throw new Error(
      `Telemetry vendor imported outside the optional adapter: ${relative(process.cwd(), path)}`,
    );
  }

  for (const match of text.matchAll(/\btrackEvent\s*\(\s*([^,\n]+)/g)) {
    const argument = match[1]?.trim() ?? "";
    const literal = argument.match(/^["']([a-z][a-z0-9_]*)["']$/);
    if (!literal) {
      throw new Error(
        `Dynamic or non-literal trackEvent name in ${relative(process.cwd(), path)}: ${argument}`,
      );
    }
    eventNames.add(literal[1]);
  }
}

// Event-name validity is the compiler's job now: trackEvent is keyed by the
// catalog's schema map and /api/events parses a discriminated union built from
// the same map, so there is no database allowlist left to cross-check. What
// still needs a grep is the part types cannot see — a vendor SDK slipping in,
// and a computed event name that would defeat the typed key.
console.log(`Analytics contract verified for ${eventNames.size} tracked event names.`);
