# Architecture

## Boundaries

### Required foundation

Static safe shell, client session gate, protected APIs, Supabase RLS, SWR memory cache, conservative service worker, typed analytics, state components, strict quality gates, and five maintained documents (README, ARCHITECTURE, START_NEW_APP, CLAUDE.md, .claude/ENGINEERING_PLAYBOOK.md).

### Optional modules

External error vendor, payments, AI, admin, file storage, push notifications, encrypted persistent protected-data cache, offline mutation queue, anonymous analytics, and advanced virtualization.

### Example-only

Everything under `src/app/(app)/(example-feature)` and migration `202607210002_example_records.sql`.

## Launch sequence

1. Next.js or Serwist serves static shell HTML and build assets.
2. Shell geometry and protected-navigation skeletons paint.
3. `SessionProvider` calls network-only `/api/session`.
4. The network-only session/API route refreshes Supabase cookies inside the Route Handler, so no page middleware blocks the shell.
5. Verified identity activates navigation and SWR reads.
6. Unauthenticated sessions redirect to sign-in.
7. Session failure keeps the safe shell and exposes no protected cached data.

Protected content is intentionally client-rendered after verification. Public pages remain static.

## Navigation

Next.js `Link` provides route prefetching. `useLinkStatus()` gives immediate pending feedback, copied with changes from the audited `you-inc` shell. Normal document scrolling preserves browser back-navigation behavior. A Pointer Events hook supports adjacent primary-tab swipes without per-frame React state. View Transitions are progressive enhancement only.

## Data access

Reads use typed same-origin API routes and SWR. Writes repeat validation on the server, derive `user_id` from verified claims, enforce rate limits, and rely on constraints or one SQL statement/function for retry safety. Direct browser table access is not the default.

## Security

- RLS is enabled in table-creation migrations.
- Client-reachable inserts use `WITH CHECK (auth.uid() = user_id)`.
- Events are insert-only for authenticated clients.
- Secrets are parsed in server-only modules.
- Production refuses to start without distributed rate-limit credentials.
- Cookie-authenticated mutations use the fail-closed origin guard copied as-is from the audited `pure-eq` pattern.
- Service-role access imports `server-only`, adapted from the audited `you-inc` pattern.
- API responses expose stable codes and request IDs, never vendor/database messages.
- CI rebuilds migrations and runs cross-user RLS tests.

## Data standard

User-owned domain tables use UUID `id`, UUID `user_id`, `created_at`, `updated_at`, and `archived_at`. UTC is canonical. Calendar semantics add a validated local date and IANA timezone when needed. Common reads lead indexes with `user_id`. Uniqueness is database-enforced.

## Generated database types

`npm run db:types` introspects the rebuilt local schema and splits the result into foundation types at `src/types/database.ts` and example-only types inside the removable example folder. CI regenerates the full schema contract and checks both files together. After the example folder and migration are deleted and the local database is reset, generation writes only foundation/product types to `src/types/database.ts`.

## Analytics and privacy

`events` is thin, additive, and never replaces domain tables. Event names and property shapes are compile-time allowlisted and database-allowlisted. The database validates each event’s exact keys, scalar types, and catalog values, so bypassing TypeScript cannot turn an allowed field into free text. The client wrapper is the only application telemetry interface. Event properties are capped at 4 KiB and reject sensitive key names. Web Vitals are recorded only after authenticated identity is verified.

## Error and state conventions

- Loading: dimensionally matched skeletons.
- Revalidation: keep stale data visible.
- Empty: only a successful zero-row result.
- Offline: safe shell only on fresh open; no protected service-worker cache.
- Error: stable code, optional request ID, explicit retry.
- Mutation: pending state, no duplicate submission, retained input on failure.
- Root and feature route boundaries isolate failures.

## Service worker

Serwist precaches the static shell routes, versioned build assets, manifest, and icons. API, auth, Supabase, document network requests, and all non-GET requests are never runtime-cached. Exact precached shell routes remain available offline. Unknown document failures fall back to `/offline`. Cache names include `NEXT_PUBLIC_APP_VERSION`; activation cleans old precaches.

## Performance budgets

- LCP ≤ 2.5 s at field p75.
- INP ≤ 200 ms at field p75.
- CLS ≤ 0.1 at field p75.
- Repeat-open shell ≤ 500 ms in the CI profile.
- Tap feedback ≤ 100 ms.
- 60 fps touch transition target.
- Root shell JavaScript ≤ 178 KiB gzip (`nomodule` polyfills excluded; calibrated 2026-07-22, first real build + 10%).
- No client chunk > 100 KiB gzip without documenting an exception.

