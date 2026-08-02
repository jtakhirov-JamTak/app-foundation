import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

// The release gate. Per-PR CI is deliberately cheap and deterministic: it runs one
// browser engine and no lab performance pass. Everything demoted off that path runs
// here instead, in one mechanical sequence, so a tag can never ship without it.
//
// Order is load-bearing. `verify` ends with the production build that `test:e2e`
// and `perf:lab` serve via `npm run start`, and that `check:sw` reads out of
// public/sw.js. Playwright serves on 3100 and Lighthouse on 3200
// (lighthouserc.cjs), and steps run one at a time, so the two servers never collide.
//
// db:reset and db:test need Docker and the local Supabase stack already running.
// This script does not start them — it fails loudly and names the step instead.

// Every surface START_NEW_APP.md's scaffold step removes. The e2e spec is nested
// inside the feature folder, so it is listed separately on purpose: it catches a
// deletion that took `_tests/` but kept the folder, which the folder check alone
// would read as "still present" and the folder's absence would mask.
const EXAMPLE_SURFACES = [
  "src/app/(app)/(example-feature)",
  "supabase/migrations/202607210002_example_records.sql",
  "src/app/(app)/(example-feature)/_tests/example-feature.spec.ts",
];

// All present -> run. None present -> the app has been scaffolded, skip. Anything
// in between is a half-finished deletion, which is precisely the state
// verify:example-removal exists to catch, so it must fail rather than skip — a
// single-sentinel check would have skipped silently and shipped the leftovers.
function exampleRemovalPrecheck() {
  const present = EXAMPLE_SURFACES.filter((surface) => existsSync(surface));
  if (present.length === 0) return { action: "skip", reason: "example feature absent" };
  if (present.length === EXAMPLE_SURFACES.length) return { action: "run" };
  return {
    action: "fail",
    reason: `example partially deleted, still present: ${present.join(", ")}`,
  };
}

const STEPS = [
  { name: "verify", args: ["run", "verify"] },
  { name: "db:reset", args: ["run", "db:reset"] },
  { name: "db:test", args: ["run", "db:test"] },
  // Both Playwright projects on purpose. Per-PR CI runs mobile-chromium only, so
  // this is the only place mobile-webkit runs before a tag.
  { name: "test:e2e", args: ["run", "test:e2e"] },
  { name: "perf:lab", args: ["run", "perf:lab"] },
  { name: "check:sw", args: ["run", "check:sw"] },
  {
    name: "verify:example-removal",
    args: ["run", "verify:example-removal"],
    // A derived app deletes the example feature at scaffold time (START_NEW_APP.md),
    // which would leave this step permanently red. Decide on the artifacts rather
    // than asking every downstream app to remember an edit here — a doc note is
    // exactly the kind of manual step this gate exists to stop relying on.
    precheck: exampleRemovalPrecheck,
  },
];

const results = [];
let failedStep = null;
let exitCode = 0;

for (const step of STEPS) {
  const command = `npm ${step.args.join(" ")}`;

  if (failedStep) {
    results.push({ name: step.name, status: `skipped (${failedStep} failed first)` });
    continue;
  }
  const verdict = step.precheck?.() ?? { action: "run" };
  if (verdict.action === "skip") {
    results.push({ name: step.name, status: `skipped (${verdict.reason})` });
    continue;
  }
  if (verdict.action === "fail") {
    console.error(`release:verify: ${step.name} cannot run — ${verdict.reason}`);
    results.push({ name: step.name, status: "FAIL (precondition)" });
    failedStep = step.name;
    exitCode = 1;
    continue;
  }

  console.log(`\nrelease:verify: running \`${command}\``);
  const startedAt = Date.now();
  const result = spawnSync("npm", step.args, { stdio: "inherit" });
  const elapsed = `${Math.round((Date.now() - startedAt) / 1000)}s`;

  // Non-negotiable #9: a spawn that never launched must never read as a pass.
  if (result.error) {
    console.error(`release:verify: failed to launch \`${command}\`: ${result.error.message}`);
    results.push({ name: step.name, status: "FAIL (could not launch)", elapsed });
    failedStep = step.name;
    exitCode = 1;
  } else if (result.status === null) {
    console.error(`release:verify: \`${command}\` was terminated by signal ${result.signal}`);
    results.push({ name: step.name, status: `FAIL (signal ${result.signal})`, elapsed });
    failedStep = step.name;
    exitCode = 1;
  } else if (result.status !== 0) {
    results.push({ name: step.name, status: `FAIL (exit ${result.status})`, elapsed });
    failedStep = step.name;
    exitCode = result.status;
  } else {
    results.push({ name: step.name, status: "pass", elapsed });
  }
}

// Printed on both paths: a release gate has to say what ran, what failed, and what it
// never got to, not just exit with a code.
const nameWidth = Math.max(...results.map((step) => step.name.length), "Step".length);
const statusWidth = Math.max(...results.map((step) => step.status.length), "Result".length);
console.log(`\n${"Step".padEnd(nameWidth)}  ${"Result".padEnd(statusWidth)}  Time`);
console.log(`${"-".repeat(nameWidth)}  ${"-".repeat(statusWidth)}  ----`);
for (const step of results) {
  console.log(
    `${step.name.padEnd(nameWidth)}  ${step.status.padEnd(statusWidth)}  ${step.elapsed ?? ""}`,
  );
}

const passed = results.filter((step) => step.status === "pass").length;
if (failedStep) {
  console.error(
    `\nrelease:verify FAILED at ${failedStep}. Do not tag a release until this is green.`,
  );
} else {
  console.log(`\nrelease:verify passed ${passed} of ${results.length} steps.`);
}

// Printed on both paths, and deliberately non-failing: these are human steps no
// script can prove, so gating exit code on them would only teach people to skip
// the gate. Printing is not affirming — /deploy-check requires the human to
// affirm each line explicitly before a derived app launches to real users.
console.log(`
LAUNCH BLOCKERS — mandatory checklist; do not launch a derived app to real
users without affirming every item in /deploy-check:
[ ] Password recovery flow (forgot-password entry, recovery email, new-password screen)
[ ] Production SMTP configured and test email delivered
[ ] External uptime monitor on a real public route
[ ] Error sink or notification path for server exceptions
[ ] Dependency-aware health check (safe DB operation with short timeout)
[ ] Backup/restore drill executed and its result recorded (see docs/RUNBOOK_RESTORE.md)`);

process.exit(exitCode);
