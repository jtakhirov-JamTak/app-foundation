// Lighthouse CI configuration (.cjs instead of .json so budgets can be documented).
const { tmpdir } = require("node:os");
const { join } = require("node:path");

module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run start -- -p 3200",
      startServerReadyPattern: "Ready",
      // Lighthouse launches the first Chrome it can find. On WSL2 — the only
      // supported development environment (docs/DECISIONS.md, 2026-07-30) — that
      // is the Windows Chrome reachable over /mnt/c, which the launcher starts
      // and then cannot connect to ("Unable to connect to Chrome"). This never
      // surfaced while lhci ran only on an ubuntu CI runner; it blocks the gate
      // outright now that the lab pass is release-only and therefore local.
      // Pin the Linux Chromium Playwright already installs for `npm run
      // test:e2e`, so the release path needs no second browser and no
      // per-machine CHROME_PATH.
      chromePath: process.env.CHROME_PATH || require("@playwright/test").chromium.executablePath(),
      // `/` is deliberately absent. Unauthenticated `/` client-redirects to
      // `/sign-in`, so collecting it measured the sign-in page a second time
      // with a redirect hop attached — duplicate coverage under a misleading
      // name, and any budget calibrated against it is invalidated the moment
      // `/` becomes a real page. START_NEW_APP.md carries the scaffold step to
      // add it back once that happens.
      url: ["http://127.0.0.1:3200/sign-in"],
      numberOfRuns: 3,
      settings: {
        // Second half of the same WSL2 problem. chrome-launcher branches on
        // `is-wsl`, not on which Chrome it was handed, so it Windows-formats the
        // profile path it passes as `--user-data-dir` (C:\Users\...). The Linux
        // Chromium above reads that as a *relative* path and creates a directory
        // literally named `C:\Users\...` in the repo root — which then fails
        // `prettier --check .`, so a green `perf:lab` poisons the next `verify`
        // step of the same release run. Our flag is appended after the
        // launcher's and Chromium takes the last occurrence of a switch, so this
        // wins. Keep it an absolute path outside the repo.
        chromeFlags: `--user-data-dir=${join(tmpdir(), "lighthouse-chrome-profile")}`,
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 3,
          disabled: false,
        },
      },
    },
    assert: {
      // Kept as a matrix (rather than a flat `assertions` block) so re-adding a
      // URL with its own budgets stays purely additive.
      assertMatrix: [
        {
          matchingUrlPattern: "/sign-in",
          assertions: {
            "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
            "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
            "total-blocking-time": ["error", { maxNumericValue: 200 }],
            "categories:performance": ["warn", { minScore: 0.9 }],
          },
        },
      ],
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
