---
name: add
description: Scaffold a new piece of the project — `/add <endpoint|page|webhook|feature> <desc>`. Carries the shared discover-before-scaffolding pass, then the rules for the named layer. For a DB table use /add-table — it stays standalone because the table is the security boundary.
---

Scaffold a new piece of the project. The first token in `$ARGUMENTS` is the layer. Read
§Universal, then **only** the section for the named layer.

- `endpoint` → §Endpoint — API route
- `page` → §Page — UI page
- `webhook` → §Webhook — inbound provider webhook receiver (Stripe, etc.)
- `feature` → §Feature — vertical slice: table → endpoint → page
- `table` → **not here.** Run `/add-table`. A table is the security boundary; it keeps its own
  command so the RLS/constraint/classification discipline is never skimmed as one section of a
  longer file.

If the first token isn't one of these, ask the user which layer before proceeding.

## §Universal — discover before scaffolding

Every layer starts here. Skip this and your scaffolding will recommend abstractions that
already exist under different names, or invent patterns the codebase has already rejected.

Identify, by reading `package.json` and skimming nearby existing examples:

| What                         | Where it usually lives / search terms                                    |
| ---------------------------- | ------------------------------------------------------------------------ |
| Framework + router           | `src/app/`, `pages/`, `routes/`, `src/routes/`                           |
| Validation library + schemas | `validation`, `schemas`, `zod`, `valibot`                                |
| AI output schemas (if AI)    | `ai/schemas`, `prompts`, `llm`                                           |
| Auth helper                  | `getAuthUser`, `requireUser`, `getServerSession`                         |
| CSRF / origin helper         | `checkOrigin`, `verifyCsrf`, `sameOrigin`                                |
| Rate-limit helper            | `rateLimit`, `limiter`, `throttle`                                       |
| Access gate helper(s)        | `requirePaidAccess`, `requireAccess`, `checkSubscription`                |
| Idempotency                  | `idempotencyKey`, `dedupe`, `requestId`                                  |
| Migration tool               | `supabase/migrations/`, `prisma/migrations/`, `drizzle/`, flyway, dbmate |
| Generated DB types           | `types/database.ts`, `db/schema.ts`, or wherever the regen lands         |
| Authorization model          | RLS policies vs app-level middleware vs RBAC table                       |
| Styling system               | Tailwind, CSS Modules, styled-components, vanilla                        |

**Read one nearby existing example end-to-end. That's the template.** Match its shape unless
there's a deliberate reason not to.

---

## §Endpoint

Scaffold a new API endpoint.

### Schemas

- **Request** in the validation layer. Match the strictness of nearby schemas. Required,
  optional, `.max()`, refinements.
- **Response** explicit. If the endpoint returns AI output, validate the model's output
  against a separate output schema before sending.
- **Strings**: `.trim().min(1)` on every required string (user input or AI output).
  Whitespace passes truthy checks.

### Handler order

Same order, every time:

1. **Origin / CSRF check** — covers mutating endpoints and enumeration GETs. For same-origin
   downloads where `Origin` is absent, accept `Sec-Fetch-Site: same-origin|none`.
2. **Authentication** — extract the user from the server-side session. Never read `userId`
   from the request.
3. **Rate limit** — per-minute burst AND per-day cap. Per-day stops compromised sessions from
   scraping.
4. **Schema validation** of the parsed body. 400 on failure with field-level errors (omit
   values).
5. **Access gate** — see below.
6. **Idempotency check** if the operation is non-idempotent and retryable.
7. **Business logic.** Every DB query filters by the authenticated user id.

### Access gates

The rule: **gating is a centralized helper, never inlined.** Drift between inlined checks is
exactly what helpers prevent.

- Find the helper(s) by grep: `requirePaidAccess`, `requireAccess`, `requireSubscription`,
  `gatePaid`, `hasAccess`, or similar.
- Match the helper to the feature's tier — paid-only vs free-window vs no-gate. Don't paste a
  paid-only gate on a free-tier feature.
- If you find inlined checks instead of a helper, that's an architectural finding — propose
  creating the helper before continuing.

**Routes that must NOT be gated:**

