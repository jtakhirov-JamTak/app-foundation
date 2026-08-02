---
name: review
description: Review pass over code — `/review` (default: uncommitted diff) · `/review pipeline` (multi-reviewer pipeline on the diff, with fix loop) · `/review repo` (whole-repo audit fan-out, one deduplicated backlog) · `/review debt` (dead-code / dead-UI / duplication sweep, approve-before-fix). NOT adversarial break-it scenarios (use /grill); NOT a fix (use /fix-bug); NOT a single ship gate (use /deploy-check).
---

Pick the mode from the first token of `$ARGUMENTS`; default is `changes`.

| Mode                | Scope                  | Job                                                          |
| ------------------- | ---------------------- | ------------------------------------------------------------ |
| `changes` (default) | uncommitted diff       | severity-ranked correctness / pattern / consistency findings |
| `pipeline`          | uncommitted diff       | orchestrated multi-reviewer pass + offer to fix              |
| `repo`              | whole repo, clean tree | parallel audit fan-out → one deduplicated backlog            |
| `debt`              | whole repo             | dead code, dead UI, duplication → approve → fix              |

## Reviewer conventions (apply to every mode, and propagate to every sub-step)

- **Scope**: `$ARGUMENTS` may name a file / dir / glob / symbol after the mode token, which
  overrides the mode's default scope and propagates to every sub-step.
- **Exceptions**: read `.claude/exceptions.md` at repo root before reporting; skip matching
  entries; surface any suppressed CRITICAL at the end. In `pipeline` and `repo` mode the
  consolidated report surfaces the total suppressed across all sub-steps.
- **Caps**: honor `top=N`, `critical-only`, `high-only`, `unbounded`. In `pipeline`/`repo` the
  cap applies to the _consolidated_ report, not per sub-step — duplicates are collapsed before
  the cap. Default: at most 5 LOW + 10 MEDIUM listed individually, rest summarized.
- **Long-form rules**: `.claude/ENGINEERING_PLAYBOOK.md` §11.

---

# Mode `changes` — review the uncommitted diff

## Step 0 — Read the diff

```
git diff --stat
git diff
```

Skim once for scope. If the diff is large, group changes by file family before reviewing (auth
changes, schema changes, UI changes).

## Step 1 — Discover before judging

For any change that calls a project helper (auth, gate, validation, rate limit, error sink),
confirm the helper exists and is being used per the existing convention. Find the nearest
sibling that does the same thing — that's the standard the new change should match.

Do not flag missing helpers without checking whether the project even has one. "Should use rate
limiter" is noise if the project has no rate limiter abstraction yet — flag the architectural
gap instead, separately.

## Step 2 — Per-change checks

### Correctness

- Logic errors: off-by-one, inverted conditions, wrong operator (`>` vs `>=` on timestamp
  comparisons is a recurring trap).
- Null and empty: how does this behave on `null`, `""`, `[]`, `undefined`? Whitespace-only
  strings pass truthy checks — `.trim()` before `.length`.
- Async: stale closures over state, missing `await`, unhandled rejection paths, double-fire
  under React strict mode or under retry.
- Error returns vs throws: apply **DB-ERROR-CHECK** (`.claude/ENGINEERING_PLAYBOOK.md` §11) —
  `{ data, error }` calls don't throw on RLS/schema drift; every one needs `.error` inspection,
  and `Promise.all` over writes must collect + inspect each result.
- Link/route integrity (mechanical): apply **LINK-RESOLVE** (§11) — every internal target the
  change adds or touches resolves to a page that exists on disk; a dangling target is a live
  404 → HIGH. Don't eyeball it; resolve each one.

### Security

- Auth check present at the entry of every new authenticated route.
- User-scoped queries filter by the authenticated principal id, not a client-provided value.
- Origin / CSRF check on mutating routes AND on enumeration GETs.
- Rate limits cover both per-minute and per-day for any expensive or sensitive endpoint.
- User text is delimited from instructions in AI prompts, not concatenated raw.
- New env vars accessed without a runtime guard will crash at runtime, not build time —
  `process.env.X!` patterns need a startup check.

### Data exposure

- Can this query return another user's row? If RLS is the only barrier, is it enabled and
  non-permissive?
- Are error messages or logs about to ship user content into the error sink? Cross-check the
  scrub config.

### Patterns / consistency

