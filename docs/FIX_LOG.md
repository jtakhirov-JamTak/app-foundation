# Foundation Fix Log

One entry per foundation bug ported from an app, per
[`.claude/ENGINEERING_PLAYBOOK.md`](../.claude/ENGINEERING_PLAYBOOK.md) §4.7:
date/version · problem · generic fix · regression test · which app found it.
Newest first. Current-state architecture lives in [`ARCHITECTURE.md`](../ARCHITECTURE.md);
design decisions live in [`DECISIONS.md`](DECISIONS.md).

### 2026-07-30 — The perf gate could assert on a non-measurement

**Version:** 1.0.0

**Problem:** **The perf gate could fail with a non-measurement instead of a number.** `e2e/performance.spec.ts` read LCP as a fixed `waitForTimeout(100)` followed by `values.at(-1) ?? Infinity`, so a run where Chromium had not yet delivered the entry read an empty array and asserted `Infinity <= 2500`. Observed 1 run in 13 under parallel worker load while calibrating the new unauthenticated test; the authenticated test had carried the same race since it was written. CI's `retries: 1` would usually hide it, which is worse than failing outright: an intermittently red gate trains people to re-run rather than investigate, and the retry that passes reports a budget as met on evidence the first attempt never produced

**Generic fix:** `readLcp` keeps the caller's settle — a later, larger paint must still be allowed to win — and then polls until at least one entry exists (5 s cap). Polling _after_ the settle can only extend the wait, never shorten it, so no measurement is lowered and a genuinely absent observer still fails. Both perf tests now share this one helper, so the fix cannot apply to one and silently miss the other

**Regression test:** `the LCP read waits for entries that land after the settle window` in `e2e/performance.spec.ts` — stubs `__lcpValues` empty and pushes an entry at 600 ms, deterministically reproducing the exact failing condition (entry arrives after the read begins); the pre-fix helper returns Infinity and fails it every run

**Found in:** app-foundation itself

### 2026-07-30 — prettier.format() is not a normalizer

**Version:** 1.0.0

**Problem:** **`prettier.format()` is not a normalizer, so "format both sides before comparing" does not make a generated-file check formatting-proof.** Replacing the database-type slicing machinery (three scripts, ~250 lines of TypeScript-compiler-API code, one `database-type-slice.json`, one per-feature `database.generated.ts`) with one whole-file comparison, the obvious design — run both sides through the same Prettier call, compare the text — was implemented and immediately failed its own proof: Prettier **preserves** an object/type literal's existing multi-line expansion, and an expanded literal carries a trailing `;`/`,` that its inline form does not. So `src/types/database.ts` widened by hand re-formats to itself, stays `prettier --check` clean, and still differs textually from `prettier.format(<fresh dump>)` — a false drift failure that `npm run verify` would not catch first

**Generic fix:** `check-generated-types.mjs` takes the verdict on a canonical form: collapse whitespace runs, then drop `;`/`,` immediately preceding `}`/`]`/`)` — never semantic in TypeScript, and the only token that expanding or collapsing a literal changes. Prettier is still run on both sides and is not optional: Supabase emits semicolon-free TypeScript, a token-level difference no whitespace rule can reconcile. Names, types, member separators, and ordering all still fail the check, which now covers the **entire** generated text (the deleted contract compared only `Tables.Row`/`Insert` and `Functions.Args`, ignoring `Update`, `Relationships`, `Returns`, `Views`, `Enums`, `CompositeTypes`)

**Regression test:** Verified in both directions before commit: `npx prettier --print-width 40 --write src/types/database.ts` then `npm run check:db-types` **passes** (formatting cannot fail the check), while deleting one column, and separately the whole `Constants` export, each **exits 1** naming the differing line — the latter being drift the deleted contract could not see

**Found in:** app-foundation itself

### 2026-07-30 — No .gitattributes, so verify failed on a fresh Windows clone

**Version:** 1.0.0

