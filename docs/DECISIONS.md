# Decision log

Why the foundation is built the way it is, newest first. Entries are kept verbatim,
including the measurements that settled them — a rejected optimization is only useful
if the evidence against it survives. Current-state architecture lives in
[`ARCHITECTURE.md`](../ARCHITECTURE.md); defects and their regression tests live in
[`FIX_LOG.md`](FIX_LOG.md).

### 2026-07-30 — WSL2/Linux is the only supported development environment

WSL2/Linux is the only supported development environment; native-Windows support is dropped. The four `shell: process.platform === "win32"` branches (Fix Log 2026-07-22/24), the `junction` symlink fallback, and the PowerShell command forms in `.claude/commands/` are removed — all were no-ops on Linux, so this changed no behavior on the supported platform. The fix-log entries in [`FIX_LOG.md`](FIX_LOG.md) stay as written and describe the code as it was; this entry supersedes them. What survives is platform-independent and still enforced by non-negotiable #9: spawns surface `result.error`, so a gate can never exit silently. `.gitattributes` (`* text=auto eol=lf`) is unchanged — it protects any clone regardless of the developer's `core.autocrlf`, including a WSL repo on `/mnt/c`.

### 2026-07-30 — Unauthenticated cold start is measured in Playwright

**Unauthenticated cold start is measured in Playwright, closing the gap that dropping `/` from lhci opened.** `e2e/performance.spec.ts` loads `/` with `/api/session` mocked unauthenticated, waits for the redirect and the sign-in form, and asserts LCP ≤ 2.5 s. The measurement is valid across two URLs because `AuthBoundary` uses `router.replace()` — a soft navigation, so the document survives and LCP neither resets nor rebases its timestamps. That is not an assumption: instrumenting the observer showed exactly two candidates per run, the pre-redirect shell text at ~132–144 ms and the sign-in subtitle at ~276–296 ms, so the winning entry is post-redirect content timed from the original navigation. Measured 268–408 ms across 19 local runs. **The budget is the 2.5 s field number, not a local calibration** — the same constant already used by the authenticated cold-launch test and the budgets list, so it carries one meaning everywhere; a machine-fitted threshold would read as a tighter guarantee than a shared ubuntu runner can keep. Tighten only against numbers measured on that runner. Note the ~6× headroom is against an unthrottled Playwright profile and is not comparable to a throttled Lighthouse number for the same journey (the retired lab figure was ~3.1–3.4 s).

### 2026-07-29 — Local Lighthouse TBT is not reliably measurable

Lighthouse TBT is not reliably measurable on a loaded developer machine. Observed spread within a single 3-run batch: 95 / 395 / 421 ms on `/`. LCP by contrast is stable (`/sign-in` spanned 2143–2198 ms across 5 runs), so LCP A/B tests are trustworthy locally and TBT ones are not. Compare arms back-to-back in one session — between-batch drift of ~130 ms was observed on LCP for builds that differ only by a preconnect tag. The `/` TBT budget has drifted from the 153 ms median recorded 2026-07-24 to ~300 ms; cause not established, and it predates the preconnect guard (the parent commit measured worse). Settle it on a quiet runner before recalibrating the budget.

### 2026-07-29 — experimental.inlineCss measured and rejected

**`experimental.inlineCss` was measured and rejected — do not re-attempt on LCP grounds.** `/sign-in` LCP is ~96% render delay (TTFB 454 ms · load delay 0 · load time 0 · **render delay 1566 ms**), and the LCP element is the static subtitle `<p>` in `src/app/(public)/sign-in/page.tsx` — text already present in the prerendered HTML, with no image or webfont to fetch. Inlining the stylesheet removes the only render-blocking resource, and it does improve **FCP by ~70 ms** (767 → 696 ms on `/sign-in`, 773 → 704 ms on `/`; both arms n=5, same session). **LCP does not move:** 2166 → 2161 ms, inside the ~55 ms within-batch spread. The LCP paint is gated by main-thread script evaluation (234 ms, of which `webpack-*.js` is 143 ms of scripting), not by stylesheet arrival — the 154 ms Lighthouse charges the CSS was never the binding constraint. `/` LCP also measured 274 ms worse (3144 → 3418 ms); the distributions overlap (3090–3259 vs 3172–3597) so that is suggestive rather than established, but there is a real mechanism: `/` client-redirects to `/sign-in`, so inlining ships the full 15.6 KiB of CSS in **two** documents instead of letting the second reuse the cached stylesheet. Not adopted — FCP is not a budgeted metric here, and a permanent `experimental.` flag in the template is not worth an unbudgeted gain against a possible regression on a budgeted one. The remaining `/sign-in` LCP lever is that main-thread work, which is a profiling job, not a config flag.