- Does this match how the nearest sibling does the same thing?
- Is the new abstraction earning its weight, or is it three lines pretending to be a framework?
- Does the change introduce a second source of truth for something the codebase already
  centralizes (gating, validation, formatting)?

### UX

- Loading and error states present.
- Error paths offer a next action.
- Expensive input survives a gate: apply **GATE-PRESERVE** (§11). A `router.push("/paywall")`
  in a submit handler "offers a next action" but still destroys the user's filled multi-step
  form — flag it HIGH separately from the loading/error-state bullets above.
- Mobile tap targets ≥ 44pt / 48dp; input font-size ≥ 16px.

### Simplicity

- Could a sibling helper be reused?
- Is the change reverting a pattern the codebase already converged on?

## Step 3 — Report

Severity-ranked:

- `CRITICAL` — paywall bypass, unauth access, cross-user data leak, data loss, irreversible
  action without confirmation.
- `HIGH` — silent failure paths, missing error handling on writes, divergence from a
  centralized helper.
- `MEDIUM` — missing rate cap, mobile tap-target failure, inconsistent pattern, missing index
  on a filterable column.
- `LOW` — naming, comments, dead branches.

For each finding: `file:line — one-line description — suggested change`.

End with: total by severity, and one-line verdict — `SHIP IT` /
`NEEDS WORK (n CRITICAL, n HIGH)` / `STOP (CRITICAL)`. If `STOP`, name the blocker first.

---

# Mode `pipeline` — full multi-reviewer pass on the diff

Each step is conditional — skip categories that don't apply. Stop the pipeline on any
verification failure; reviewing code that doesn't compile is wasted work.

## Step 0 — Triage the diff

```
git diff --stat
```

Classify the changes:

- **UI/page changes** → `/audit mobile` AND `/audit a11y` apply
- **API route / handler changes** → security review applies
- **DB / schema / migration changes** → schema-specific review applies (cascade, RLS,
  constraints, indexes)
- **New/changed queries, large reads, or client-bundle additions** → `/audit perf` applies
- **AI prompt / model config changes** → `/ai-prompt-review` applies
- **Data-flow changes (new field collected, new provider called)** → `/audit privacy` applies
- **Backend-only refactor with no behaviour change** → most categories don't apply;
  verification + simplifier may be enough

Note which categories you're running and which you're skipping, with one-line rationale.

## Steps

1. **Verification (always).** Run the `npm run verify` agent (type check → lint → unit tests →
   production build, stop-on-first-failure, max 2 fix attempts per step, explicit
   ran-vs-skipped report). If FAIL, **stop the pipeline.** Don't re-implement the sequence
   here; the agent owns it.
2. **Simplifier (always, unless the diff is trivial).** Run `/simplify` (built-in) — surface
   new code that's verbose, over-abstracted, or re-derived from a sibling helper. Collect,
   don't fix.
3. **Adversarial (always).** Run `/grill`. Work the taxonomy. Output: severity-ranked failure
   scenarios.
4. **Code review (always).** Run mode `changes` above.
5. **Security (conditional — any API, auth, schema, or data-flow change).** Run
   `/security-review` (built-in). Check: auth at entry, user-id filtering, origin check,
   rate-limit (per-min AND per-day), schema validation, sensitive-data exposure, AI prompt
   injection delimiting, secrets.
6. **AI-prompt (conditional — any AI prompt, output schema, or model-config change).** Run
   `/ai-prompt-review`. This is the surface step 5's generic security pass doesn't know your
   discipline for.
7. **Architecture (conditional — new abstraction, helper, table, or cross-module dependency).**
   Question whether the new abstraction earns its weight, whether it duplicates a centralized
   helper, whether the data model holds at expected scale.
8. **Performance (conditional).** `/audit perf` scoped to the changed surface.
9. **Mobile (conditional — UI only).** `/audit mobile` on the changed pages.
10. **Accessibility (conditional — UI only).** `/audit a11y` on the changed pages.
11. **Privacy (conditional — new field collected, new provider called, or error-sink/logging
    change).** `/audit privacy` scoped to the changed surface.

## Consolidate

