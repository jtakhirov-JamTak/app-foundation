import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

import prettier from "prettier";

import prettierConfig from "../prettier.config.mjs";

const outputPath = "src/types/database.ts";

function generatedText() {
  const inputPath = process.argv[2];
  if (inputPath && !inputPath.startsWith("--")) return readFile(inputPath, "utf8");

  // npx --no-install resolves node_modules/.bin/supabase even when this script is
  // run directly as `node scripts/sync-database-types.mjs`, not only via `npm run`.
  const result = spawnSync(
    "npx",
    ["--no-install", "supabase", "gen", "types", "typescript", "--local", "--schema", "public"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  if (result.error) {
    console.error(result.error);
    throw new Error("Supabase type generation failed");
  }
  if (result.status !== 0 || !result.stdout) {
    throw new Error("Supabase type generation failed");
  }
  return Promise.resolve(result.stdout);
}

const raw = await generatedText();

// Supabase emits semicolon-free TypeScript, which `format:check` rejects. Formatting
// here — with the same call the drift check uses — keeps db:types output format-clean
// and puts both sides of that check in one shape.
const formatted = await prettier.format(raw, { ...prettierConfig, parser: "typescript" });

await writeFile(outputPath, formatted);

console.log(`Database types written to ${outputPath}.`);
