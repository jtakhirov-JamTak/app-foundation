# Architecture

## Boundaries

### Required foundation

Static safe shell, client session gate, protected APIs, Supabase RLS, SWR memory cache, conservative service worker, typed analytics, state components, strict quality gates, and seven maintained documents (README, ARCHITECTURE, START_NEW_APP, CLAUDE.md, .claude/ENGINEERING_PLAYBOOK.md, docs/FIX_LOG.md, docs/DECISIONS.md).

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
- Client roles cannot write `events` at all; `/api/events` writes with the service role after verifying the session.
- Secrets are parsed in server-only modules.
- Production refuses to start without distributed rate-limit credentials.
- Cookie-authenticated mutations use the fail-closed origin guard copied as-is from the audited `pure-eq` pattern.
- Service-role access imports `server-only`, adapted from the audited `you-inc` pattern.
- API responses expose stable codes and request IDs, never vendor/database messages.
- CI rebuilds migrations and runs cross-user RLS tests.

## Data standard

User-owned domain tables use UUID `id` and UUID `user_id`. UTC is canonical. Calendar semantics add a validated local date and IANA timezone when needed. Common reads lead indexes with `user_id`. Uniqueness is database-enforced.

- Migrations are forward-only, and deployed migrations are immutable — correct a mistake with a new migration, never by editing a shipped one. (Template-local migrations may be edited before any app derives from them.)
- Anything filtered, sorted, joined, or aggregated gets a real column. JSONB is only for schema-validated, non-relational payloads — the `events.properties` pattern — and never a substitute for a child table.
- Enumerations are `text` plus a `CHECK` constraint, never Postgres enum types.
- Money is stored as integer minor units (cents), never floats.
- `created_at` on every domain table. `updated_at` on every domain table, maintained by the canonical `public.set_updated_at()` trigger rather than by application code. `archived_at` when archive or delete semantics exist for the entity — for user-facing domain tables this is usually yes.
- When archived rows must not block value reuse, uniqueness is a partial unique index: `CREATE UNIQUE INDEX ... ON t (user_id, lower(col)) WHERE archived_at IS NULL`.
- Stable pagination orders by a sort key plus a unique tie-breaker (`id`). A sort key alone reorders rows that share a value, so pages silently drop or repeat records.

## Generated database types

`npm run db:types` introspects the rebuilt local schema and writes the whole result, Prettier-formatted, to `src/types/database.ts` — the one generated type file, never hand-edited. CI regenerates the schema and compares the two whole files, formatting and canonicalizing both sides first, so the committed file is a drift-checked contract over the entire generated text — not a subset of it — and a formatting difference can never masquerade as schema drift. Deleting a table's migration therefore requires regenerating: reset the local database, then run `db:types` and commit the file.

## Analytics and privacy

`events` is thin, additive, and never replaces domain tables. `src/lib/analytics/catalog.ts` is the single source of event semantics: zod schemas define the enums and each event's exact properties, and every exported type — including the request schema `/api/events` parses — is derived from them. Extend the catalog by editing that file; declaration merging cannot reach zod-derived types, so there is no module-augmentation hook.

The database knows nothing about individual events. It enforces only invariants that survive any catalog: name format, object-typed properties, scalar values, a 4 KiB cap, and `public.analytics_properties_safe()` rejecting sensitive key names on word boundaries. `assertSafeEventProperties` mirrors that function, and the same accept/reject vectors are asserted in `privacy.test.ts` and in pgTAP, so the two languages cannot drift apart silently.

