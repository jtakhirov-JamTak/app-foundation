---
name: audit
description: Parameterized audit — `/audit <area>` where area is access | privacy | perf | deps | mobile | a11y | observability | db | ci. One area per invocation, whole-surface scope. For a fan-out across all areas producing one backlog use /review repo; for a diff review use /review.
---

Audit one area of the project. The first token of `$ARGUMENTS` names the area; read **only**
that section. If no area is named, list the areas and ask.

| Area            | Owns                                                                         |
| --------------- | ---------------------------------------------------------------------------- |
| `access`        | auth, user-id filtering, origin, rate-limit, RLS-in-code, gate-helper drift  |
| `privacy`       | PII inventory, sub-processors, deletion cascade, export, data-rights gaps    |
| `perf`          | N+1, unbounded reads, indexes, query plans, bundle weight, code-splitting    |
| `deps`          | vulnerabilities, outdated majors, lockfile integrity, license, provenance    |
| `mobile`        | touch targets, contrast, inputs, soft-keyboard occlusion, viewport, PWA      |
| `a11y`          | WCAG 2.2 AA — semantics, ARIA, keyboard, focus, labels, status announcements |
| `observability` | structured logs on critical paths, error-sink latching, alerting             |
| `db`            | did a migration ACTUALLY land on the live database                           |
| `ci`            | the push-triggered typecheck/lint/build fast-signal gate                     |

Boundaries worth naming, because they used to be separate files that pointed at each other:

- `mobile` owns the **device** (touch, viewport, soft-keyboard occlusion, install); `a11y` owns
  **assistive technology** (screen reader, physical keyboard, semantics). Contrast is shared —
  report it under `a11y` in WCAG terms and under `mobile` in legibility terms, and don't
  duplicate the finding.
- `observability` checks logs **exist and are structured**; `privacy` checks they **don't leak
  PII**. A log line dumping user text found here is a handoff to `privacy`, not a scrub audit.
- `access` is the enforcement sweep; the built-in `/security-review` is the generic pass.
- `deps` is supply-chain risk; unused-dependency dead weight belongs to `/review debt`.

## Reviewer conventions (apply to every area **except `db` and `ci`**)

- **Scope**: after the area token, `$ARGUMENTS` may name a file / dir / glob / symbol to narrow
  the audit; each area states its own default scope.
- **Exceptions**: read `.claude/exceptions.md` at repo root before reporting; skip matching
  entries; surface any suppressed top-severity finding at the end.
- **Caps**: honor `top=N`, `critical-only`, `high-only`, `unbounded`. Default: at most 5 LOW +
  10 MEDIUM listed individually, rest summarized (areas that use a different severity
  vocabulary say so).
- **Long-form rules**: `.claude/ENGINEERING_PLAYBOOK.md` §11.
- **Output is a report, not a fix**, in every area.

`db` and `ci` are excluded because neither produces a severity-ranked finding list — `db`
returns a PASS/FAIL count against the live database, `ci` returns a workflow file or a gap list.

---

## Area `access`

Default scope: all API routes. Audit for missing or drifting access enforcement.

### Step 0 — Discover the project's gating helpers

Before grepping for missing checks, find what "present" looks like in this codebase:

1. Locate the central gating helpers (names vary): paid-only / subscription gate; tiered or
   free-window gates (some projects have one, others two or three); admin bypass / admin-only
   gate; auth helper; origin / CSRF helper; rate-limit helper; request-body schema parser.
2. Note the exact symbol name of each — you'll grep for these, not for generic words like
   `auth`.
3. If there's no central paid/access helper and the gate logic is inlined across multiple
   routes, that itself is finding `CRITICAL #1`. Stop the per-route audit and surface the drift
   first.

### Step 1 — Enumerate

All API route files (`app/api/**`, `pages/api/**`, `routes/**`) and all server-rendered pages
whose data should be paid-only or tier-restricted.

### Step 2 — Per route, verify the pipeline

**Mutating** (`POST`/`PATCH`/`PUT`/`DELETE`): origin/CSRF check → auth helper called → rate
limit with **both** per-minute AND per-day cap (per-minute alone does not bound daily
exfiltration) → body parsed against a schema → access gate matched to the route's tier → all DB
queries filter by the _authenticated_ principal id, not a client-provided id.

