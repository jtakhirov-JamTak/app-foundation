import { createRequire } from "node:module";
import { isAbsolute } from "node:path";

import { describe, expect, it } from "vitest";

// Regression tests for the 2026-08-02 defect (docs/FIX_LOG.md). Both assertions
// describe the config, not the machine, so they hold on a CI runner that has
// never installed a browser: the defect was lhci choosing the wrong Chrome and
// the wrong profile path, not a missing install.
const require = createRequire(import.meta.url);
const { collect } = require("../lighthouserc.cjs").ci;

describe("lighthouserc collect", () => {
  it("pins a Linux Chrome rather than one mounted from the Windows host", () => {
    // Left unpinned, chrome-launcher finds the Windows Chrome over /mnt/c and
    // starts it; under WSL2 the DevTools port it opens lives on the Windows
    // host's loopback, so the launcher then fails with ECONNREFUSED.
    expect(collect.chromePath).toBeTruthy();
    expect(isAbsolute(collect.chromePath)).toBe(true);
    expect(collect.chromePath.startsWith("/mnt/")).toBe(false);
  });

  it("pins an absolute Chrome profile directory outside the repository", () => {
    // chrome-launcher branches on `is-wsl`, not on which Chrome it was handed,
    // so it Windows-formats the --user-data-dir it passes. A Linux Chromium
    // reads that as a relative path and creates `C:\Users\...` in the repo root,
    // which fails `prettier --check .` on the next step of the same release run.
    const match = /--user-data-dir=(\S+)/.exec(collect.settings.chromeFlags ?? "");
    expect(match).not.toBeNull();

    const profileDir = match[1];
    expect(isAbsolute(profileDir)).toBe(true);
    expect(profileDir.startsWith(process.cwd())).toBe(false);
  });
});
