# Start a new app in 30 minutes

The 30-minute timer assumes GitHub access, a working npm registry, Docker running, a Supabase account, and hosting access. Confirm these before starting; infrastructure download or account-approval time is outside the template gate.

## 0–3 minutes — create from the template

1. In GitHub, open the template repository.
2. Select **Use this template** → **Create a new repository**.
3. Clone the new repository.
4. Run `npm install` and commit the generated `package-lock.json`.

## 3–6 minutes — rename

1. Change `name` in `package.json`.
2. Replace the `README.md` title and replace `Application` in `src/app/layout.tsx`, `src/app/manifest.ts`, and `src/components/app-shell/app-shell.tsx`.
3. Change `project_id` in `supabase/config.toml`.
4. Copy `.env.example` to `.env.local`.
5. Set `NEXT_PUBLIC_APP_ID=<new-repository-name>`, `NEXT_PUBLIC_APP_VERSION=0.1.0`, and `APP_ENV=local`.
6. Replace `public/icon-192.png` and `public/icon-512.png`.

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

Commit the regenerated base and optional-feature database type files.

## 14–17 minutes — configure auth

1. Confirm the local URLs in `supabase/config.toml`; the template uses local email sign-up without confirmation.
2. In the remote Supabase project, set the deployed site URL and allowed redirect URLs.
3. Choose whether the shipped app requires email confirmation. Production SMTP is a launch task when confirmation is enabled, not part of the scaffold timer.
4. The included browser suite verifies sign-in, sign-out, and expired-session behavior after the production build.

## 17–20 minutes — delete the example feature

Delete exactly:

```text
src/app/(app)/(example-feature)
supabase/migrations/202607210002_example_records.sql
```

Then rebuild the database and verify the codebase:

```bash
npm run db:reset
npm run db:test
npm run db:types
npm run verify:example-removal
```

No analytics, E2E, database-test, or generated-type edits are required outside those two deleted paths.

### Add `/` to the performance gate once `/` is a real page

The template ships `lighthouserc.cjs` measuring `/sign-in` only. In the template, unauthenticated `/` client-redirects to `/sign-in`, so collecting it measured the same page twice and any budget set on it would be invalidated by this scaffold step. As soon as `/` renders something of its own, add it back:

```js
url: ["http://127.0.0.1:3200/", "http://127.0.0.1:3200/sign-in"],
```

plus its own `assertMatrix` entry (`matchingUrlPattern: "http://[^/]+/$"`), calibrated against a real run of _your_ `/` rather than any number inherited from the template. Until you do this, **unauthenticated cold start is unmeasured** — that is the known gap this trade accepted, not an oversight.

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

Before declaring the rename complete, run:

```bash
git grep -n -E "app-foundation|Application" -- . ':!START_NEW_APP.md'
```

The command must return no results. The app is ready when the production build passes, an empty database rebuilds from migrations, mobile smoke tests pass, and no template/product name remains.
