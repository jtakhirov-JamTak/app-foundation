# app-foundation

Template version: v1.0.0

An opinionated production foundation for mobile-first, security-sensitive Next.js/Supabase applications.

This is not a lightweight starter. It carries a full security, testing, and performance apparatus from the first commit, on the assumption that the expensive failures in this class of app — a user seeing another user's row, a secret reaching the client, a migration that never ran — are the ones worth making structurally hard rather than catching in review.

## Who this is for

Applications where a cross-user data leak is the unacceptable failure, and where you would rather spend ~30 minutes scaffolding ([START_NEW_APP.md](START_NEW_APP.md)) than retrofit isolation later.

**Not for** throwaway prototypes, content sites, or anything you would be happy to ship without row-level security and a database test proving it holds. The gates are not optional decoration; if you do not want them, this will slow you down.

## What it guarantees

These are enforced by gates that fail loudly, not by convention or code review. Full list in [CLAUDE.md](CLAUDE.md).

- **Row-level security on every client-reachable table, deny-by-default.** `user_id` is derived from verified claims, never trusted from the client, and no table ships without a cross-user isolation test.
- **No secrets client-side.** Server-only values are parsed in server-only modules; secret scanning runs in CI.
- **Analytics that cannot drift into free text.** Event names and property shapes are allowlisted in TypeScript _and_ constrained in the database, so bypassing the type system does not widen the contract.
- **Every schema change is a committed migration**, with generated types checked for drift in CI. Generated types are never hand-edited.
- **Auth gates protected data and protected navigation — never the shell's first paint.**
- **`npm run verify` green before push.** Schema or RLS changes additionally require `npm run db:reset` and `npm run db:test`.

## What is deliberately excluded

The template ships a foundation, not a feature set. Payments, AI, admin, file storage, push notifications, an external error vendor, and an offline mutation queue are among the modules left out on purpose, to be added per-app when a real requirement appears. [ARCHITECTURE.md](ARCHITECTURE.md) → _Boundaries_ owns the current list and is the one to trust.

The demonstration feature is one deletable route-group folder plus one migration; `npm run verify:example-removal` proves it came out cleanly. Boundaries and per-dependency justifications are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Built from shipped applications

The foundation is not a greenfield guess. Every piece is classified in [ARCHITECTURE.md](ARCHITECTURE.md) → _Source provenance_ as copied as-is, copied with changes, or rebuilt cleanly, naming the audited production application it came from — the fail-closed origin guard, the owner-scoped RLS policy shape, and the privileged-client boundary are all carried over rather than reinvented.

[docs/FIX_LOG.md](docs/FIX_LOG.md) records every defect found in a real application or in this template's own gates, dated, with the product-neutral fix and the regression test that now guards it. Several entries are gates that passed vacuously — a database test that silently no-opped on Windows, a Lighthouse budget measuring the wrong page. Reading it is the fastest way to judge whether the checks here are load-bearing.

## Cost of adoption

Be clear-eyed about what you are taking on. The template owns several interacting contracts: analytics types alongside database constraints, generated database types, service-worker caching rules, performance budgets, and pinned dependency versions.

Each one has a check that fails loudly under `npm run verify`, so drift between them is caught mechanically rather than by vigilance. What no check covers is **upstream churn** — Next.js, Supabase, and browser behavior move on their own release cycles, and these contracts move with them. That cost is real and ongoing. _Trade-offs_ in [ARCHITECTURE.md](ARCHITECTURE.md) records the couplings known today, including one that ties the build to a specific bundler.

## Stack

Next.js App Router, React, strict TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL/RLS, SWR, Serwist, Zod, Vitest, Playwright, and Lighthouse CI.

## Prerequisites

- Supported development environment: Linux or WSL2 (Ubuntu). Native Windows is unsupported. Keep the repo in the WSL Linux filesystem, not a `/mnt/c` path. Run Node, npm, Docker, and Supabase inside WSL2.
- Node.js 22+
- npm
- Docker running for local Supabase
- GitHub, npm-registry, Supabase, and hosting access for the 30-minute scaffold

## Local setup

```bash
npm install
cp .env.example .env.local
npm run db:start
npx supabase status
```

Copy the local URL, publishable key, and secret key into `.env.local`, then run:

```bash
npm run db:reset
npm run db:test
npm run db:types
npm run dev
```

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run db:test
npm run build
npm run test:e2e
npm run verify
npm run verify:example-removal
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — boundaries, security model, data standard, budgets, rejected approaches, and what is explicitly deferred
- [START_NEW_APP.md](START_NEW_APP.md) — the timed scaffold process for a new application
- [CLAUDE.md](CLAUDE.md) — project rules and non-negotiables, auto-loaded by Claude Code
- [.claude/ENGINEERING_PLAYBOOK.md](.claude/ENGINEERING_PLAYBOOK.md) — verification ladder, bug protocol, and definition of done
- [docs/FIX_LOG.md](docs/FIX_LOG.md) — every foundation defect, its fix, and the regression test guarding it
- [docs/DECISIONS.md](docs/DECISIONS.md) — why the foundation is built this way, with the measurements
- [docs/RUNBOOK_RESTORE.md](docs/RUNBOOK_RESTORE.md) — Supabase backup and restore, and the drill each app runs before launch