## Tests and CI

Unit tests cover schemas, privacy, origin checks, fetch error mapping, and service-worker matching. Database tests rebuild from zero and exercise cross-user isolation. Optional feature pgTAP and Playwright tests live inside their removable feature folder and are discovered by thin runner scripts. Playwright runs mobile Chromium and WebKit. Lighthouse uses the production build. Security checks include secret scanning, dependency audit, telemetry import restrictions, and generated-type drift.

## Library justifications

- **Next.js:** one deployable App Router application with static routes, protected APIs, prefetching, and code splitting.
- **React + React DOM:** required UI runtime and browser renderer for Next.js.
- **Tailwind CSS + PostCSS adapter:** small mobile-first styling system already proven in both audited apps.
- **Supabase JS + SSR:** browser/server cookie clients for Auth, PostgreSQL, and RLS.
- **server-only:** compile-time guard against importing privileged modules into client bundles.
- **Zod:** shared validation at environment, request, and response boundaries.
- **SWR:** minimal stale-while-revalidate cache, request deduplication, and targeted mutation without a general state manager.
- **Serwist:** maintained service-worker generation and precache lifecycle instead of hand-written cache plumbing.
- **web-vitals:** direct self-collected LCP/INP/CLS measurement.
- **Upstash Redis + Ratelimit:** distributed per-user limits on stateless production deployments; local memory fallback is development/test only.
- **Vitest:** fast TypeScript unit and integration tests.
- **TypeScript + Node/React type packages:** strict compilation and editor/runtime API types.
- **ESLint + Next.js configs:** framework-aware correctness and Core Web Vitals lint rules.
- **Playwright:** mobile Chromium/WebKit browser verification.
- **Lighthouse CI:** lab Core Web Vitals budgets before field volume exists.
- **Prettier:** one deterministic formatter.
- **Supabase CLI:** empty-database migration replay, pgTAP tests, and generated types.

## Source provenance

### Copied as-is or nearly as-is

- The fail-closed `checkOrigin()` guard follows the audited `pure-eq` implementation.
- Browser/server/service-role Supabase client separation follows both audited repositories; the privileged client keeps the audited `server-only` boundary.
- The owner-scoped RLS policy shape with insert/update `WITH CHECK` follows `pure-eq`.
- The global recoverable error document follows the audited `pure-eq` pattern.

### Copied with changes

- Persistent mobile chrome and `Link` + `useLinkStatus()` feedback are adapted from `you-inc`; product labels and nested-scroll behavior were removed.
- Pending/failure/retry mutation states are adapted from `you-inc` and generalized in the example.
- UUID ownership, UTC timestamps, natural uniqueness, and atomic SQL patterns are adapted from both audited schemas.
- Privacy scrubbing concepts are adapted from `pure-eq`, but vendor coupling was replaced with a typed self-collected wrapper.

### Rebuilt cleanly

- Static safe-shell startup and route-local session verification.
- Serwist caching and version busting.
- SWR cache/reset behavior and back-navigation memory.
- Typed analytics catalog, insert-only events table, and Web Vitals pipeline.
- Composite testing, mobile E2E, performance, security, and database CI.
- All three foundation documents.

## Trade-offs

- Static protected shell improves repeat opens but gives up server-rendered personalized first content.
- Protected SWR cache is memory-only, so offline restarts show no user data.
- API routes add one boundary but centralize validation, rate limits, errors, and output schemas.
- SQL functions improve atomicity but require migration tests.
- Two mobile browser engines increase CI duration.
- Serwist currently requires Webpack in this template; Next.js development and builds use `--webpack`.

## Decision log

- **2026-07-21:** Clean template instead of stripping a product repository.
- **2026-07-21:** Serwist, SWR, static shell, route-local session refresh, authenticated-only analytics.
- **2026-07-21:** Node.js 22 because current Supabase JS no longer supports Node.js 20.
- **2026-07-21:** Example is one route-group folder plus one migration.
- **2026-07-22:** Literal scaffold validation made feature test/type discovery generic, removed cache-prefix assumptions, and expanded clean-removal verification.
- **2026-07-22:** Lighthouse gates LCP/CLS and TBT; actual INP is collected by `web-vitals` and checked with Chromium Event Timing because Lighthouse has no deterministic scripted interaction audit.
- **2026-07-22:** Validated app identity and deployment mode: `NEXT_PUBLIC_APP_ID` names caches and rate-limit namespaces from one rename point. `APP_ENV` distinguishes local/test builds from deployed production, where distributed rate limiting is mandatory. No library was added.
- **2026-07-22:** The timed throwaway scaffold removed hidden template identity from `.env.example` and CI; the final rename check now passes without extra undocumented edits. The offline browser test now verifies the cached root shell plus protected offline state rather than the separate unknown-route fallback.