- Auth callback / session refresh
- The endpoint that _creates_ the subscription
- Onboarding writes that run before the user can pay
- Webhook receivers (use signature verification instead)
- Admin routes (use the admin helper, not the paid gate)

### Data-write patterns

- **Raw before derived.** Insert raw first, then derived with AI/computed field `null`, then
  call the model, then UPDATE derived. Recoverable on model failure.
- **Inspect `.error` on every DB call** — apply **DB-ERROR-CHECK**
  (`.claude/ENGINEERING_PLAYBOOK.md` §11): `{ data, error }` returns don't throw on
  RLS/schema-drift/outage, and a `try/catch` won't catch them. Same for `Promise.all` over
  writes — collect results and inspect each.
- **No fire-and-forget before a cache invalidation.** Await if a derived row must reflect the
  mutation.

### Observability and PII

- Catch and capture via the project's error sink. Latch per-request capture paths with a
  cooldown so a degraded upstream doesn't exhaust the quota.
- Never log request body, AI prompts, or any user-text field.
- Verify the sink scrubs `event.exception.values[*].value` — third-party SDK errors
  (Anthropic, OpenAI, Stripe) echo the request body in the error message.

### Deployment-time hazards (catch at scaffold)

- New env var? Note that it must be set in the deploy target before this endpoint can ship.
- New external API call? Add the provider to the sub-processor list and update the privacy
  policy if user data flows to it.

### Verify

Type check. Read the diff: 7 steps in order, no helper bypassed, no inlined gate.

---

## §Page

Scaffold a new page. Beyond §Universal, note the project's server-vs-client-component default,
data-fetching convention (server actions / `loader` / hooks), and shared layout primitives (top
bar, bottom tab bar, auth gate). **Read one nearby sibling page end-to-end — that's your
template.**

### Pick the location

- **Authenticated user page** → the project's authenticated route group / layout. Don't
  duplicate auth at the page.
- **Auth page** → the auth route group.
- **Public / unauthenticated** → root or `(public)`.
- **Admin** → admin group with the admin-check helper, not the paid gate.

### Mobile-first defaults (non-negotiable)

- **Input font-size ≥ 16px** (iOS zooms on focus below 16px).
- **Tap targets ≥ 44pt iOS / 48dp Android.** Wrap native checkboxes in `<label>` with
  `min-h-11`.
- **Reserve space for fixed bottom bars** — hub/list pages need bottom padding so the last card
  isn't covered.
- **Contrast meets WCAG AA** — ≥ 4.5:1 body, ≥ 3:1 large/decorative. Default mid-grey utilities
  (`text-zinc-400`, `text-gray-400`) fail AA at small sizes.
- **Horizontal padding ≥ 16px** from viewport edges.

If the project's existing pages violate these, match the rules, not the siblings. For a deeper
pass run `/audit mobile` on the new page.

### Multi-step / wizard pages

- **Key sensor-holding components by current step.** `<VoiceInput key={currentStep.key} />`.
  React reuses instances at the same tree position otherwise; async transcripts fire against
  the wrong field.
- **`setState` then `submit` in the same tick reads stale state.** For select-buttons that
  update state and submit, pass the value into the submit handler explicitly.
- **Strict-mode double-invocation** — for effects that do server writes, guard with `useRef`:
  `if (started.current) return; started.current = true;`. Server-side dedup is the other half.
- **Progressive save** — save after each completed step, not at the end.

### Errors and empty states

- Every error path offers a next action. Never a dead-end "Done" after partial failure.
- Empty states have specific copy, not "no data".
- Loading states finish — no indefinite spinners on failed fetch.
- **Gated submits preserve input** — apply **GATE-PRESERVE**
  (`.claude/ENGINEERING_PLAYBOOK.md` §11): if a submit can return 403 / paywall /
  auth-required, keep the filled form mounted, snapshot any prior output, and inline the
  upgrade — never `router.push(...)` away from a filled multi-step form. If the project already
  has an inline-gate pattern on a sibling flow, copy it.

### Nav entry

If the page needs a nav entry, add it — and apply **LINK-RESOLVE** (§11): resolve the target
against the route tree on disk; don't assume it exists. A broken nav link inside an
authenticated app destroys trust faster than a missing feature.

