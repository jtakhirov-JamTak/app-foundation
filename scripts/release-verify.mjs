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
    // which would leave this step permanently red. Skip on the artifact's absence
    // rather than asking every downstream app to remember an edit here — a doc note
    // is exactly the kind of manual step this gate exists to stop relying on.
    skipWhen: () => !existsSync("src/app/(app)/(example-feature)"),
    skipReason: "example feature absent",
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
  if (step.skipWhen?.()) {
    results.push({ name: step.name, status: `skipped (${step.skipReason})` });
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

process.exit(exitCode);
