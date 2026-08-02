# CLAUDE.md — project rules (auto-loaded)

App created from the `app-foundation` template (version in README).

**Code, tests, migrations, and configuration are executable truth.** On conflict with
docs, verify intended behavior and correct whichever side is wrong, in the same change.
Read `ARCHITECTURE.md` before changing auth, security, DB structure, analytics, or SW.

## Non-negotiables

1. RLS on every client-reachable table, deny-by-default. Never trust a client-provided
   `user_id`. New table → `/add-table`. No table ships without a cross-user test.
2. No secrets client-side. Server-only env values are accessed only via
   `src/lib/env/server.ts` — never imported into client code, never committed.
3. Analytics: typed, allowlisted events via the wrapper only. No free-string names,
   no sensitive properties, never a business record.
4. `npm run verify` green before push. DB/RLS changes also need `npm run db:reset` +
   `npm run db:test`. Report exactly what passed, failed, or was skipped.
5. Never weaken security, tests, or validation to make a check pass.
6. Every DB change is a committed migration. Never hand-edit generated types.
7. Auth gates protected data and protected navigation — never the shell's first paint.
8. Smallest change that solves the problem. New dependency = one line in ARCHITECTURE.md.
9. Any script spawning a CLI must surface `result.error` — silent exit is never
   acceptable in a gate. (`docs/FIX_LOG.md`, 4 instances.)

## Bugs

`/fix-bug`; the 3-attempt STOP rule is mandatory. Every fixed code or config bug gets a
regression test on the exact failing condition. Then classify: **product** → done;
**foundation** (template-derived code) → also port the product-neutral fix + test to
the template per playbook §4. Unsure? Ask:
"would the next template app hit this?" Yes → foundation.

## Sessions

Plan mode for non-trivial work. `/save-context` when context fills. `/commit`
(never `git add -A`); push only on green verify.

Canonical example: `src/app/(app)/(example-feature)` is the reference implementation for a new
feature — table → endpoint → page. Copy its shape before inventing one.

Pointers: `.claude/ENGINEERING_PLAYBOOK.md` · `ARCHITECTURE.md` · `.claude/commands/`
History: `docs/FIX_LOG.md` (defects + regression tests) · `docs/DECISIONS.md` (why, with
the measurements — check it before re-attempting a rejected optimization)
