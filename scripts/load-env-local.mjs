import { readFileSync } from "node:fs";
import { join } from "node:path";

// Mirrors Next.js precedence: values already present in the real environment win
// over .env.local, so CI (no file, workflow-provided vars) behaves unchanged.
export function loadEnvLocal(root = process.cwd()) {
  let content;
  try {
    content = readFileSync(join(root, ".env.local"), "utf8");
  } catch {
    return;
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
