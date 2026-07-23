import { existsSync } from "node:fs";
import { cp, mkdtemp, rm, symlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sourceRoot = process.cwd();
const temp = await mkdtemp(join(tmpdir(), "application-example-removal-"));

try {
  await cp(sourceRoot, temp, {
    recursive: true,
    filter(source) {
      return (
        !source.includes("/node_modules") &&
        !source.includes("/.next") &&
        !source.includes("/.git")
      );
    }
  });

  if (existsSync(join(sourceRoot, "node_modules"))) {
    await symlink(join(sourceRoot, "node_modules"), join(temp, "node_modules"), "dir");
  }
  await rm(join(temp, "src/app/(app)/(example-feature)"), { recursive: true, force: true });
  await rm(join(temp, "supabase/migrations/202607210002_example_records.sql"), {
    force: true
  });

  const env = {
    ...process.env,
    NEXT_PUBLIC_APP_ID: process.env.NEXT_PUBLIC_APP_ID ?? "test-application",
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION ?? "removal-test",
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      "sb_publishable_test_000000000000000000000000000000",
    APP_ENV: "test",
    SUPABASE_SECRET_KEY:
      process.env.SUPABASE_SECRET_KEY ?? "sb_secret_test_000000000000000000000000000000",
    UPSTASH_REDIS_REST_URL:
      process.env.UPSTASH_REDIS_REST_URL ?? "https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN:
      process.env.UPSTASH_REDIS_REST_TOKEN ?? "test-token-000000000000000000000000"
  };

  for (const [command, args] of [
    ["npm", ["run", "format:check"]],
    ["npm", ["run", "typecheck"]],
    ["npm", ["run", "lint"]],
    ["npm", ["run", "test"]],
    ["npm", ["run", "build"]],
    ["npm", ["run", "check:bundle"]],
    ["npm", ["run", "check:sw"]],
    ["npm", ["run", "check:analytics"]],
    ["npm", ["run", "check:secrets"]]
  ]) {
    const result = spawnSync(command, args, {
      cwd: temp,
      env,
      stdio: "inherit"
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }

  console.log("Example folder and migration delete cleanly across format, types, lint, tests, and build.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
