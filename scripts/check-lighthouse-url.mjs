import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// lhci can only assert on audit values, and Lighthouse's `redirects` audit sees
// HTTP redirect chains only — this app's auth redirect is client-side, so that
// audit scores a perfect 1 even when the page measured is not the page
// requested. Without this check a URL that silently starts redirecting keeps
// passing its budgets under the wrong name, which is exactly how `/` spent
// months "covering" the shell while measuring /sign-in (docs/FIX_LOG.md,
// 2026-07-29).
const REPORT_DIR = ".lighthouseci";

const normalize = (url) => url.replace(/\/$/, "");

let entries;
try {
  entries = await readdir(REPORT_DIR);
} catch {
  throw new Error(`${REPORT_DIR} not found. Run \`npx lhci autorun\` before this check.`);
}

const reports = entries.filter((file) => file.startsWith("lhr-") && file.endsWith(".json"));
if (reports.length === 0) {
  throw new Error(
    `No lhr-*.json reports in ${REPORT_DIR}. Refusing to pass vacuously — the Lighthouse run produced nothing to check.`,
  );
}

const mismatches = new Set();
for (const file of reports) {
  const { requestedUrl, finalDisplayedUrl } = JSON.parse(
    await readFile(join(REPORT_DIR, file), "utf8"),
  );
  if (normalize(requestedUrl) !== normalize(finalDisplayedUrl)) {
    mismatches.add(`${requestedUrl} -> ${finalDisplayedUrl}`);
  }
}

if (mismatches.size > 0) {
  throw new Error(
    `Lighthouse measured a different page than it requested, so its budgets do not describe the named URL:\n  ${[...mismatches].join("\n  ")}`,
  );
}

console.log(
  `Lighthouse URL contract verified: ${reports.length} run(s) measured the page they requested.`,
);