## Foundation Fix Log

One entry per foundation bug ported from an app (playbook §4.7):

| Date       | Version | Problem                                                                                                                                                                                                                                                                                                                                                                         | Generic fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Regression test                                                                                                                                   | Found in              |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 2026-07-22 | 1.0.0   | `check:bundle` counted the `nomodule` polyfills chunk (never executed by modern browsers) and the 180 KiB budget was never calibrated against a real build                                                                                                                                                                                                                      | Exclude `nomodule` chunks from the counted total (reported as info); Supabase client dynamic-imported out of the shell; `BUNDLE_BUDGET_KIB=178` = first real build (161.8 KiB gz) + 10% headroom                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `check:bundle` in `npm run verify` is the guard                                                                                                   | app-foundation itself |
| 2026-07-22 | 1.0.0   | `npm run db:test` passed vacuously on Windows: `spawnSync("supabase", …)` can't launch the CLI's `.cmd` shim, `result.error` was never surfaced, and `process.exit` inside `try` skipped the async cleanup (stale `zz_generated_*` copies left behind)                                                                                                                          | Launch via `npx --no-install supabase test db` (`shell: true` on win32); print and fail on `result.error` / signal termination; refuse to run when `supabase/tests/` has no non-generated `.sql` file; log discovered/copied test counts and the exact command; exit only after cleanup completes                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Runner exits 1 with zero test files (guard in `run-db-tests.mjs`); 20 pgTAP tests verified green on Windows                                       | app-foundation itself |
| 2026-07-22 | 1.0.0   | `supabase db reset` wipes `auth.users`, so the password-login e2e failed with "Authentication failed" whenever the build pointed at a real local Supabase — the spec's hardcoded `example.supabase.co` token mock no longer intercepted and no fixture user existed                                                                                                             | Playwright `globalSetup` loads `.env.local` and idempotently creates `a@example.invalid` via the admin API (`email_exists` → no-op) — only when the URL host is `127.0.0.1`/`localhost`; any other host warns and skips so a cloud project never gets a fixture user (placeholder hermetic runs skip silently); an unreachable local stack warns instead of failing the whole run; the CI `mobile-e2e` job starts and resets local Supabase and builds with the started stack's credentials so the login runs for real. The persistent e2e user then collided with pgTAP fixtures inserting the same email, so SQL-layer fixtures use their own namespace (`pgtap-a@example.invalid`, `pgtap-b@example.invalid`) — SQL tests must never share identities with the e2e layer | "password login reaches the protected shell" (e2e/auth-shell.spec.ts) fails exactly when the user is missing; setup runs on every `test:e2e`      | app-foundation itself |
| 2026-07-22 | 1.0.0   | The service worker precached route-handler stub chunks (`/_next/static/chunks/app/api/*/route-*.js`) — dead weight the client never loads, and `/api/` URLs in CacheStorage; `check:sw` missed it because its `/api/` required-marker was satisfied by those same manifest URLs, and nothing asserted the manifest was clean                                                    | Add `/\/api\//` to the Serwist `exclude` list so no `/api/` path enters the precache manifest; `check:sw` now extracts every precache manifest URL and fails if any references `/api/` or Supabase (and fails if no manifest entries are found at all)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | e2e `service-worker.spec.ts` asserts no cached URL contains `/api/` or `supabase.co`; `check:sw` in `npm run verify` guards the manifest directly | app-foundation itself |
| 2026-07-22 | 1.0.0   | App-logic e2e specs raced the service worker: with `serviceWorkers: "allow"` + `clientsClaim`, the worker takes control mid-test and Playwright `page.route` mocks stop intercepting (a documented Playwright limitation), so mocked API reads/writes silently hit the real network — deterministic failures after client-side back-navigation, timing-dependent ones elsewhere | Playwright default is now `serviceWorkers: "block"`; only `service-worker.spec.ts` re-enables workers (`test.use`) and runs on Chromium, the engine Playwright supports SW in (WebKit errors internally on offline SW reload). Spec assertions on cross-request state use `expect.poll`, and the save-error assertion filters `role=alert` to the message to avoid strict-mode collision with Next's route announcer                                                                                                                                                                                                                                                                                                                                                        | SWR back-navigation revalidation test fails within seconds if a worker swallows mocked reads; full suite green on both mobile projects            | app-foundation itself |
