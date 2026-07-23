# Reviewer Conventions (project-local)

Named conventions cited by `.claude/commands/`. Where a command cites a convention,
the inline rule text in that command is authoritative; this file is the index.
Replace with your fuller personal version if you maintain one.

- **GATE-PRESERVE** - if a submit can return 403 / paywall / auth-required, keep the
  filled form mounted, snapshot prior output, inline the gate. Never `router.push`
  away from a filled multi-step form.
- **DB-ERROR-CHECK** - `{ data, error }` returns do not throw on RLS/schema-drift/outage;
  inspect `.error` on every DB call, including each result of a `Promise.all` over writes.
- **ENFORCED-NOT-INTENDED** - judge what the code enforces, not what comments or names
  intend. A check that can be bypassed is not a check.
- **LINK-RESOLVE** - every internal link/route referenced must resolve to a real page;
  verify targets exist rather than assuming from naming.
- **VERSION-GUARD** - stored computed values carry a version stamp; readers filter on it,
  writers stamp it, bumping invalidates stale rows without a migration.
