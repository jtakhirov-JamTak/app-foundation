# app-foundation

Template version: v1.0.0

A mobile-first Next.js/Supabase template for security-sensitive applications.

## Stack

Next.js App Router, React, strict TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL/RLS, SWR, Serwist, Zod, Vitest, Playwright, and Lighthouse CI.

## Prerequisites

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

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [START_NEW_APP.md](START_NEW_APP.md)