**Enumeration GET** listing user-scoped data: origin check (with `Sec-Fetch-Site` fallback for
same-origin downloads where `Origin` is absent) → auth helper called → per-day read cap
(unbounded enumeration GETs are the leak path a compromised session will use) → all queries
filter by the authenticated principal id.

**Server-rendered gated page**: the access gate is called exactly once, in the page or its
layout — not duplicated across both.

### Step 3 — Verify the exclusions

Routes that should NOT be paywall-gated: auth callback / session refresh; the endpoint that
_creates_ the subscription; pre-payment onboarding writes; webhook receivers (signature
verification instead); admin routes (admin helper, not paid gate). Flag any route that _is_
gated but shouldn't be — those break first-touch flows for new users.

### Step 4 — Cross-cutting

- Inlined gate logic anywhere (raw `if (!hasAccess) return 403` scattered across routes instead
  of one helper call) — every instance is `HIGH`.
- Two variants of the gate helper used for the same tier — drift waiting to happen.
- Routes with auth but no rate limit, or rate limit but no per-day cap.
- Origin checked on POST but not on a sibling enumeration GET.
- Gate duplicated in both layout and page (double source of truth).

### Report

`CRITICAL` (unauth access / paywall bypass) · `HIGH` (policy-vs-implementation drift) ·
`MEDIUM` (missing defense-in-depth like a per-day limit) · `LOW` (style/naming). For each: file

- approximate line, the specific helper that's missing (named by the symbol from Step 0), and a
  one-line "what would go wrong" — not a fix. End with total routes audited, gaps by severity,
  and which finding to fix first.

**What "good" looks like:** a single helper, grep-able by name, called identically at the top of
every gated route. If you can answer "which routes are paid-only?" with one grep, the
architecture is right. If you have to read each route, that's the drift this audit exists to
surface.

---

## Area `privacy`

Default scope: whole repo. Output is an inventory + gap list, not legal advice. Caps here:
`critical-only` = must-have-before-launch only; `high-only` = must-have +
required-for-regulated-cohort. List every must-have and required individually; cap should-have
at 5.

### Step 0 — Discover

DB(s) and their managed-encryption posture (most managed Postgres/Mongo/RDS encrypt at rest by
default — confirm rather than assume); auth provider (managed services handle password hashing
themselves — do not grep for `bcrypt` if you're not running your own auth); AI / transcription /
payment / analytics providers and what user data goes to each; the framework, so you know where
forms, routes, and analytics tags live. Don't carry forward assumptions from other projects —
verify each.

### 1. Data collected

Walk the DB schema (or ORM models). For every column containing user-provided or user-derived
data, classify: **Identifiers** (email, phone, name, IP, device id) · **Sensitive content**
(journals, messages, emotional/health/financial data, voice, photos) · **Behavioural** (usage
logs, AI prompt history, audit events) · **Derived** (embeddings, AI summaries, scores — these
inherit the sensitivity of their source). For each: where stored, who can read it
(RLS/policies), retention default.

### 2. Data sharing

For every external provider called server- or client-side: what user data goes out (verbatim
text? hashed identifiers? metadata only?); under what circumstances (every request? on
opt-in?); whether the provider's terms permit training on customer data (**many default to
training-on and require explicit opt-out**); whether the provider is named in the privacy policy
as a sub-processor. Client-side: every analytics tag, error sink, and third-party widget is a
separate sub-processor.

### 3. User rights surface

- **Access** — can a user view all data the system holds about them?
- **Export** — endpoint returning everything in a portable format. If it exists, verify it walks
  every user-scoped table — derived snapshots and observation tables are commonly missed.
- **Correction** — can a user edit identifiers and content?
- **Deletion** — endpoint that cascades through every user-scoped table. Each user-scoped table
  should have `ON DELETE CASCADE` back to the auth user, OR the deletion endpoint walks them
  explicitly; a table with neither is a deletion gap. **Verify against the LIVE DB, not just
  migration/type files** — those drift. If a DB is reachable, run the `pg_constraint` cascade
  query from area `db` (do **NOT** use `information_schema` — it hides `auth.users` FKs from the
  query role and returns a false empty). Reading schema files is the fallback when there's no DB
  access; say which you used, and never claim "cascade verified" from files alone.
- **Portability** — export in a structured, machine-readable format.

### 4. Security measures (state for the policy)