### Verify

Type check + lint. Mentally render at 375px before declaring done. Resolve every internal link
target the page introduces against a real route (**LINK-RESOLVE**).

---

## §Webhook

Scaffold an inbound webhook from a provider.

It is **not** a normal endpoint — most of §Endpoint's handler order is wrong here. A webhook is
called by a _server_, not your logged-in user, so there's no session, no Origin, no CSRF, and
it must NOT be paywall-gated. Its security model is the **signature**, not auth.

### Before scaffolding

- Read the provider's webhook docs for the exact signature scheme and the header it uses.
- Find how the project reads raw request bodies — signature verification needs the **raw
  bytes**, and frameworks that auto-parse JSON destroy them. (Next.js App Router: read
  `await req.text()` and verify before `JSON.parse`; never `await req.json()` first.)
- Find the dedup/idempotency store the project already uses.

### Handler order (different from a normal endpoint)

1. **Read the raw body** as text — do not parse yet.
2. **Verify the signature** against the raw body using the provider's SDK and the signing
   secret (server-side env var). Invalid/missing signature → `400`, log nothing sensitive,
   stop. This replaces auth + origin + CSRF.
3. **Parse** the now-trusted body.
4. **Idempotency / replay defense.** Providers retry and may deliver duplicates. Dedup on the
   provider's event id — record processed ids; if seen, ack `200` and do nothing. The same
   event twice must never double-grant entitlement or double-apply a side effect.
5. **Dispatch on event type.** Handle the types you care about; for unknown types, ack `200`
   (don't 4xx — that triggers provider retries forever).
6. **Mutate, inspecting `.error` on every write** (**DB-ERROR-CHECK**,
   `.claude/ENGINEERING_PLAYBOOK.md` §11). Use the privileged/service client — there is no user
   session. This is the only place allowed to grant entitlement (`status = active`); a
   user-callable route must never do it. Writes must be idempotent (step 4) AND match the
   raw+derived discipline if a derived row is involved.
7. **Ack fast.** Return `200` quickly; do heavy work async if the provider has a tight ack
   timeout, but only after the state that makes the event safe-to-replay is committed.

### Must-NOTs (the easy ways to get this wrong)

- **No paywall/access gate.** Webhooks are deliberately un-gated — gating one means the
  provider's calls get 403'd and entitlements silently never apply. (§Endpoint and
  `/audit access` list webhook receivers as a correct gate _exclusion_ — keep it that way.)
- **No `req.json()` before verifying** — it eats the raw body the signature needs.
- **No trusting any field as identity** — the signature is the only trust boundary.
- **No 4xx on an event you simply don't handle** — ack 200 or the provider retries
  indefinitely.

### Deployment-time hazards (catch at scaffold)

- The signing secret is a new env var — must be set in the deploy target, and it differs
  between the provider's test and live modes.
- Register the endpoint URL in the provider's dashboard, and note which event types it must be
  subscribed to.
- New sub-processor / money flow → privacy policy + the subscription-lifecycle checks in
  `/deploy-check scope=full` apply.

### Verify

Type check. Re-send the same event twice (replay) and confirm the second is a no-op. Send a
tampered/garbage signature and confirm `400`. Send an unhandled event type and confirm `200`
no-op.

---

## §Feature

A vertical slice.

### Gather from the user first

- Feature name
- Fields and their types
- Where it belongs in the product
- Tier: free-on-signup, free-window, paid-only, admin-only
- AI involved?

### Then run, in this order, awaiting confirmation before each step

1. **`/add-table`** — DB layer first; everything downstream depends on the schema. Apply the
   migration and verify columns landed (`/audit db`) before continuing.
2. **§Endpoint** — API layer; match the tier from the user's input to the correct access-gate
   variant.
3. **§Page** — UI layer; reuse the project's shared components.

Each step verifies before moving on (type check, migration applied + verified, route
reachable).

### What "good" looks like

The new feature reads like a copy of the nearest existing feature in the same tier, with only
the schema and prompt body different. Anything novel should be a deliberate, named choice.

$ARGUMENTS
