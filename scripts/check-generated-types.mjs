import { readFile } from "node:fs/promises";
import process from "node:process";

import prettier from "prettier";

import prettierConfig from "../prettier.config.mjs";

const committedPath = "src/types/database.ts";
const generatedPath = process.argv[2];
if (!generatedPath) {
  throw new Error("Usage: node scripts/check-generated-types.mjs <generated-database-types.ts>");
}

// Formatting is required before comparing — Supabase emits semicolon-free TypeScript,
// a token-level difference from the committed file — so both sides go through the exact
// call `db:types` writes with. Prettier alone is not enough to make the verdict
// formatting-proof: it preserves an object literal's existing multi-line expansion, so a
// hand-widened generated file stays `format:check`-clean while differing textually. Hence
// the canonical form below.
async function formatted(path) {
  return prettier.format(await readFile(path, "utf8"), {
    ...prettierConfig,
    parser: "typescript",
  });
}

// Collapse spacing, then drop the trailing `;`/`,` an expanded literal carries before its
// closing bracket — never semantic in TypeScript, and the only token that expanding or
// collapsing a literal changes. Everything else — names, types, separators between
// members, ordering — still fails the check.
function canonical(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s*[;,]\s*(?=[}\])])/g, " ")
    .trim();
}

const [committed, generated] = await Promise.all([
  formatted(committedPath),
  formatted(generatedPath),
]);

if (canonical(committed) !== canonical(generated)) {
  const committedLines = committed.split("\n");
  const generatedLines = generated.split("\n");
  // -1 means one file is a prefix of the other: the difference is the first line past its end.
  const firstMismatch = committedLines.findIndex((line, at) => line !== generatedLines[at]);
  const index = firstMismatch === -1 ? committedLines.length : firstMismatch;

  console.error(`${committedPath} does not match the rebuilt schema.`);
  console.error(`First difference near line ${index + 1}:`);
  console.error(`  committed: ${committedLines[index] ?? "<end of file>"}`);
  console.error(`  generated: ${generatedLines[index] ?? "<end of file>"}`);
  console.error(`Run \`npm run db:types\` and commit ${committedPath}.`);
  process.exit(1);
}

console.log(`${committedPath} matches the rebuilt schema.`);