Encryption in transit (HTTPS only; HSTS if available) · encryption at rest (name the provider) ·
password handling (managed provider + their published posture, or the hash function if
self-hosted) · session cookie flags (`Secure`, `HttpOnly`, `SameSite`) · logging — confirm
sensitive content is never logged (cross-reference the error-sink scrub config).

### 5. Retention

Default retention per table (none / N days / indefinite) · backup retention via the DB provider
· hard-delete timing for soft-deleted rows.

### Gap list

**Must have before any real users** — privacy policy, terms, deletion, breach plan.
**Required if targeting EU / UK / California / Brazil** — DSR fulfilment workflow, lawful-basis
statement, sub-processor list, data-residency commitments.
**Should have** — retention policy document, accessibility statement, security disclosures.

For each gap: severity, the specific data class or right exposed, and a one-line "what would
need to be true to close this".

### Output

1. Data inventory table (column / classification / table / retention / provider exposure)
2. Provider sub-processor list (provider / data sent / training opt-out status)
3. User-rights gap list
4. Prioritized "build before launch" list, ordered by legal risk

**Do not invent policy text.** The output is the engineering input the policy author needs.

---

## Area `perf`

Default scope: the whole repo's hot paths. `surface=data|bundle` limits which half runs.

### Discover first

The ORM / query API (Drizzle, Prisma, supabase-js/PostgREST, raw SQL), the bundler (Vite, Next,
webpack) and whether a bundle analyzer exists, the rendering model (SSR/CSR/RSC), and where the
hot paths are. Don't assume — a `db.query` pattern differs from a PostgREST `.select()` differs
from raw SQL.

### Data layer — the queries that crawl at 10×

- **N+1**: a query inside a loop / `.map` / per-row fetch. Look for awaited DB calls inside
  iteration.
- **Unbounded reads**: `.select()` / `findMany` with no `limit`. Works at 10 rows, dies at 10K.
  Every user-scoped list needs a cap or pagination.
- **Missing indexes**: any column used in `WHERE`, `ORDER BY`, or a join with no index.
  Cross-check the migrations. `(user_id, created_at DESC)` is the common one.
- **Over-fetching**: `SELECT *` when the consumer uses three columns; large `jsonb` blobs pulled
  to render a count.
- **Query plan**: for the slowest 1–2 queries, recommend `EXPLAIN ANALYZE` (or the ORM's
  logging) — don't guess seq-scan vs index-scan, measure it.
- **Sync waterfalls**: independent awaited queries that should be `Promise.all`'d — but mind the
  per-row `.error` inspection (**DB-ERROR-CHECK**, `.claude/ENGINEERING_PLAYBOOK.md` §11).

### Client bundle — what ships to the phone

- **Bundle weight**: total JS on first load; flag the largest contributors. Recommend the
  analyzer (`vite-bundle-visualizer`, `@next/bundle-analyzer`) rather than eyeballing.
- **No code-splitting**: heavy routes/components not lazy-loaded; a charting/editor lib in the
  initial chunk.
- **Heavy deps**: a multi-hundred-KB library used for one helper (moment, whole lodash, an icon
  set imported wholesale).
- **Images**: not using the framework's image primitive, or missing width/height — layout shift
  plus oversized payloads on mobile data.
- **Render-blocking**: synchronous third-party scripts, fonts without `display: swap`.

### Output

