import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// calibrated 2026-07-22 against first real build; regression guard, not aspiration;
// revisit if Lighthouse LCP fails.
const BUNDLE_BUDGET_KIB = 178;
const CHUNK_LIMIT_KIB = 100;

const rootHtml = await readFile(".next/server/app/index.html", "utf8");
const tags = rootHtml.matchAll(/<script\s[^>]*src="(\/_next\/static\/chunks\/[^"]+\.js)"[^>]*>/g);

const counted = new Set();
const excluded = new Set();
for (const [tag, source] of tags) {
  // nomodule chunks (polyfills) never execute in modern browsers, so they don't
  // count against the budget — reported separately below.
  (/\bnomodule\b/i.test(tag.replace(source, "")) ? excluded : counted).add(source);
}

async function gzipSize(source) {
  const path = join(".next", source.replace("/_next/", ""));
  return gzipSync(await readFile(path)).byteLength;
}

let total = 0;
for (const source of counted) {
  const compressed = await gzipSize(source);
  if (compressed > CHUNK_LIMIT_KIB * 1024) {
    throw new Error(
      `${source} is ${(compressed / 1024).toFixed(1)} KiB gzip; limit is ${CHUNK_LIMIT_KIB} KiB`,
    );
  }
  total += compressed;
}

for (const source of excluded) {
  const compressed = await gzipSize(source);
  console.log(
    `Info: excluded nomodule chunk ${source} (${(compressed / 1024).toFixed(1)} KiB gzip).`,
  );
}

if (total > BUNDLE_BUDGET_KIB * 1024) {
  throw new Error(
    `Root app-shell JS is ${(total / 1024).toFixed(1)} KiB gzip; limit is ${BUNDLE_BUDGET_KIB} KiB`,
  );
}

console.log(
  `Bundle budget passed: ${(total / 1024).toFixed(1)} KiB gzip across ${counted.size} chunks.`,
);
