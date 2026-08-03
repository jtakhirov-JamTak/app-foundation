# Start a new app in 30 minutes

The 30-minute timer assumes GitHub access, a working npm registry, Docker running, a Supabase account, and hosting access. Confirm these before starting; infrastructure download or account-approval time is outside the template gate.

Every command below assumes Linux or WSL2 (Ubuntu) — the only supported development environment. On WSL2, keep the clone in the Linux filesystem rather than under `/mnt/c`, and run Node, npm, Docker, and Supabase inside WSL2.

## 0–3 minutes — create from the template

1. In GitHub, open the template repository.
2. Select **Use this template** → **Create a new repository**.
3. Clone the new repository.
4. Run `npm install` and commit the generated `package-lock.json`.

## 3–6 minutes — rename

1. Change `name` in `package.json`, then run `npm install --package-lock-only` so
   `package-lock.json`'s two root `name` fields follow it. Editing `package.json` alone
   leaves the template's name in the lockfile, which the rename check below catches.
2. Replace the `README.md` title and replace `Application` in `src/app/layout.tsx`, `src/app/manifest.ts`, and `src/components/app-shell/app-shell.tsx`.
3. Change `project_id` in `supabase/config.toml`.
4. Copy `.env.example` to `.env.local`.
5. Set `NEXT_PUBLIC_APP_ID=<new-repository-name>`, `NEXT_PUBLIC_APP_VERSION=0.1.0`, and `APP_ENV=local`.
6. Replace `public/icon-192.png` and `public/icon-512.png`.
7. Create `foundation.json` at the repository root so the app records where it came from:

   ```json
   {
     "foundationVersion": "v1.1.0",
     "createdFromCommit": "6965f48",
     "createdAt": "2026-08-02"
   }
   ```

   Take `foundationVersion` from the template's `README.md` `Template version:` line and
   `createdFromCommit` from `git rev-parse HEAD` in the template clone. Without this, a
   later foundation fix has no baseline to diff against and porting it back is guesswork.
   Write the bare version value: prefixing it with the template's repository name is the
   one way this file breaks the rename check at the end of this document. Commit the file
   and run `npm run format` — `prettier --check .` walks the repository root, there is no
   `.prettierignore`, and it is the first step of `npm run verify`.

## 6–10 minutes — environment and new Supabase project

1. Create a new Supabase project and record its project reference.
2. Run `npm run db:start`.
3. Run `npx supabase status` and put the local URL, publishable key, and secret key into `.env.local`.
4. Run `npx supabase login`, then `npx supabase link --project-ref <project-ref>`.

## 10–14 minutes — fresh migrations

```bash
npm run db:reset
npm run db:test
npm run db:types
```

Commit the regenerated `src/types/database.ts`.

## 14–17 minutes — configure auth

1. Confirm the local URLs in `supabase/config.toml`; the template uses local email sign-up without confirmation.
2. In the remote Supabase project, set the deployed site URL and allowed redirect URLs.
3. Choose whether the shipped app requires email confirmation. Production SMTP is a launch task either way, not part of the scaffold timer — and it stops being conditional on this setting the moment password recovery exists, because a recovery email is outbound mail regardless. See the deploy step below.
4. The included browser suite verifies sign-in, sign-out, and expired-session behavior after the production build.

## 17–20 minutes — delete the example feature

Delete exactly:

```text
src/app/(app)/(example-feature)
supabase/migrations/202607210002_example_records.sql
```

Then delete every line between an `EXAMPLE-ONLY` marker and its `END EXAMPLE-ONLY` in:

```text
src/lib/analytics/catalog.ts
src/lib/analytics/screen-registry.ts
```

Those two carry the example's screen, error area, error codes and event because catalog types are derived from zod schemas, which declaration merging cannot extend — the catalog is edited directly instead. Removing lines can leave a construct Prettier wants formatted differently, so run `npm run format` afterwards. Nothing else needs editing: the example's database test lives in `src/app/(app)/(example-feature)/_tests/`, which the folder deletion already takes.

Then rebuild the database and verify the codebase:

```bash
npm run format
npm run db:reset
npm run db:test
npm run db:types
npm run verify:example-removal
```

No other analytics, E2E, database-test, or generated-type edits are required. `verify:example-removal` performs exactly these deletions on a throwaway copy and fails if an `EXAMPLE-ONLY` marker survives anywhere under `src/`, `supabase/`, or `e2e/`, so a marker this list forgets is caught rather than shipped. `db:types` regenerates clean foundation types from the reset database; commit the regenerated `src/types/database.ts` along with the deletions.