**Problem:** **The repository had no `.gitattributes`, so `npm run verify` failed on a fresh Windows clone before the scaffolder changed a line.** Git for Windows ships `core.autocrlf=true`, materialising every tracked text file with CRLF; Prettier's `endOfLine` default is `lf` and `prettier.config.mjs` sets no override, so `format:check` — the **first** step of `verify` — fails on essentially every file. Measured 2026-07-30 by cloning on Windows: `src/app/layout.tsx` came out 53/53 lines CRLF and `package.json` 82/82, with `prettier --check` failing on every file sampled. It stayed invisible here because a repo created in place keeps the LF files it was authored with and never re-materialises them — the defect only appears on the first clone or checkout, i.e. for every Windows user following `START_NEW_APP.md`. Related trap: `git checkout HEAD -- <file>` on such a machine rewrites that file as CRLF (this is how it was found, mid-session) and leaves phantom `M` entries for byte-identical files

**Generic fix:** `.gitattributes` at the repo root containing `* text=auto eol=lf` — normalises to LF in the index and checks out LF regardless of the user's `core.autocrlf`; binaries are auto-detected by `text=auto` and left alone. Followed by `git add --renormalize .`, which staged **no** content change because the index already held LF, and which also cleared the phantom `M` entries (`git update-index --refresh` does the same). Do not solve this by setting Prettier's `endOfLine` to `auto` — that would let CRLF into the index and move the breakage downstream instead of removing it

**Regression test:** `format:check` inside `npm run verify` is the standing guard; it fails loudly on any CRLF file. Verified by re-cloning after the fix: `layout.tsx` and `package.json` come out **0 CRLF** (53 and 82 LF respectively), `prettier --check` reports all files clean, and `public/icon-192.png` is byte-identical to source, confirming binaries were not mangled

**Found in:** app-foundation itself

### 2026-07-29 — The Lighthouse gate never measured the app shell

**Version:** 1.0.0

**Problem:** **The Lighthouse gate has never measured the app shell, despite appearing to.** Unauthenticated `/` client-redirects to `/sign-in?next=%2F`, so both URLs in `lighthouserc.cjs` measure the sign-in page — one of them with a redirect hop added. The signed-in shell has **zero** lab perf coverage. `/`'s budgets (LCP ≤ 3400 ms, TBT ≤ 200 ms) are therefore calibrated against the redirect artifact rather than any real page, which makes the currently-red `/` TBT assertion a failure of the artifact. `lighthouserc.cjs:23-25` documents the redirect in a comment, but nothing _asserts_ `finalDisplayedUrl`, so if `/` ever stopped redirecting the same budgets would silently begin measuring a different page under the same name

**Generic fix:** **Shipped 2026-07-30:** `/` dropped from `lighthouserc.cjs`. Removing duplicate coverage of the same page is not relaxing a budget — and any `/` number calibrated in the template is invalidated the moment a downstream app makes `/` a real page, so there was nothing worth preserving. The `/` TBT assertion was deleted along with the URL that produced it, not loosened. `finalDisplayedUrl` is now asserted by `npm run check:lighthouse-url` (`scripts/check-lighthouse-url.mjs`), running after `lhci autorun` in the `performance-pwa` job; it fails if any collected URL redirected, and refuses to pass when `.lighthouseci` is missing or empty so a skipped Lighthouse run cannot green it. It has to be a script because lhci asserts only on audit values and Lighthouse's `redirects` audit sees HTTP chains alone — a client-side auth redirect scores a perfect 1, which is precisely why this went unnoticed. **Shell perf will come from Playwright, not lhci — do not re-argue this as an lhci gap:** lhci cannot hold an authenticated session, while `e2e/performance.spec.ts` already collects LCP/INP through PerformanceObserver against a signed-in page and is the place to extend

**Regression test:** `npm run check:lighthouse-url`, wired into CI directly after `lhci`. Verified against the defect it describes: run on the retained reports where `/` was still collected it exits 1 with `http://127.0.0.1:3200/ -> http://127.0.0.1:3200/sign-in?next=%2F`; re-run after dropping `/` it reports 3/3 runs measuring the page they requested. Post-change gate on `/sign-in`: LCP median 2070 ms, TBT median 113 ms, CLS 0, performance 0.98–0.99

**Found in:** app-foundation itself

### 2026-07-28 — Investigation: useSearchParams() under force-static is not a prerender hazard

**Version:** 1.0.0

