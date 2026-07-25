import { existsSync } from "node:fs";
import { cp, mkdtemp, rm, symlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";

const sourceRoot = process.cwd();
const temp = await mkdtemp(join(tmpdir(), "application-example-removal-"));

// Compare exact top-level names: a substring match like "/.git" also drops
// .gitignore/.github from the copy (losing Prettier's ignore rules), and
// "/"-separated patterns never match Windows paths.
const excludedRootEntries = new Set(["node_modules", ".next", ".git"]);

try {
  await cp(sourceRoot, temp, {
    recursive: true,
    filter(source) {
      const [firstSegment] = relative(sourceRoot, source).split(sep);
      return !excludedRootEntries.has(firstSegment);
    },
  });

  if (existsSync(join(sourceRoot, "node_modules"))) {
    await symlink(
      join(sourceRoot, "node_modules"),
      join(temp, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );
  }
  await rm(join(temp, "src/app/(app)/(example-feature)"), { recursive: true, force: true });
  await rm(join(temp, "supabase/migrations/202607210002_example_records.sql"), {
    force: true,
  });

  const env = {
    ...process.env,
    NEXT_PUBLIC_APP_ID: process.env.NEXT_PUBLIC_APP_ID ?? "test-application",
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION ?? "removal-test",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      "sb_publishable_test_000000000000000000000000000000",
    APP_ENV: "test",
    SUPABASE_SECRET_KEY:
      process.env.SUPABASE_SECRET_KEY ?? "sb_secret_test_000000000000000000000000000000",
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ?? "https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN:
      process.env.UPSTASH_REDIS_REST_TOKEN ?? "test-token-000000000000000000000000",
  };

  // check:secrets is omitted: it enumerates files via `git ls-files` and the
  // temp copy has no .git; the copy is a subset of the workspace, whose own
  // check:secrets step already scans the identical files.
  for (const [command, args] of [
    ["npm", ["run", "format:check"]],
    ["npm", ["run", "typecheck"]],
    ["npm", ["run", "lint"]],
    ["npm", ["run", "test"]],
    ["npm", ["run", "build"]],
    ["npm", ["run", "check:bundle"]],
    ["npm", ["run", "check:sw"]],
    ["npm", ["run", "check:analytics"]],
  ]) {
    // spawnSync can't launch npm's .cmd shim on Windows without a shell; the
    // command and args are fixed literals, so shell interpolation is not a risk.
    const result = spawnSync(command, args, {
      cwd: temp,
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (result.error) {
      console.error(result.error);
      process.exit(1);
    }
    if (result.status !== 0) process.exit(result.status ?? 1);
  }

  console.log(
    "Example folder and migration delete cleanly across format, types, lint, tests, and build.",
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