This is the last time you run `verify:example-removal`: once the example feature is gone it has nothing to delete. Nothing to un-wire — `npm run release:verify` decides from the artifacts. It skips the step only when **every** example surface is gone (the feature folder, its migration, and its spec under `_tests/`); if some are gone and others remain it fails and names what is left, so a half-finished deletion cannot pass as a completed one.

### Add `/` to the performance gate once `/` is a real page

The template ships `lighthouserc.cjs` measuring `/sign-in` only. In the template, unauthenticated `/` client-redirects to `/sign-in`, so collecting it measured the same page twice and any budget set on it would be invalidated by this scaffold step. As soon as `/` renders something of its own, add it back:

```js
url: ["http://127.0.0.1:3200/", "http://127.0.0.1:3200/sign-in"],
```

plus its own `assertMatrix` entry (`matchingUrlPattern: "http://[^/]+/$"`), calibrated against a real run of _your_ `/` rather than any number inherited from the template.

Unauthenticated cold start is **not** unmeasured in the meantime: `e2e/performance.spec.ts` asserts LCP ≤ 2.5 s across `/` → redirect → sign-in painted. Doing the step above adds Lighthouse's throttled lab profile on top; it does not close an open hole. If your `/` stops redirecting when unauthenticated, that e2e test is measuring your new page instead — recalibrate it in the same change.

## 20–27 minutes — tests and development server

```bash
npm run format
npm run typecheck
npm run lint
npm run test
npm run db:test
npm run check:secrets
npm run check:analytics
npm run build
npm run check:bundle
npm run check:sw
```

In a second terminal, run `npm run dev`. Open a mobile viewport, verify the safe shell paints before session completion, then stop the development server before deploying.

## 27–30 minutes — deploy

1. Push migrations to the linked project with `npx supabase db push`.
2. Put the remote Supabase values and production Upstash credentials in the hosting platform.
3. Set `APP_ENV=production` and set `NEXT_PUBLIC_APP_VERSION` to the release or commit identifier.
4. Deploy.
5. Verify install, cold open, service-worker repeat open, offline safe shell, sign-in, sign-out, expired-session redirect, and one cross-user RLS test.
6. Mark the GitHub repository as a template under **Settings → General → Template repository**.
7. Before **real users** — not before this deploy — walk the LAUNCH BLOCKERS checklist that `npm run release:verify` prints and affirm every line in `/deploy-check`. Two of its items bind here: password recovery and production SMTP. **Enabling password recovery makes production SMTP unconditional, not conditional.** The recovery email is outbound mail whether or not email confirmation is on, and the auth provider's default relay is rate-capped and not a production sender. Plan on this: the next app built from this template will enable password recovery, so treat SMTP as required rather than optional. The checklist also covers an uptime monitor, an error sink, a dependency-aware health check, and the backup/restore drill in [docs/RUNBOOK_RESTORE.md](docs/RUNBOOK_RESTORE.md).

Before declaring the rename complete, run:

```bash
git grep -n -E "app-foundation|\bApplication\b" -- . \
  ':!START_NEW_APP.md' ':!CLAUDE.md' ':!docs/FIX_LOG.md' ':!.claude/ENGINEERING_PLAYBOOK.md'
```

The command must return no results, and it does — every exclusion below is deliberate rather than a way of making a red check look green:

- `\bApplication\b` is word-bounded so ordinary prose like "Applications where a cross-user data leak…" in `README.md` is not a hit. Every real leftover is the standalone word.
- `CLAUDE.md`, `docs/FIX_LOG.md`, and `.claude/ENGINEERING_PLAYBOOK.md` are excluded because they are **supposed** to name the template: `CLAUDE.md` records which template the app came from, every `FIX_LOG` row is attributed by `**Found in:**`, and the playbook's §4 tells you to port fixes back to the `app-foundation` repository. Rewriting those would destroy provenance, not complete a rename.

Nothing else is excluded. In particular `package-lock.json` is deliberately still in scope — a hit there means step 1's `npm install --package-lock-only` was skipped, which is a real miss the old unscoped pattern buried under 25 others.

The app is ready when the production build passes, an empty database rebuilds from migrations, mobile smoke tests pass, and no template/product name remains.