Merge findings from all steps, deduplicating across reviewers — `/grill` and mode `changes`
will often surface the same issue from different angles; **keep the more specific one.** Group
by severity (`CRITICAL` ship blockers / `HIGH` silent failure, helper drift, gate bypass /
`MEDIUM` defense-in-depth, mobile fails, missing index / `LOW` style, naming, dead branches).
For each: source-step / file:line / one-line / suggested fix.

## Verdict

`READY TO SHIP` (no CRITICAL or HIGH) / `NEEDS WORK` (list HIGH/CRITICAL by number) /
`STOP — VERIFICATION FAILED`.

## Offer to fix

If `NEEDS WORK`, ask: "Which numbered findings should I fix? Reply with numbers, 'all
CRITICAL', or 'all'." For each picked item: run `/fix-bug`, re-run **only** the step(s) that
surfaced it, confirm, move on. Don't re-run the whole pipeline after each fix — only re-verify
at the end if multiple fixes shipped.

---

# Mode `repo` — whole-repo audit fan-out

The periodic "is the whole app healthy" sweep. It operates on the **whole repo**, not a diff —
the diff-scoped reviewers (mode `changes`, mode `pipeline`, `/grill`, the built-in
`/code-review` and `/security-review`) do nothing useful here on a clean tree.

## Why this mode exists (read before editing it)

Running `/deploy-check scope=full` is NOT equivalent. `deploy-check` folds the sub-audits in
_by prose reference_ and skims — in practice it misses what the dedicated areas catch
(dependency CVEs, the missing focus indicator, the silent-failure observability gaps). This
mode fixes that failure mode by **spawning each audit area as its own agent that actually runs
it**, then synthesizing. Do not "optimize" it back into a single by-reference pass.

Two structural facts this mode encodes:

1. **The whole code-level suite is blind to live DB state.** Every area infers
   schema/RLS/migration-applied from the repo. `/audit db` against the live database is the
   mandatory final step, not optional.
2. **Genuine cross-area overlap is small.** The only real duplication is the launch-residue
   pass ∩ `/audit privacy` on _account-deletion / privacy-policy / data-export_. The webhook
   and auth-callback get touched by several areas, but each examines a _different property_
   (correct vs untested vs unalerted vs access-safe) — that's coverage, keep it. Synthesis
   dedups the former and preserves the latter.

## Phase 0 — Verification gate (first, inline)

Run the `npm run verify` agent. If it FAILs, report and **stop** — auditing a repo that doesn't
build wastes the fan-out. Don't proceed until green (or the user says audit-anyway).

## Phase 1 — Fan out as parallel agents (single message, multiple Agent calls)

Dispatch as **concurrent** general-purpose agents. Every agent prompt must say: **REPORT ONLY —
no edits, no fixes, no commits**; and must return
`AREA / FOCUS / FINDINGS (severity + file:line) / BLIND SPOTS / COUNT`.

1. `/audit access` — auth, user-id filtering, origin, rate-limit, RLS-in-code, gate drift
2. `/audit privacy` — PII inventory, deletion cascade, export, sub-processors, sink scrub
3. `/audit perf` — N+1, unbounded reads, indexes, bundle weight
4. `/audit deps` — CVEs, lockfile, license, typosquat ← **unique coverage, nothing else finds
   CVEs**
5. `/review debt` — dead code/UI/exports, duplication, stale copy (**scan only, do NOT approve
   fixes**)
6. `/test audit` — undertested high-risk surfaces (money/auth/derived/migrations)
7. `/audit observability` — critical-path signal, error-sink latching, alerts on
   money/auth/AI-spend ← **unique: "will it page us"**
8. `/audit a11y` — screen-reader/keyboard/semantics/WCAG AA (name the key user-facing pages)
9. `/audit mobile` — touch targets, contrast, soft-keyboard, viewport, PWA manifest (name the
   key pages)