**Problem:** **Investigation, no product change.** `/sign-in` showed Lighthouse LCP ~2.0-2.1 s with ~1.6 s "render delay", diagnosed as `useSearchParams()` in `sign-in-form.tsx` forcing its Suspense boundary to client-render on a `force-static` page and shipping the form as a hydration-gated skeleton. **That diagnosis is wrong.** Under `export const dynamic = "force-static"`, Next 16 returns empty search params during prerender instead of bailing out: the unmodified build’s `.next/server/app/sign-in.html` already contains both `<input>` fields and zero skeletons, the Lighthouse filmstrip shows the card fully painted at 750 ms (Speed Index 0.8 s), and the LCP element is the intro `<p>`, not the form. The 1.6 s is a re-emitted LCP candidate on an element already on screen at FCP (~770 ms), not a delayed paint

**Generic fix:** None shipped. The proposed fix (extract the `?error=confirmation` read into its own client component + Suspense so the form prerenders) was implemented and A/B measured with `lhci autorun`, 3 runs per arm on one machine: `/sign-in` median LCP **2193 ms → 2269 ms** (76 ms _worse_, inside run-to-run spread), render delay 1732 → 1806 ms. Reverted. **Do not re-attempt this refactor on LCP grounds** — `useSearchParams()` under `force-static` is not a prerender hazard. Separately, Lighthouse CLI `<host>_<date>.report.html` artifacts are now gitignored (same class as the `/session-context.md` row: untracked local state at the repo root breaks `prettier --check .`)

**Regression test:** Three tests added to `e2e/auth-shell.spec.ts`: a `javaScriptEnabled: false` test asserting the sign-in fields are in the server-delivered HTML with zero skeletons (documents the invariant — it passes on unmodified code, so it is NOT a regression test), plus first coverage for `?error=confirmation` and `?next=`. When reading `lhci` output, group by `requestedUrl`: unauthenticated `/` redirects to `/sign-in`, so `finalDisplayedUrl` silently merges two populations

**Found in:** app-foundation itself

### 2026-07-24 — verify:sw-version-bust left public/sw.js stamped with a synthetic version

**Version:** 1.0.0

**Problem:** CI `performance-pwa` (first run ever — previously gated behind red `quality`) failed at `check:sw`: `verify:sw-version-bust` builds twice with synthetic versions and left `public/sw.js` stamped `cache-contract-v2`, which the next step compared against the workflow's `ci-<sha>` version; the script also spawned `npm` without a shell (unrunnable on Windows, fourth `.cmd`-shim instance)

**Generic fix:** `verify-sw-version-bust.mjs` runs a final restore build with the ambient `NEXT_PUBLIC_APP_VERSION` (no override), so any later step — `check:sw`, e2e, Lighthouse — sees the same artifacts a plain `npm run build` produces; spawns use `shell: true` on win32 with `result.error` surfaced