### 2026-07-28 — browserslist is documentation, not an optimization

`browserslist` in `package.json` records the supported floor (Chrome/Edge 111, Firefox 128, Safari/iOS 16.4) — the same floor Tailwind v4 already imposes through its generated CSS, so it excludes no browser that could render the app. **It is documentation, not an optimization:** builds before and after were byte-identical (161.8 KiB gzip across 12 chunks; `polyfills-42372ed130431b0a.js` unchanged at 112594 B). Next 16 emits its `nomodule` polyfill chunk regardless. Do not cite this key as a bundle-size measure. **Root cause of the Lighthouse `legacy-javascript` flag, measured 2026-07-29:** the flagged shims in root-shell chunk `838` (`Array.prototype.at/flat/flatMap`, `Object.hasOwn`, `Object.fromEntries`, `String.prototype.trimStart/trimEnd`) are webpack module `8456`, byte-for-byte `next/dist/build/polyfills/polyfill-module.js` — Next framework code injected unconditionally into the client entry, **1380 bytes raw**, not SWC transpilation output. No compiler target removes it; the audit's "~12 KiB" is its whole-chunk savings estimate, not the polyfill's size. The es-shims in the lockfile (`string.prototype.trimstart`, `object.fromentries`, `array.prototype.flat`) are dev-only via `eslint-config-next` and are not in the client bundle. Removing this would mean aliasing a framework-internal path in webpack config — unsupported, and out of proportion to a sub-KiB gzip saving. Do not re-attempt on bundle-size grounds.

### 2026-07-28 — Supabase preconnect in the root layout

The root layout preconnects to the `NEXT_PUBLIC_SUPABASE_URL` origin. Every client-side Supabase call sits behind a dynamic import (session-provider's auth listener and sign-out, the sign-in form's submit), so the browser would otherwise discover the origin only when the first auth request fires; the preconnect warms DNS/TLS at first paint instead. `crossOrigin="anonymous"` is required — supabase-js issues CORS fetches without cookies, and a mismatched mode opens a connection the real request cannot reuse. The origin is baked at build time, like every other `NEXT_PUBLIC_` value. This targets auth-request latency, not LCP. `preconnectOrigin` (`src/lib/env/preconnect-origin.ts`) suppresses the tag for `localhost`/`127.0.0.1`/`[::1]` and the `example.supabase.co` placeholder: a local stack has no DNS/TLS handshake to save, and the placeholder host does not resolve, so the browser would open a connection the real request can never reuse. It is a pure function so the rule is unit-testable without touching the module-scope `clientEnv` parse.

### 2026-07-22 — Timed throwaway scaffold; offline test scope

The timed throwaway scaffold removed hidden template identity from `.env.example` and CI; the final rename check now passes without extra undocumented edits. The offline browser test now verifies the cached root shell plus protected offline state rather than the separate unknown-route fallback.

### 2026-07-22 — Validated app identity and deployment mode

Validated app identity and deployment mode: `NEXT_PUBLIC_APP_ID` names caches and rate-limit namespaces from one rename point. `APP_ENV` distinguishes local/test builds from deployed production, where distributed rate limiting is mandatory. No library was added.

### 2026-07-22 — Lighthouse gates LCP/CLS and TBT; INP comes from web-vitals

Lighthouse gates LCP/CLS and TBT; actual INP is collected by `web-vitals` and checked with Chromium Event Timing because Lighthouse has no deterministic scripted interaction audit.

### 2026-07-22 — Literal scaffold validation

Literal scaffold validation made feature test/type discovery generic, removed cache-prefix assumptions, and expanded clean-removal verification.

### 2026-07-21 — The example is one route-group folder plus one migration

Example is one route-group folder plus one migration.

### 2026-07-21 — Node.js 22

Node.js 22 because current Supabase JS no longer supports Node.js 20.

### 2026-07-21 — Serwist, SWR, static shell, route-local session refresh

Serwist, SWR, static shell, route-local session refresh, authenticated-only analytics.

### 2026-07-21 — Clean template rather than stripping a product repository

Clean template instead of stripping a product repository.