10. **Launch-residue agent** (the `/deploy-check scope=full`-only slice, so we don't re-skim):
    secrets in client bundle, source maps, kill switches, payment lifecycle (money never
    client-granted, webhook sig + idempotency), legal-pages presence, open-redirect. Tell it to
    SKIP anything owned by areas 1–9 — it is the residue, not a second pass.

Run a11y and mobile as separate agents — they share a "contrast not measured" blind spot but
otherwise cover disjoint ground (assistive-tech vs device).

## Phase 2 — Live DB verification (after Phase 1 returns)

Run `/audit db` against the live target. This is the one thing no Phase-1 agent can see. If the
user hasn't confirmed it's safe to query live, ask first.

## Phase 3 — Synthesize ONE backlog

- **Deduplicated findings table**, severity-ranked. Merge the deletion/policy/export trio
  (launch-residue ∩ `/audit privacy`) into single rows — privacy's framing wins, note both
  flagged it. Keep the webhook/auth-callback multi-area findings as _separate_ rows.
- **Unique-coverage callouts** — which findings only ONE area caught.
- **Collective blind spots** — what the suite still can't see (live-DB beyond `/audit db`,
  runtime/rendered behavior, measured contrast, vendor dashboard config like error-sink alert
  rules and AI-vendor training opt-out — these need a human).
- **Triaged buckets**: (A) safe code fixes, (B) bigger code work, (C) founder-must-do (legal
  text, dashboard config, vendor toggles), (D) features needing a design decision.
- **Single go/no-go** + highest-leverage fix + longest-lead-time fix.

This mode DISPATCHES and SYNTHESIZES — it does not itself fix. Offer to hand the backlog to a
fix pass; don't auto-fix. Token cost is real (10+ full-repo agents) — state that up front so
it's not a surprise; it's the intended cost of a periodic full sweep.

---

# Mode `debt` — dead code, dead UI, duplication

Two-phase: scan and propose, then fix only what the user approves. The highest-yield category
is usually _dead code left over from a removed feature_ — type-clean deletion routinely leaves
stale UI copy, dead nav entries, dead prompts, and orphan helpers behind. Sweep that
aggressively.

Common exceptions for this mode: dynamically-imported routes that look unreferenced,
intentionally-kept TODO markers tied to a tracked ticket. Caps here mean `critical-only` = quick
wins only, `high-only` = quick wins + medium effort. Default: list every quick-win individually;
cap medium-effort at 10; summarize the rest by category.

## Phase 1 — Scan

1. **Dead code** — unreferenced exports; unreferenced files (not imported, not a route entry,
   not in a manifest); unused imports inside live files; unreachable branches (dead
   `if (false)`, always-true constants, post-`return` code); components defined but never
   rendered.
2. **Dead UI and copy (the half people miss).** After any feature removal, deletion that passes
   type-check still typically leaves: **dead nav links** (top bars, side menus, footer, bottom
   tabs pointing at a removed page — 404 on click); **dead UI tiles** (hub cards / feature grids
   surfacing a removed module); **stale prompt copy** (AI system prompts referencing a feature
   the model can no longer produce); **stale empty-state copy** ("Click X to start" where X is
   gone); **stale settings** (toggles for a feature that no longer exists); **stale
   help/about/docs strings**. Grep for the name of any removed feature across the entire repo.
   Don't trust the type checker — copy isn't typed.
3. **Duplication** — same constant/enum in two places; same logic in two helpers under
   different names; same fetch wrapper repeated instead of one client; same validation rule
   expressed twice (server schema + a drifted client check).
4. **Drift from a central helper** — inlined access checks where a gating helper exists;
   hand-rolled error capture where a central wrapper exists; hand-rolled fetch where a project
   client exists.
5. **Structure** — files over 500 lines mixing unrelated concerns; components doing both
   fetching and presentation where the project separates them; mixed patterns where the
   codebase has clearly converged.
6. **Markers** — TODO / FIXME / HACK / XXX with date if traceable; commented-out code blocks
   (delete, don't preserve).
7. **Deps and assets** — unused dependencies in `package.json`; stale lockfile entries; stale
   fixtures / temp files / archives.

## Phase 2 — Group and propose

- **Quick wins (safe)** — unused imports, dead files, dead nav links, commented-out code.
- **Medium effort (small refactor)** — duplicated constants, helper drift, mixed patterns.
- **Bigger items (plan first)** — split a large file, swap a library, restructure a directory.

For each: one-line description, file path(s), one-line "why it matters" if non-obvious. **Ask
which groups to fix. Do not touch anything until approved.**

## Phase 3 — Fix approved items

For each approved group: make the changes → run type check + lint + unit tests → **if anything
breaks, undo immediately and report** (do not chase fixes through a rabbit hole). After all
groups: fresh `grep` for the removed names to confirm no straggling references.

## Output

Total findings by category · total fixed this session · skipped items with one-line rationale ·
remaining tracked-for-later list.

$ARGUMENTS
