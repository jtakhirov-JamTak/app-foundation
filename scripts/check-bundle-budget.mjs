import { gzipSync } from "node:zlib";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const rootHtml = await readFile(".next/server/app/index.html", "utf8");
const sources = [...rootHtml.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map(
  (match) => match[1]
);
const unique = [...new Set(sources)];

let total = 0;
for (const source of unique) {
  const path = join(".next", source.replace("/_next/", ""));
  const compressed = gzipSync(await readFile(path)).byteLength;
  if (compressed > 100 * 1024) {
    throw new Error(`${source} is ${(compressed / 1024).toFixed(1)} KiB gzip; limit is 100 KiB`);
  }
  total += compressed;
}

if (total > 180 * 1024) {
  throw new Error(`Root app-shell JS is ${(total / 1024).toFixed(1)} KiB gzip; limit is 180 KiB`);
}

console.log(`Bundle budget passed: ${(total / 1024).toFixed(1)} KiB gzip across ${unique.length} chunks.`);
