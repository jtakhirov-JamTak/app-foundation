import { readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { relative, resolve } from "node:path";

const suspicious = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/,
  /\bsb_secret_(?!(?:test|ci|replace)[_-])[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/,
  /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /(?:SUPABASE_SECRET_KEY|UPSTASH_REDIS_REST_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY|STRIPE_SECRET_KEY)\s*=\s*(?!(?:replace|test|ci)-)[^\s#]{20,}/
];

const result = spawnSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "buffer" }
);

if (result.status !== 0 || !result.stdout) {
  throw new Error("Secret scan requires a Git working tree");
}

const files = result.stdout
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .filter((path) => path !== "public/sw.js");

for (const file of files) {
  const path = resolve(file);
  const info = await stat(path).catch(() => null);
  if (!info?.isFile() || info.size >= 2_000_000) continue;

  const text = await readFile(path, "utf8").catch(() => "");
  for (const pattern of suspicious) {
    if (pattern.test(text)) {
      throw new Error(`Potential secret found in ${relative(process.cwd(), path)}`);
    }
  }
}

console.log(`No secret patterns found in ${files.length} committed or unignored files.`);
