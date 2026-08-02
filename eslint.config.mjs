import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // A .cjs file is CommonJS by definition, so `require()` is its correct module
    // syntax rather than a lapse from ESM. Scoped to that extension alone —
    // every .mjs, .ts, and .tsx file still cannot use require. The template's
    // one .cjs file is lighthouserc.cjs, which has to resolve a Chrome path at
    // config-load time so that any `lhci` invocation works, not just `perf:lab`.
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "public/sw.js",
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
  ]),
]);
