import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, test } from "vitest";

import { loadEnvLocal } from "./load-env-local.mjs";

const touchedKeys = [
  "ENV_LOCAL_TEST_PLAIN",
  "ENV_LOCAL_TEST_DOUBLE_QUOTED",
  "ENV_LOCAL_TEST_SINGLE_QUOTED",
  "ENV_LOCAL_TEST_PRESET",
  "ENV_LOCAL_TEST_SPACED",
];
const tempRoots = [];

afterEach(() => {
  for (const key of touchedKeys) delete process.env[key];
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function rootWithEnvLocal(content) {
  const root = mkdtempSync(join(tmpdir(), "load-env-local-"));
  tempRoots.push(root);
  writeFileSync(join(root, ".env.local"), content);
  return root;
}

test("loads values missing from process.env, ignoring comments and blanks", () => {
  const root = rootWithEnvLocal(
    [
      "# comment line",
      "",
      "ENV_LOCAL_TEST_PLAIN=plain-value",
      'ENV_LOCAL_TEST_DOUBLE_QUOTED="double quoted"',
      "ENV_LOCAL_TEST_SINGLE_QUOTED='single quoted'",
      "ENV_LOCAL_TEST_SPACED = spaced-value ",
    ].join("\n"),
  );

  loadEnvLocal(root);

  expect(process.env.ENV_LOCAL_TEST_PLAIN).toBe("plain-value");
  expect(process.env.ENV_LOCAL_TEST_DOUBLE_QUOTED).toBe("double quoted");
  expect(process.env.ENV_LOCAL_TEST_SINGLE_QUOTED).toBe("single quoted");
  expect(process.env.ENV_LOCAL_TEST_SPACED).toBe("spaced-value");
});

test("real environment variables win over .env.local", () => {
  process.env.ENV_LOCAL_TEST_PRESET = "from-environment";
  const root = rootWithEnvLocal("ENV_LOCAL_TEST_PRESET=from-file\n");

  loadEnvLocal(root);

  expect(process.env.ENV_LOCAL_TEST_PRESET).toBe("from-environment");
});

test("missing .env.local is skipped silently", () => {
  const root = mkdtempSync(join(tmpdir(), "load-env-local-"));
  tempRoots.push(root);

  expect(() => loadEnvLocal(root)).not.toThrow();
  expect(process.env.ENV_LOCAL_TEST_PLAIN).toBeUndefined();
});
