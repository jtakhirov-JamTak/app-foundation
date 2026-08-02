# Engineering Playbook

Judgment and rules for building apps on `app-foundation`. Executable process lives in
`.claude/commands/` — this file does not restate command steps (one source of truth;
duplicated protocol is how docs drift). Code wins over this document.

## 1. The one rule above the others

**Analysis is not progress. Shipped behavior is progress.**
If a session produces only plans, comparisons, or rewritten specs — and it is the
second such session on the same topic — the next session must produce running code
or the topic gets dropped. Frameworks are a known failure mode here; timebox them.

## 2. Verification ladder

Cheapest check that can catch the mistake runs first:

1. Typecheck (seconds) → 2. Unit tests (seconds) → 3. `npm run verify` (minutes)
   → 4. `npm run db:test` — pgTAP RLS (minutes) → 5. `npm run test:e2e` (minutes)
   → 6. Real phone, production build (the only test that certifies feel).

Rungs 1–3 on every change. Rung 4 on any migration or policy change. Rungs 5–6 before
tagging a release. Never claim something works from reading code — run the rung, and
report results exactly: passed, failed, or skipped.

## 3. Bug fixing and rabbit holes

`/fix-bug` is the process. The judgment layer on top:

- **Two failed fixes = wrong diagnosis.** Attempt 3 must test a _genuinely different_
  explanation — never a third variation on the same theory — or STOP.
- **On STOP, record per attempt:** the theory, what evidence disproved it, the
  remaining unknown, and the decision that needs human input.
- **Timebox: 45 minutes stuck → stop, write the theories down, leave.** Fresh context
  next session solves in minutes what the tunnel couldn't.
- **Symptom layer ≠ cause layer.** Say which layer you believe the cause is in
  _before_ editing code.
- A confirmed real failure is the highest-value test that exists. Lock every fixed
  bug with a regression test on the exact failing input.

## 4. Foundation-fix protocol (full version; short form in CLAUDE.md)

1. Reproduce and fix the bug in the app where it appeared. Add a regression test there.
2. Ask: would the next template-derived app hit this? No → done, product bug.
3. Yes → extract the **smallest product-neutral version** of the fix.
4. Apply that fix and its regression test to the `app-foundation` repo.
5. Run the template's `npm run verify` (+ `db:test` if migrations or policies changed).
6. If the fix touches startup, setup docs, auth, PWA/SW, or migrations: scaffold a
   throwaway app and verify the affected path actually works from the template.
7. Add one entry to the **Foundation Fix Log** at the template's `docs/FIX_LOG.md`:
   date/version · problem · generic fix · regression test · which app found it.
   A rejected optimization also gets a one-line entry under _Rejected approaches_ in
   `ARCHITECTURE.md`, linking to the evidence.
8. Tag a patch release using semantic versioning (v1.0.0 → v1.0.1).
9. Existing apps port the fix manually **only if it matters to them** — no forced syncs.
10. A bug found directly in the template gets reproduced in a throwaway app before
    the template is changed.

**Template changes come only from lessons in shipped apps.** Speculative template
"improvements" are forbidden — that's the analysis loop wearing a maintenance costume.

## 5. Data rules (judgment beyond /add-table)

- Domain tables are the source of truth. Analytics events are never business records.
- Never overwrite data with history value — archive (`archived_at`), don't delete,
  unless the user explicitly deletes. Preserve user input when a request fails.
  Give an entity `archived_at` whenever archive or delete semantics exist for it; for
  user-facing domain tables that is usually yes. Where archived rows must not block
  value reuse, uniqueness becomes a partial unique index filtered on
  `WHERE archived_at IS NULL` — full rules in ARCHITECTURE.md → _Data standard_.
- UTC in the database, always. Convert at the edge.
- Stored computed values carry a version stamp so stale rows can be invalidated by a
  code bump instead of a migration.

## 6. Security judgment

- The API route is not the security boundary; the database (RLS + grants) is.
  Route checks are convenience; policies are enforcement.
- Anything a client can reach will eventually receive hostile input. Validate at the
  boundary (zod) **and** constrain in the database (CHECK/FK/UNIQUE) — both, not either.
- New sensitive column → data-classification comment (`-- PII:` / `-- SENSITIVE:`)
  so `/audit privacy` finds it by grep. Never log user-entered or sensitive data.
- When a review finds one hole, assume the pattern repeats — grep for it across the
  codebase before closing the finding.

## 7. Dependencies

Default answer is no. A new dependency needs: (a) the problem is real today, not
anticipated; (b) writing it ourselves costs more than owning the dependency; (c) one
line in ARCHITECTURE.md. Prefer boring, maintained, popular.

**Foundation-inclusion test.** A dependency _or a pattern_ enters the template only if
the **next derived app would need it on day one**. Anything a specific app needs and the
next one wouldn't belongs in that app, not here — that is the same speculative-improvement
failure §4 forbids, wearing an infrastructure costume.

## 8. Definition of done

Ship when, and only when:

- the intended behavior works on a real phone, and the root cause — not just the
  symptom — is what got fixed;
- a regression test exists for any real failure encountered;
- failure states (offline, unauthorized, failed save) don't corrupt data;
- security and privacy boundaries are intact, and no check was weakened to pass;
- relevant docs match the code, and verification results were reported honestly;
- no unrelated cleanup rode along.

Everything past that bar goes to the **"Explicitly Deferred"** section of
`ARCHITECTURE.md` (or a GitHub Issue) — deferral recorded is a decision, not a failure.

## 9. Session hygiene

- One intent per session. "While I'm here" is how rabbit holes start.
- Plan mode for anything touching >3 files or any migration.
- `/save-context` before context runs low; summaries beat truncation.
- End every session at a green `verify` or an explicit stash — never mid-broken.

## 10. Where the history lives

`ARCHITECTURE.md` describes only what is true now. Two documents hold the record behind
it, and both are appended to rather than rewritten:

- `docs/FIX_LOG.md` — one dated section per foundation defect, with the product-neutral
  fix and the regression test that guards it (§4.7).
- `docs/DECISIONS.md` — one dated section per decision, kept verbatim with the
  measurements. Read it before re-attempting anything listed under
  _Rejected approaches_; the experiment has already been run.

## 11. Reviewer conventions

Named conventions cited by `.claude/commands/`. Where a command cites one, the inline rule
text in that command is authoritative; this section is the index.

- **GATE-PRESERVE** — if a submit can return 403 / paywall / auth-required, keep the filled
  form mounted, snapshot prior output, inline the gate. Never `router.push` away from a
  filled multi-step form.
- **DB-ERROR-CHECK** — `{ data, error }` returns do not throw on RLS/schema-drift/outage;
  inspect `.error` on every DB call, including each result of a `Promise.all` over writes.
- **ENFORCED-NOT-INTENDED** — judge what the code enforces, not what comments or names
  intend. A check that can be bypassed is not a check.
- **LINK-RESOLVE** — every internal link/route referenced must resolve to a real page;
  verify targets exist rather than assuming from naming.
- **VERSION-GUARD** — stored computed values carry a version stamp; readers filter on it,
  writers stamp it, bumping invalidates stale rows without a migration.