Because semantics are no longer checked in SQL, the write path is closed instead: `events` has no RLS policy and no client insert grant, and `/api/events` — origin, schema, privacy, session, rate limit — is the only writer, using the service role with a `user_id` taken from the verified session. The client wrapper is the only application telemetry interface, and client modules import the catalog with `import type` only so zod stays out of the browser bundle. Web Vitals are recorded only after authenticated identity is verified.

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
- Lab Lighthouse gate (`lighthouserc.cjs`, production build, mobile emulation): `/sign-in` only — LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms. Lab TBT stands in for INP, which only exists as a field metric. `/` was dropped 2026-07-30: unauthenticated `/` client-redirects to `/sign-in`, so it measured the same page twice under a misleading name. `npm run perf:lab` runs `lhci` and then `npm run check:lighthouse-url`, which fails if any collected URL redirected, so a budget can never silently describe a different page than the one it names. The pair is release-only rather than per-PR — lab numbers are the least deterministic signal available on a shared runner — and runs inside `npm run release:verify`.
- **Unauthenticated cold start (`/` → redirect → sign-in painted): LCP ≤ 2.5 s**, asserted in `e2e/performance.spec.ts`, Chromium only. lhci cannot cover this — it has no session and `/` redirects — so Playwright carries it, per [the 2026-07-29 fix-log entry](docs/FIX_LOG.md#2026-07-29--the-lighthouse-gate-never-measured-the-app-shell). One PerformanceObserver spans both URLs because `AuthBoundary` redirects with `router.replace()` (a soft navigation, so the document is never torn down and LCP never resets). Measured 268–408 ms locally across 19 runs, so ~6× headroom; the budget is the field number rather than a local calibration, which would flake on a shared runner. Re-adding `/` to `lighthouserc.cjs` once it is a real page (see `START_NEW_APP.md`) adds lab-profile coverage but is no longer the only way to measure this.
- **Before trusting a local Lighthouse number, read the two 2026-07-29 decision-log entries:** [local TBT is not reliably measurable](docs/DECISIONS.md#2026-07-29--local-lighthouse-tbt-is-not-reliably-measurable) and [inlineCss measured and rejected](docs/DECISIONS.md#2026-07-29--experimentalinlinecss-measured-and-rejected). Short version: **lab TBT is noise on a loaded developer machine — LCP is not.** One 3-run batch spanned 95 / 395 / 421 ms of TBT on `/`, while `/sign-in` LCP held 2143–2198 ms across 5 runs. So a local LCP A/B is trustworthy and a local TBT A/B is not, at any run count worth waiting for; settle TBT on a quiet runner. Always compare arms back-to-back in one session (~130 ms of between-batch LCP drift was observed on builds differing only by a preconnect tag). Also note the `/` row measures a redirect, not the shell — see [the fix-log entry](docs/FIX_LOG.md#2026-07-29--the-lighthouse-gate-never-measured-the-app-shell).

## Tests and CI

Unit tests cover schemas, privacy, origin checks, fetch error mapping, and service-worker matching. Database tests rebuild from zero and exercise cross-user isolation. Optional feature pgTAP and Playwright tests live inside their removable feature folder and are discovered by thin runner scripts. Playwright runs mobile Chromium and WebKit; per-PR CI runs mobile Chromium alone, and WebKit runs on the release path. Lighthouse uses the production build and is release-only. Security checks include secret scanning, dependency audit, telemetry import restrictions, and generated-type drift.

Gates split by cost. Every per-PR check is cheap and deterministic. Everything expensive or noisy — the second browser engine, the lab Lighthouse pass, a full database rebuild — runs through `npm run release:verify` (`scripts/release-verify.mjs`), which executes them in one fail-fast sequence and prints a pass/fail/skipped table. It must be green before any tag.

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
- Per-PR e2e runs one browser engine, so a Safari-specific regression can sit on `main` between releases; both engines run before any tag.
- Serwist currently requires Webpack in this template; Next.js development and builds use `--webpack`.

## Rejected approaches

Optimizations that were measured and turned down. Each links to the evidence, so a later session can re-argue the decision against the numbers instead of re-running the experiment.

- `experimental.inlineCss`: measured, no LCP gain, rejected 2026-07-29 → [DECISIONS.md](docs/DECISIONS.md#2026-07-29--experimentalinlinecss-measured-and-rejected).
- Extracting `useSearchParams()` out of the sign-in form to unblock prerender: A/B measured 76 ms worse, rejected 2026-07-28 → [FIX_LOG.md](docs/FIX_LOG.md#2026-07-28--investigation-usesearchparams-under-force-static-is-not-a-prerender-hazard).
- Removing Next's `legacy-javascript` polyfill shims: framework-injected, 1380 bytes raw, no supported removal path, rejected 2026-07-28 → [DECISIONS.md](docs/DECISIONS.md#2026-07-28--browserslist-is-documentation-not-an-optimization).
- `browserslist` as a bundle-size lever: builds byte-identical before and after, rejected 2026-07-28 → [DECISIONS.md](docs/DECISIONS.md#2026-07-28--browserslist-is-documentation-not-an-optimization).
- Prettier `endOfLine: "auto"` as the CRLF fix: moves the breakage downstream instead of removing it, rejected 2026-07-30 → [FIX_LOG.md](docs/FIX_LOG.md#2026-07-30--no-gitattributes-so-verify-failed-on-a-fresh-windows-clone).
- Re-adding `/` to `lighthouserc.cjs` for shell coverage: lhci holds no session, so it would measure the redirect again, rejected 2026-07-30 → [FIX_LOG.md](docs/FIX_LOG.md#2026-07-29--the-lighthouse-gate-never-measured-the-app-shell).

## Explicitly Deferred

Known gaps, recorded as decisions rather than oversights (playbook §8). Each is out of scope until a real requirement appears.

- **Account lifecycle.** Password reset, email change, and user-initiated account deletion. Sign-in and sign-out exist; the rest is per-app product surface.
- **`events` table retention policy.** The table is insert-only and grows without bound. No pruning, partitioning, or archival is defined.
- **Production observability.** No health endpoint, uptime monitoring, or error alerting. Errors are recorded as typed analytics events only; nothing pages anyone.
- **Serwist/webpack trigger.** The template builds with `--webpack` because Serwist requires it. If Next.js deprecates `--webpack`, revisit Serwist against a minimal hand-rolled service worker.

## History

- [docs/FIX_LOG.md](docs/FIX_LOG.md) — every foundation defect, its product-neutral fix, and the regression test that now guards it.
- [docs/DECISIONS.md](docs/DECISIONS.md) — why the foundation is built this way, including the measurements behind rejected optimizations.