**Regression test:** `npm run verify:sw-version-bust` followed by `npm run check:sw` (CI's exact step order) green locally

**Found in:** app-foundation itself

### 2026-07-24 — CI security was permanently red on the dev dependency graph

**Version:** 1.0.0

**Problem:** CI `security` was permanently red: `npm audit --audit-level=high` gated the full graph, where dev-tool chains (eslint/@lhci/cli via `brace-expansion`/`tmp`) have no in-range fix, and `next` pins vulnerable transitives (`postcss` 8.4.31, `sharp` <0.35) so prod highs reported "no fix available"

**Generic fix:** Real fix for runtime deps: package.json `overrides` force patched `postcss` 8.5.22 and `sharp` 0.35.0 under `next` (app never imports `next/image`, so sharp is never loaded at runtime); gate re-scoped to `npm audit --omit=dev --audit-level=high` so it blocks on the shippable graph — 0 vulnerabilities — while dev-graph advisories are reviewed via /dep-audit. Note: changing `overrides` does not re-resolve existing lockfile nodes; run `npm update <pkg>` to reify

**Regression test:** `npm audit --omit=dev --audit-level=high` exits 0 and remains the CI guard; full build + e2e green against the overridden postcss/sharp

**Found in:** app-foundation itself

### 2026-07-24 — db:types was broken on Windows, so CI failed the drift check

**Version:** 1.0.0

**Problem:** CI `database` failed the generated-types drift check: migrations define `analytics_event_valid()` but committed types were never regenerated, because `npm run db:types` was broken on Windows (`spawnSync("supabase")` can't launch the `.cmd` shim — same class as the db:test runner bug) and additionally hard-required the `__InternalSupabase` member that Supabase CLI 2.109.1 does not emit

**Generic fix:** `sync-database-types.mjs` launches via `npx --no-install supabase` with `shell: true` on win32 and surfaces `result.error`; `__InternalSupabase` is carried through when present instead of required; types regenerated so `analytics_event_valid` is in the committed contract

**Regression test:** `check-generated-types.mjs` against a fresh `supabase gen types` run passes locally and is the CI guard

**Found in:** app-foundation itself

### 2026-07-24 — verify:example-removal dropped .gitignore from the copy

**Version:** 1.0.0

**Problem:** CI `quality` failed inside `verify:example-removal`: the temp-copy filter matched the substring `/.git`, which also dropped `.gitignore` (and `.github`) from the copy, so Prettier lost its ignore rules and `format:check` flagged the build-generated `public/sw.js`; the `/`-separated substrings also never match Windows paths, so the script was unrunnable locally on win32 (`spawnSync("npm")` can't launch the `.cmd` shim and exited 1 with no output, `dir` symlinks need elevation)

**Generic fix:** Filter compares exact top-level entry names (`node_modules`, `.next`, `.git`) using `path.relative` + `path.sep`; node_modules symlink uses `junction` and spawns use `shell: true` on win32 with `result.error` surfaced, so the script runs cross-platform; its `check:secrets` step is omitted (it enumerates via `git ls-files`, impossible in the `.git`-less copy — the workspace's own check:secrets step already scans the identical files)

**Regression test:** `npm run verify:example-removal` green locally on Windows — fails within seconds if `.gitignore` is missing from the copy because `format:check` hits generated artifacts

**Found in:** app-foundation itself

### 2026-07-24 — format:check failed on untracked session-context.md

**Version:** 1.0.0

**Problem:** `npm run verify` failed on `format:check` because `session-context.md` — Claude Code's local session state, same class as `.claude/settings.local.json` — sat untracked at the project root where `prettier --check .` scans it

**Generic fix:** Gitignore `/session-context.md`; Prettier 3 reads `.gitignore` by default, so this removes the file from both version control and `format:check` scope

**Regression test:** `npx prettier --file-info session-context.md` reports `ignored: true`; `npm run verify` green with the file present

**Found in:** app-foundation itself

### 2026-07-24 — One uncalibrated Lighthouse LCP budget for every URL

**Version:** 1.0.0

**Problem:** The Lighthouse gate applied one uncalibrated 2500 ms LCP budget to every URL: unauthenticated `/` client-redirects to `/sign-in`, so its lab LCP includes the redirect hop and failed at ~3.1 s while `/sign-in` itself passed; `/` TBT also sat at 191–226 ms against the 200 ms budget because the trace hydrates both the shell and the post-redirect sign-in page, whose chunk statically bundled `@supabase/ssr`

**Generic fix:** Per-URL `assertMatrix` in `lighthouserc.cjs` (`.cjs` so the calibration comment survives — JSON cannot carry one): `/sign-in` keeps LCP ≤ 2500 ms as the real unauthenticated entry point; `/` gets a documented 3400 ms budget (first real run median 3098 ms + ~10%). The sign-in form now dynamic-imports the Supabase client at submit time (same pattern and rationale as `session-provider`), cutting `/sign-in` LCP ~2.4 s → ~2.05 s and `/` median TBT 196 → 153 ms

**Regression test:** `npx lhci autorun` green on all 6 runs post-change; "password login reaches the protected shell" (e2e/auth-shell.spec.ts) exercises the deferred-import submit path on both mobile projects

**Found in:** app-foundation itself

### 2026-07-22 — App-logic e2e specs raced the service worker

**Version:** 1.0.0

**Problem:** App-logic e2e specs raced the service worker: with `serviceWorkers: "allow"` + `clientsClaim`, the worker takes control mid-test and Playwright `page.route` mocks stop intercepting (a documented Playwright limitation), so mocked API reads/writes silently hit the real network — deterministic failures after client-side back-navigation, timing-dependent ones elsewhere

**Generic fix:** Playwright default is now `serviceWorkers: "block"`; only `service-worker.spec.ts` re-enables workers (`test.use`) and runs on Chromium, the engine Playwright supports SW in (WebKit errors internally on offline SW reload). Spec assertions on cross-request state use `expect.poll`, and the save-error assertion filters `role=alert` to the message to avoid strict-mode collision with Next's route announcer

**Regression test:** SWR back-navigation revalidation test fails within seconds if a worker swallows mocked reads; full suite green on both mobile projects

**Found in:** app-foundation itself

### 2026-07-22 — The service worker precached route-handler stubs

**Version:** 1.0.0

**Problem:** The service worker precached route-handler stub chunks (`/_next/static/chunks/app/api/*/route-*.js`) — dead weight the client never loads, and `/api/` URLs in CacheStorage; `check:sw` missed it because its `/api/` required-marker was satisfied by those same manifest URLs, and nothing asserted the manifest was clean

**Generic fix:** Add `/\/api\//` to the Serwist `exclude` list so no `/api/` path enters the precache manifest; `check:sw` now extracts every precache manifest URL and fails if any references `/api/` or Supabase (and fails if no manifest entries are found at all)

**Regression test:** e2e `service-worker.spec.ts` asserts no cached URL contains `/api/` or `supabase.co`; `check:sw` in `npm run verify` guards the manifest directly

**Found in:** app-foundation itself

### 2026-07-22 — db reset wiped the e2e fixture user

**Version:** 1.0.0

**Problem:** `supabase db reset` wipes `auth.users`, so the password-login e2e failed with "Authentication failed" whenever the build pointed at a real local Supabase — the spec's hardcoded `example.supabase.co` token mock no longer intercepted and no fixture user existed

**Generic fix:** Playwright `globalSetup` loads `.env.local` and idempotently creates `a@example.invalid` via the admin API (`email_exists` → no-op) — only when the URL host is `127.0.0.1`/`localhost`; any other host warns and skips so a cloud project never gets a fixture user (placeholder hermetic runs skip silently); an unreachable local stack warns instead of failing the whole run; the CI `mobile-e2e` job starts and resets local Supabase and builds with the started stack's credentials so the login runs for real. The persistent e2e user then collided with pgTAP fixtures inserting the same email, so SQL-layer fixtures use their own namespace (`pgtap-a@example.invalid`, `pgtap-b@example.invalid`) — SQL tests must never share identities with the e2e layer

**Regression test:** "password login reaches the protected shell" (e2e/auth-shell.spec.ts) fails exactly when the user is missing; setup runs on every `test:e2e`

**Found in:** app-foundation itself

### 2026-07-22 — npm run db:test passed vacuously on Windows

**Version:** 1.0.0

**Problem:** `npm run db:test` passed vacuously on Windows: `spawnSync("supabase", …)` can't launch the CLI's `.cmd` shim, `result.error` was never surfaced, and `process.exit` inside `try` skipped the async cleanup (stale `zz_generated_*` copies left behind)

**Generic fix:** Launch via `npx --no-install supabase test db` (`shell: true` on win32); print and fail on `result.error` / signal termination; refuse to run when `supabase/tests/` has no non-generated `.sql` file; log discovered/copied test counts and the exact command; exit only after cleanup completes

**Regression test:** Runner exits 1 with zero test files (guard in `run-db-tests.mjs`); 20 pgTAP tests verified green on Windows

**Found in:** app-foundation itself

### 2026-07-22 — check:bundle counted the nomodule polyfills chunk

**Version:** 1.0.0

**Problem:** `check:bundle` counted the `nomodule` polyfills chunk (never executed by modern browsers) and the 180 KiB budget was never calibrated against a real build

**Generic fix:** Exclude `nomodule` chunks from the counted total (reported as info); Supabase client dynamic-imported out of the shell; `BUNDLE_BUDGET_KIB=178` = first real build (161.8 KiB gz) + 10% headroom

**Regression test:** `check:bundle` in `npm run verify` is the guard

**Found in:** app-foundation itself
