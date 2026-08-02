import { existsSync } from "node:fs";
import { cp, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";

const sourceRoot = process.cwd();
const temp = await mkdtemp(join(tmpdir(), "application-example-removal-"));

// Scaffold deletion is no longer just two paths. Zod-derived catalog types
// cannot be extended by declaration merging, so the example's screen, error
// area, error codes and event live in the foundation catalog inside EXAMPLE-ONLY
// markers. START_NEW_APP.md tells a human to strip them; this does the same in
// the copy and then fails on any marker that survives, so a marker added to a
// file nobody listed here is caught here instead of shipping into a new app.
const MARKED_FILES = ["src/lib/analytics/catalog.ts", "src/lib/analytics/screen-registry.ts"];
const MARKER_SCAN_ROOTS = ["src", "supabase", "e2e"];

// Maintained together with MARKED_FILES: every quoted literal a marked block
// introduces belongs here, and adding a marked block means adding its literals.
//
// The marker scan below only catches a marker in a file nobody listed. It cannot
// catch the opposite mistake — a listed file whose block loses its markers —
// unless the leftover breaks something. A dangling reference does break (an
// orphaned schema entry, a path tuple the enum no longer admits, both caught by
// typecheck), but a self-contained value does not: `"example"` left in an enum
// compiles, tests, and ships. Checking the literals closes that.
//
// Token-specific rather than a repo-wide /example/i scan, which would reject the
// @example.invalid addresses the pgTAP fixtures and e2e specs legitimately use.
const FORBIDDEN_LITERALS_AFTER_STRIP = [
  '"example"',
  '"/example"',
  '"example_form"',
  '"example_record_created"',
  '"EXAMPLE_LOAD_FAILED"',
  '"EXAMPLE_SAVE_FAILED"',
];

function stripMarkedBlocks(text, path) {
  const kept = [];
  let depth = 0;
  for (const line of text.split("\n")) {
    if (line.includes("END EXAMPLE-ONLY")) {
      depth -= 1;
      if (depth < 0) throw new Error(`Unopened END EXAMPLE-ONLY marker in ${path}`);
      continue;
    }
    if (line.includes("EXAMPLE-ONLY")) {
      depth += 1;
      continue;
    }
    if (depth === 0) kept.push(line);
  }
  if (depth !== 0) throw new Error(`Unclosed EXAMPLE-ONLY marker in ${path}`);
  // Stripping a block leaves the blank lines that surrounded it back to back,
  // which Prettier would then reject in the copy.
  return kept.join("\n").replace(/\n{3,}/g, "\n\n");
}

async function filesUnder(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await filesUnder(path)));
    else if (entry.isFile()) found.push(path);
  }
  return found;
}

// Compare exact top-level names: a substring match like "/.git" also drops
// .gitignore/.github from the copy (losing Prettier's ignore rules).
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
    await symlink(join(sourceRoot, "node_modules"), join(temp, "node_modules"), "dir");
  }
  await rm(join(temp, "src/app/(app)/(example-feature)"), { recursive: true, force: true });
  await rm(join(temp, "supabase/migrations/202607210002_example_records.sql"), {
    force: true,
  });

  for (const file of MARKED_FILES) {
    const path = join(temp, file);
    await writeFile(path, stripMarkedBlocks(await readFile(path, "utf8"), file));
  }

  const survivors = [];
  for (const root of MARKER_SCAN_ROOTS) {
    for (const path of await filesUnder(join(temp, root))) {
      if ((await readFile(path, "utf8")).includes("EXAMPLE-ONLY")) {
        survivors.push(relative(temp, path));
      }
    }
  }
  if (survivors.length > 0) {
    console.error(
      `EXAMPLE-ONLY markers survive deletion in:\n  ${survivors.join("\n  ")}\n` +
        `Add each file to MARKED_FILES in scripts/verify-example-removal.mjs and to the ` +
        `deletion step in START_NEW_APP.md.`,
    );
    process.exit(1);
  }

  const leftovers = [];
  for (const file of MARKED_FILES) {
    const text = await readFile(join(temp, file), "utf8");
    for (const literal of FORBIDDEN_LITERALS_AFTER_STRIP) {
      if (text.includes(literal)) leftovers.push(`${file}: ${literal}`);
    }
  }
  if (leftovers.length > 0) {
    console.error(
      `Example values survive the strip:\n  ${leftovers.join("\n  ")}\n` +
        `A block lost its EXAMPLE-ONLY markers, or a new one was never given any.`,
    );
    process.exit(1);
  }

  // Removing lines can leave a construct that Prettier now wants on one line,
  // so reformat exactly as START_NEW_APP.md tells a human to. Anything else the
  // deletion disturbs still has to survive the format:check below.
  const formatted = spawnSync("npx", ["--no-install", "prettier", "--write", ...MARKED_FILES], {
    cwd: temp,
    env: process.env,
    stdio: "inherit",
  });
  if (formatted.error) {
    console.error(formatted.error);
    process.exit(1);
  }
  if (formatted.status !== 0) process.exit(formatted.status ?? 1);

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
  // db:types and check:db-types are omitted too: both need a live database. The
  // copy's committed src/types/database.ts still declares the example table, which
  // is a harmless superset for typecheck; regenerating it is the START_NEW_APP.md
  // step (db:reset, db:test, db:types), not this script's job.
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
    const result = spawnSync(command, args, {
      cwd: temp,
      env,
      stdio: "inherit",
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
