import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename, join, sep } from "node:path";

const generated = [];

async function discover(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await discover(path);
    } else if (entry.name.endsWith(".sql") && path.split(sep).includes("_tests")) {
      generated.push(path);
    }
  }
}

await discover(join(process.cwd(), "src", "app"));

const testsDirectory = join(process.cwd(), "supabase", "tests");
await mkdir(testsDirectory, { recursive: true });

// The foundation RLS suite must exist; a runner that finds nothing to run must
// fail, never pass. Generated copies (zz_generated_*) don't count — they may be
// stale leftovers from an interrupted run.
const foundationTests = (await readdir(testsDirectory)).filter(
  (name) => name.endsWith(".sql") && !name.startsWith("zz_generated_"),
);
if (foundationTests.length === 0) {
  console.error(
    "db:test: no .sql test files in supabase/tests/ — the foundation RLS suite is missing. Failing instead of reporting a vacuous pass.",
  );
  process.exit(1);
}

console.log(
  `db:test: ${foundationTests.length} test file(s) in supabase/tests/, ${generated.length} generated feature test(s) discovered under src/app.`,
);

const copied = [];
let exitCode = 1;
try {
  for (const [index, source] of generated.entries()) {
    const target = join(
      testsDirectory,
      `zz_generated_${String(index + 1).padStart(3, "0")}_${basename(source)}`,
    );
    await cp(source, target);
    copied.push(target);
  }
  if (copied.length > 0) {
    console.log(`db:test: copied ${copied.length} generated test(s) into supabase/tests/.`);
  }

  // npx --no-install resolves node_modules/.bin/supabase even when this script is
  // run directly as `node scripts/run-db-tests.mjs`, not only via `npm run`.
  const command = ["npx", "--no-install", "supabase", "test", "db"];
  console.log(`db:test: running \`${command.join(" ")}\``);
  const result = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`db:test: failed to launch the Supabase CLI: ${result.error.message}`);
  } else if (result.status === null) {
    console.error(`db:test: Supabase CLI was terminated by signal ${result.signal}`);
  } else {
    exitCode = result.status;
  }
} finally {
  await Promise.all(copied.map((path) => rm(path, { force: true })));
}
process.exit(exitCode);