`file:line — finding — what it costs at 10× — suggested direction`. `CRITICAL` (unbounded query
on a growing table in a hot path; N+1 that multiplies with users) · `HIGH` (missing index on a
filtered hot-path column; heavy lib in the initial bundle on a mobile-first app) · `MEDIUM`
(over-fetching; missing code-split on a non-critical route; unoptimized image) · `LOW`
(micro-inefficiency with no measurable impact at current scale). End with counts, scope, the
single highest-leverage fix, and a verdict — `NO SCALING BLOCKERS` / `WATCH (n HIGH)` /
`WILL NOT SCALE (n CRITICAL)`. **State the scale assumption you judged against** (e.g. "at 10K
rows/user, 1K concurrent").

---

## Area `deps`

Scope: empty for a full sweep, or a package name to vet ("is X safe to add"). Caps: list every
CRITICAL + HIGH; cap MEDIUM at 10.

### Discover first

The package manager and lockfile (`package-lock.json`, `pnpm-lock.yaml`, `bun.lockb`,
`yarn.lock`) — the audit command and integrity check differ per manager. Read `package.json` for
declared ranges. Note the Node version so you can flag engines mismatches.

### Vulnerabilities

- Run the manager's audit (`npm audit --omit=dev` for the prod surface, then full). Report by
  severity with the advisory id and the path pulling the vulnerable transitive dep.
- For each CRITICAL/HIGH: is a fixed version available within the current major (safe bump), or
  does it need a breaking major (plan it)? **Don't auto-run `audit fix --force`** — it silently
  jumps majors.
- Distinguish **reachable** from **theoretical**: a vuln in a dev-only tool or an unused code
  path is lower priority than one in a request-handling path. Say which.

### Outdated & maintenance

Outdated majors behind the current range — flag the ones whose breaking changes block a future
upgrade if deferred. Unmaintained / deprecated packages (no release in a long time, archived
repo, deprecation notice on install). A single-maintainer dep on a critical path is a bus-factor
risk worth naming.

### Lockfile & integrity

Lockfile present and committed; `package.json` ranges and the lockfile agree (drift means
installs aren't reproducible). No integrity-hash mismatches. CI/install uses the frozen-lockfile
flag (`npm ci`, `pnpm i --frozen-lockfile`).

### License

Flag any copyleft (GPL/AGPL) or non-OSI license that conflicts with a commercial closed-source
product. A surprise AGPL transitive dep is a legal finding, not a nit.

### New-dependency provenance (when vetting a specific add)

**Typosquat** — name is a near-miss of a popular package. **Provenance** — download counts, repo
linked and matching, recent releases, more than one maintainer or a known org. **Footprint** —
large transitive tree? install scripts? A one-function need doesn't justify a 40-dep subtree.
**Alternative** — already solvable with a dep you have, or a few lines of first-party code?

### Output

`package@version — risk type — severity — reachable? — suggested action (bump within major /
plan major / replace / accept)`. `CRITICAL` (known-exploited vuln on a reachable path; AGPL on a
commercial product; confirmed typosquat) · `HIGH` (high-severity vuln reachable; unmaintained
dep on a critical path; lockfile not reproducible) · `MEDIUM` (outdated major with breaking
changes pending; dev-only vuln; large footprint for a small need) · `LOW` (cosmetic version lag,
advisory on an unreachable path). End with counts, scope, the single highest-leverage action,
and a verdict — `SUPPLY CHAIN OK` / `ATTENTION (n HIGH)` / `STOP (n CRITICAL)`. For a
single-package vet: `SAFE TO ADD` / `ADD WITH CAVEAT` / `DON'T ADD` + one-line reason.

---

## Area `mobile`

Default scope: the pages touched by uncommitted changes. Priorities here are `must fix` /
`should fix` / `nice to have` rather than CRITICAL/HIGH; `critical-only` = must-fix only,
`high-only` = must-fix + should-fix.

### Discovery first

Confirm the framework and the styling system (Tailwind, CSS Modules, styled-components,
vanilla) — class names and audit techniques differ. Note project-wide layout primitives (top
bar, bottom tab bar, safe-area handling). **If a bottom tab bar exists, every hub/list/scroll
page must reserve space for it.**

### Layout

- Nothing scrolls horizontally at a 375px viewport. Common culprits: fixed widths, oversized
  `min-width`, `whitespace-nowrap` on long strings, tables.
- ≥ 16px horizontal padding inside the viewport edges.
- Content stacks at narrow widths; no two-column layout below ~640px without a fallback.
- Bottom padding reserves space for any fixed tab bar — otherwise the last card sits behind the
  bar and is partially tappable, partially not.

### Touch targets

- Every interactive element (button, link, checkbox, radio, toggle, icon button) is ≥ 44pt (iOS)
  / 48dp (Android) on its tappable axis.
- Native `<input type="checkbox">` is ~16px — too small. Wrap the row in a `<label>` with
  `min-h-11` (or equivalent) and a pointer cursor so the entire row is the tap target.
- Subtle text links (`text-xs underline`, footer "edit"/"reset") need an inflated tap target via
  padding even when the visual size stays small.
- ≥ 8px gap between adjacent tappable elements so a thumb doesn't hit both.

### Typography and contrast

- Body / input font-size ≥ 16px. **iOS Safari zooms on focus when input font-size < 16px —
  silently breaks every form.**
- Text vs background meets WCAG AA: ≥ 4.5:1 body, ≥ 3:1 large/decorative. The default mid-grey
  utilities (`text-zinc-400`, `text-gray-400`, `#9CA3AF`-ish) fail AA at small sizes — go one or
  two shades darker.
- Headings sized for narrow screens — a 48px heading wraps awkwardly at 375px.

### Inputs and keyboard

"Keyboard" here means the **on-screen/soft keyboard** — its layout and whether it occludes
inputs. Physical-keyboard operability, focus order, and screen-reader behaviour are area
`a11y`'s job.

- Inputs use a correct `type` / `inputmode`: `email`, `tel`, `numeric`, `decimal`, `search`.
  Wrong inputmode gives users a useless keyboard.
- Textareas are tall enough to start using without growing — at least 3 lines visible.
- When an input near the bottom is focused, the mobile keyboard doesn't cover it. Test: focus
  the last form field, verify it scrolls into view. `scrollIntoView({ block: "nearest" })` on
  focus, or a bottom spacer, fixes this.
- Dropdowns and pickers that open above the keyboard need explicit scroll-into-view on open.

### Interaction model (mobile-only traps)

- Outside-click dismiss handlers use `pointerdown` (covers mouse and touch). `mousedown`
  misfires on iOS Safari and leaves popovers stuck open.
- Multi-step forms key any sensor- or media-holding component (mic, camera, picker) by the
  current step. Otherwise React reuses the instance at the same tree position and an async
  transcript can fire against the wrong field.
- Double-tap-to-submit is guarded with a `useRef` `inFlight` flag, not just a `disabled` prop —
  `disabled` is the UX, the ref is the guarantee.

### Performance feel

Skeleton placeholders for above-the-fold content, not just spinners (a spinner says "wait"; a
skeleton says "almost there") · images use the framework's image primitive or have explicit
width/height to prevent layout shift · lists don't block the page while loading — render the
chrome immediately, fill in the list.

### PWA / standalone

If the app is installable, the manifest has `name`, `short_name`, `start_url`,
`display: standalone`, `theme_color`, `background_color`, and at minimum 192px and 512px icons.
Theme colour matches the actual top-bar colour — a mismatch makes the standalone install look
broken. No browser chrome leaks in standalone mode (no visible address bar, no body
scroll-bounce showing a different colour underneath).

### Output

`file (or component) — what's wrong in plain English — what to change — priority`. End with a
one-line verdict: `mobile-ready` / `needs work (n must-fix)` / `not mobile-ready`.

---

## Area `a11y`

Default scope: the pages touched by uncommitted changes. Priorities: `must fix` (blocks an AT
user from completing a task) / `should fix` (degrades but doesn't block) / `minor` (polish);
`critical-only` = blocks-AT-users only.

### Discover first

Confirm the framework and component library — a UI kit may handle focus/ARIA for you, or may
not. Note whether the app is a mobile-first PWA: the same DOM serves AT users on desktop and
mobile, so a keyboard/SR gap ships to everyone.

### Perceivable

- **Text alternatives** (1.1.1): every `<img>`/icon/media has alt text, or `alt=""` +
  `aria-hidden` if decorative. Icon-only buttons have an accessible name.
- **Info & relationships** (1.3.1): structure is semantic — `<button>` not `<div onClick>`,
  `<nav>/<main>/<header>`, real lists, `<label>`-bound inputs. Heading levels don't skip (h1→h3).
- **Contrast** (1.4.3): text ≥ 4.5:1, large text / UI components & focus indicators ≥ 3:1.
  **Cite the failing pair.**
- **Reflow / text spacing** (1.4.10/1.4.12): content survives 200% zoom and increased spacing
  without clipping.

### Operable

- **Keyboard** (2.1.1/2.1.2): every interactive element reachable and operable by keyboard; no
  focus traps; custom widgets (menus, dialogs, comboboxes) implement the expected key handling.
- **Focus order & visible focus** (2.4.3/2.4.7): tab order follows reading order; focus is
  always visible (no `outline: none` without a replacement); on dialog open, focus moves in and
  is restored on close.
- **Target size** (2.5.8, AA): pointer targets ≥ 24×24 CSS px — the WCAG AA floor, which is
  _below_ the 44/48 guideline area `mobile` enforces. Cite both bars where relevant; don't
  duplicate the finding.
- **Bypass blocks** (2.4.1): a skip-link or landmark structure to bypass repeated nav.

### Understandable

- **Labels & instructions** (3.3.2): inputs have persistent visible labels — a placeholder is
  not a label.
- **Error identification & suggestion** (3.3.1/3.3.3): errors are announced to AT (`aria-live` /
  `role="alert"` / `aria-invalid` + described-by), not colour-only, and say how to fix.
- **On-focus / on-input** (3.2.1/3.2.2): focusing or changing a field doesn't trigger a surprise
  context change.

### Robust

- **Name/role/value** (4.1.2): custom controls expose correct role + state (`aria-expanded`,
  `aria-checked`, `aria-selected`).
- **Status messages** (4.1.3): async results (saved, error, count updated) reach an `aria-live`
  region.

### Output

`file / component — WCAG SC — what an AT user experiences — what to change — priority`. End with
counts by priority, scope, the single highest-leverage fix, and a verdict —
`WCAG AA: conformant on this surface` / `gaps (n must-fix)` / `not conformant`.

---

## Area `observability`

Default scope: the whole repo's critical paths. `stage=prelaunch|scaling` sets the bar.
Priorities: `must have` (for the stated stage) / `should have` / `later`. List every must-have;
cap should-have at 5.

### Set the bar — stage-aware, anti-over-engineering

Establish the stage first (ask if unclear). A full APM build on a pre-launch solo app is
over-engineering the staff-reviewer would reject:

- **Pre-launch / first users**: structured logs on critical paths, an error sink that actually
  captures, and 2–4 alerts on the paths that cost money or lock users out. That's it. Do **not**
  recommend tracing/SLO/dashboards here.
- **Scaling / paid traffic**: add metrics (rate/error/duration on hot endpoints), distributed
  traces across the AI/DB hops, dashboards, and SLOs with error budgets.

**State the stage you judged against.**

### Critical-path instrumentation

- Identify the paths that page you: auth, payment/entitlement webhook, AI-spend endpoints, DB
  writes on derived data. Each should emit a structured event (level, event name, correlation
  id, user id — **never user content**) on both success and failure.
- Failures are distinguishable: a `{ data, error }` branch that returns silently
  (**DB-ERROR-CHECK**, `.claude/ENGINEERING_PLAYBOOK.md` §11) is invisible to ops as well as to
  the user. An uninspected `.error` is both a correctness bug and an observability hole.

### Error sink

Configured and receiving (DSN/endpoint set in the deploy target) · per-request capture paths are
**cooldown-latched** — a per-request `captureException` in a fallback/catch exhausts the quota
during an outage and buries the one signal that mattered (module-level `lastCaptureAt` + N-min
cooldown) · severity/tagging lets you find the kind — a tag per failure mode, not one
undifferentiated stream.

### Alerting

An alert exists for: auth failure spike · payment/entitlement write failure · AI-spend anomaly
(cost runaway) · DB error rate · **the error-sink-is-silent case** (no events ≠ healthy; could
be a broken sink). Alerts route somewhere a human sees within the window that matters. Note
alert-fatigue risk: too many low-signal alerts and the real one gets muted.

### Scaling stage only

Metrics on hot paths (RED: rate/errors/duration) · traces spanning the slow multi-hop calls · a
dashboard for the critical user journey · SLOs with an error budget that someone owns.

### Output

`path / area — what you'd be blind to — stage it's required at — suggested instrumentation`. End
with counts by priority, the stage judged against, the single highest-leverage instrumentation
to add, and a verdict — `we'd know at 2am` / `partial blind spots (n must-have)` /
`flying blind (n must-have on money/auth)`.

---

## Area `db`

**Not a code sweep — a live-database verification.** Argument after the area token: a migration
file path, a migration number, or empty (defaults to the most recent migration on disk). May
also name specific tables/columns to check directly. The reviewer-conventions block above does
not apply: this returns a PASS/FAIL count, not a severity-ranked list.

This exists because **idempotent `add column if not exists` blocks are silently skippable** —
when SQL is pasted into a web editor and only part of it is highlighted-and-run, the skipped
statements report no error and the migration looks "applied" while a column is missing. The
symptom is a production write failing with `column ... does not exist` even though the migration
file is in `main` and was "run twice."

### Step 1 — Determine the expected schema objects

- If given a migration file/number, read it. If empty, find the highest-numbered file under the
  migrations dir (`supabase/migrations/`, `prisma/migrations/`, `drizzle/`) and read it.
- Extract every schema object the migration is supposed to create:
  - `ALTER TABLE x ADD COLUMN [IF NOT EXISTS] col ...` → expect `(x, col)`
  - `CREATE TABLE [IF NOT EXISTS] x ...` → expect table `x` + each column
  - `CREATE [UNIQUE] INDEX [IF NOT EXISTS] i ...` → expect index `i`
  - `CREATE POLICY p ON x ...` / `ENABLE ROW LEVEL SECURITY` → expect policy / RLS flag
- **Ignore `comment on ...` statements** — comments aren't schema objects `information_schema`
  tracks as present/absent, and a missing comment is not a functional bug. Tell the user
  explicitly: "this checks the N columns/tables/indexes the migration creates, not the M comment
  statements." Comments targeting _pre-existing_ columns are doubly out of scope.
- Build the **expected set** as an explicit list with a known total count. **State the count out
  loud** — it's the number the verification query must return.

### Step 2 — Generate the verification queries

Emit TWO queries the user runs once each. The **assertion** query is primary — it returns a
single PASS/FAIL row so the user never has to count by hand (manual counting is the exact error
the partial-paste incident turned on). The **listing** query shows _which_ object is missing
when the assertion fails.

Assertion (one row — read the `status` cell):

```sql
-- status should read 'OK'. Anything else = a statement was skipped (usually a partial paste).
select count(*) as found, <N> as expected,
       case when count(*) = <N> then 'OK'
            else 'MISSING ' || (<N> - count(*))::text end as status
from information_schema.columns
where (table_name, column_name) in (
  ('prepare_entries','neutral_check_question'),
  ('prepare_entries','default_pattern')
  -- ...one tuple per expected (table, column)
);
```

Listing (run only if status isn't OK — shows what landed so you can see the gap):

```sql
select table_name, column_name
from information_schema.columns
where (table_name, column_name) in ( /* same tuples */ )
order by table_name, column_name;
```

For indexes: `select indexname from pg_indexes where indexname in (...);`
For RLS: `select relname, relrowsecurity from pg_class where relname in (...);`
For policies: `select policyname, tablename from pg_policies where tablename in (...);`
For table existence: `select to_regclass('public.<table>') is not null;`

For FK delete rules (especially verifying `on delete cascade` to `auth.users` — e.g. before
trusting an account-deletion cascade): use **`pg_constraint`, NOT `information_schema`**.
`information_schema.referential_constraints` / `constraint_column_usage` **HIDE** constraints
that reference `auth.users` from the query role (privilege filtering) and return empty — a
silent false negative. Use:

```sql
select con.conrelid::regclass as table_name,
       case con.confdeltype when 'c' then 'CASCADE' when 'a' then 'NO ACTION'
            when 'n' then 'SET NULL' when 'r' then 'RESTRICT' else con.confdeltype::text end as on_delete
from pg_constraint con
join pg_class rel on rel.oid = con.confrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where con.contype = 'f' and nsp.nspname = 'auth' and rel.relname = 'users';
```

### Step 3 — Generate copy-paste remediation

For each object that could be missing, emit a self-contained, idempotent remediation block
ending in a PostgREST cache reload. **Crucial for Supabase:** a column can exist but the API
still 500s for up to ~10 min on a stale schema cache, so **always pair the DDL with the
reload**:

```sql
alter table public.<table> add column if not exists <col> <type>;
comment on column public.<table>.<col> is '<what it is>';  -- if the migration set one
notify pgrst, 'reload schema';
```

Then re-run the Step 2 verification query to confirm the count is now correct.

### Step 4 — Walk the (likely non-technical) user through it

The user typically pastes into the Supabase SQL Editor. Be explicit:

1. "Paste the **assertion** query below and run it. Read the `status` cell: it should say
   **`OK`**. If it says `MISSING n`, that many statements were skipped — almost always a partial
   paste."
2. "If it's not OK, run the **listing** query to see which objects landed, then run the
   remediation block."
3. "Re-run the assertion query until `status` reads `OK`."
4. Only after `status` is `OK`: "Test the action that was failing — it should work now."

### Step 5 — If a Supabase MCP / CLI is connected, do it directly

If the Supabase MCP server or CLI is authenticated in this session, run the verification query
yourself and report actual vs expected instead of asking the user to paste. If not, produce the
copy-paste blocks — **never claim a migration is verified that you couldn't actually query.**

**Do NOT trust a migration-tracking table as proof.** Supabase `list_migrations` (and
`supabase_migrations.schema_migrations`) stays EMPTY when migrations are applied by pasting SQL
into the web editor — the common case for a non-technical operator. An empty list does NOT mean
"nothing applied"; it means the tracker wasn't used. Always verify the actual schema OBJECTS
(`information_schema` / `pg_constraint` / `to_regclass`), never the tracker. (Confirmed
2026-06-08: `list_migrations` returned `[]` while all 45 migrations' objects were present on the
live DB.)

### Output

The expected-objects list with its total count · the assertion + listing queries · remediation
block(s), each ending in `notify pgrst, 'reload schema';` · a one-line verdict:
`VERIFIED (<N>/<N> present)`, `INCOMPLETE (<M>/<N> — run remediation)`, or `UNVERIFIED (no DB
access — user must run the query)`.

### Note for migration authors

The durable fix is to make every migration self-verifying: append a final
`DO $$ BEGIN IF (select count(*) ... ) <> <N> THEN RAISE EXCEPTION '...'; END IF; END $$;` block
so a partial paste _errors loudly_ instead of silently succeeding. Suggest adding this to the
migration template if the project doesn't have it.

---

## Area `ci`

Set up or audit a lightweight CI pipeline. Target / provider follows the area token. Like `db`,
this returns a workflow file or a gap list rather than a severity-ranked report.

### The bar — earlier signal, not a heavy gate

This is deliberately thin. The job is to move the **typecheck / lint / build** signal earlier —
from "the deploy provider fails the deploy" to "the push fails CI a minute sooner, with lint
included." For a solo founder on commit-straight-to-main + auto-deploy, that's the whole
marginal value. Don't over-build it.

**What this does NOT add (yet):** test-suite gating. There's no point gating on a suite that
doesn't exist. (Template-derived apps ship with a green suite — gate tests from day one; this
deferral applies only to legacy repos without one.) The moment `/test` produces a green suite,
come back and add the `test` job — that's the planned second pass, not a gap to apologize for.
**State this split explicitly in the output so the deferral is a recorded decision.**

### Discover first

The host/CI platform — check for an existing `.github/workflows/` or equivalent before creating
one · the package manager + lockfile (drives the install step and the frozen-lockfile flag) ·
the real script names in `package.json` — **reuse the same commands `npm run verify`
discovers**, so CI and local verification run identical steps rather than drifting · whether the
deploy provider already runs a build, so CI's build step is about _earlier_ signal + lint, and
you say that rather than implying prod is unprotected.

### Audit mode (a workflow already exists)

Right trigger (push to main + PRs)? · frozen-lockfile install (`npm ci` / `--frozen-lockfile`)?
· typecheck AND lint AND build, or is one silently missing? · Node version pinned to match the
deploy target? · secrets referenced correctly, not echoed into logs? · fast enough to be useful
(cached `node_modules` / framework build cache)?

### Setup mode (no workflow yet)

Propose a minimal workflow that: (1) triggers on push to the default branch + pull requests; (2)
checks out, sets up the pinned Node version, installs with the frozen-lockfile flag (cached);
(3) runs typecheck → lint → build, failing on any error, mirroring the `npm run verify` step
order; (4) leaves a clearly-marked, commented-out `test` job stub with a one-line note:
"uncomment once /test produces a green suite."

Show the YAML, explain each step in plain language (the founder is non-technical), and note that
committing it doesn't change deploy behaviour — it adds a check, it doesn't block the deploy
provider.

### Output

**Audit mode**: gaps found (missing step / wrong trigger / no lockfile freeze / no cache),
ranked, each with the one-line fix. **Setup mode**: the workflow file, a plain-language
walkthrough, and the explicit "build/lint/typecheck now; test-gating deferred to a green suite"
note. End with a verdict: `CI COVERS THE FAST SIGNAL` / `GAPS (list)` /
`NO CI — workflow proposed above`, plus the one deferred item (test-gating) and its unblock
trigger.

$ARGUMENTS
