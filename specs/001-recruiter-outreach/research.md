# Phase 0 Research: Recruiter Outreach

**Feature**: `001-recruiter-outreach` | **Date**: 2026-07-11

This document resolves the technical unknowns for the plan. Each decision records what
was chosen, why, and the alternatives considered. Decisions are constrained by the
Sendora Constitution v1.0.0 (type safety, simplicity, test-first, accessibility, Astryx
design-system consistency) and the ratified stack (Next.js + Astryx + NeonDB).

## 1. Data access layer (NeonDB)

- **Decision**: Drizzle ORM with the `@neondatabase/serverless` driver; migrations via
  drizzle-kit.
- **Rationale**: Drizzle is fully typed end-to-end (satisfies Principle I), lightweight,
  and generates SQL close to hand-written — no heavy runtime. It pairs natively with
  Neon's serverless/HTTP driver, keeping cold starts small on a serverless host. Schema
  is defined in TypeScript, so row types flow into the app without a separate codegen
  step, and drizzle-kit produces reviewable SQL migrations (good for open-source
  transparency).
- **Alternatives considered**: Prisma (heavier client/engine, larger cold start, less
  transparent SQL); raw `pg` / SQL (loses type safety, more boilerplate, violates the
  simplicity/type-safety balance); Kysely (excellent typing but no migration story
  bundled — Drizzle covers both in one tool).

## 2. Authentication + Gmail authorization

- **Decision**: Auth.js (NextAuth v5) with the Google provider. Google sign-in provides
  the assumed authentication dependency; the Gmail send capability is obtained via the
  OAuth scope `https://www.googleapis.com/auth/gmail.send` requested through incremental
  authorization when the job seeker connects/enables sending. Refresh tokens are stored
  encrypted at rest.
- **Rationale**: FR-019 mandates sending from the job seeker's own Gmail; Google OAuth is
  the only sanctioned path to a send token. Reusing Google sign-in for both login and
  Gmail scope avoids a second identity system (simplicity, Principle I). `gmail.send` is
  the *narrowest* scope that permits sending (no read/inbox access), minimizing the data
  the platform can touch — the least-privilege posture the constitution's deferred
  privacy note anticipates. Incremental authorization keeps the initial login consent
  light and requests the send scope only when the user connects sending (FR-019a:
  connect at any time after login).
- **Alternatives considered**: Full `gmail.modify`/`https://mail.google.com/` scopes
  (over-broad, rejected on least-privilege); a separate custom OAuth flow decoupled from
  login (more code, two token stores, no benefit for a Gmail-only v1); platform-side
  sending (rejected in the spec, Option B).

## 3. Provider-agnostic sending seam

- **Decision**: An `EmailProvider` interface in `lib/email/provider.ts` exposing a single
  `sendEmail(message, credentials)` operation that returns a normalized per-message
  result; `GmailProvider` is the only implementation this version. A small factory
  resolves the provider for a connected account by its provider key. Contract documented
  in `contracts/email-provider.md`.
- **Rationale**: FR-019c requires additional providers to be addable with low effort and
  without reworking contacts/template/sending flows. Isolating all Gmail specifics
  (MIME assembly, API call, error mapping) behind one interface means a future Outlook
  (Microsoft Graph) or generic SMTP provider is a new file implementing the same
  contract — the send flow, batching, and result handling are provider-independent.
  Normalizing results/errors at the seam keeps per-recipient outcome reporting (FR-017,
  FR-018) uniform across providers.
- **Alternatives considered**: Calling the Gmail API directly from the send route
  (couples the flow to Gmail, violates FR-019c); adopting a heavyweight multi-provider
  email library now (premature — only Gmail is needed, violates YAGNI/simplicity).

## 4. Email message assembly & sending mechanics

- **Decision**: Send via the Gmail API `users.messages.send` with a base64url-encoded
  RFC 5322 MIME message. Each email is `multipart/alternative` carrying a `text/plain`
  part and a sanitized `text/html` part derived from the rich-text body. Recipient is set
  per message (one API call per recruiter).
- **Rationale**: Gmail API send is authorized by the narrow `gmail.send` scope and puts a
  real copy in the sender's Sent folder (authenticity users expect). `multipart/alternative`
  gives recipients a proper plain-text fallback, which aids deliverability for 1:1 cold
  outreach. One message per recipient enforces FR-015 (each recruiter gets a separate
  email, no recipient disclosure) for free.
- **Alternatives considered**: SMTP via the user's account (needs app passwords / broader
  access, more setup friction — rejected in the spec, Option C); a single message with
  many recipients (violates FR-015); HTML-only body (no plain-text fallback, worse
  deliverability and accessibility).

## 5. Rich-text editing & storage

- **Decision**: Tiptap (ProseMirror-based) as the client editor, constrained to the
  supported marks/nodes (bold, italic, ordered/unordered lists, links). Bodies are stored
  as **sanitized HTML** plus a derived plain-text rendering; templates additionally store
  their raw authored form. Server-side sanitization via `sanitize-html` with a strict
  allow-list matching the supported formatting; merge fields are represented as
  `{{token}}` text (see §7).
- **Rationale**: FR-009a requires basic rich text and explicitly excludes full HTML;
  Tiptap lets us allow exactly the four formatting types and nothing else. Storing
  sanitized HTML (never trusting client HTML) plus a plain-text alternative directly
  feeds the `multipart/alternative` send (§4) and satisfies the "no literal placeholder
  delivered" rule after merge rendering. Sanitizing server-side keeps the trust boundary
  honest (Principle I).
- **Alternatives considered**: Storing raw ProseMirror JSON only (needs render step at
  send time and a JSON→HTML path anyway); Markdown (users don't author Markdown; limited
  inline link UX); plain `<textarea>` (fails FR-009a). Accessibility: Tiptap toolbar must
  be keyboard-operable with labelled controls and the editable region correctly exposed
  — tracked as an explicit accessibility acceptance item (Principle III).

## 6. Contact import (CSV / Excel / paste)

- **Decision**: PapaParse for CSV files and for pasted spreadsheet content (TSV/CSV
  detection); SheetJS (`xlsx`) for `.xlsx` files. All three paths normalize to the same
  in-memory row shape and run through one shared validation + duplicate-detection +
  summary pipeline (FR-001 requires identical treatment across methods). Column mapping:
  auto-detect common headers (name/email/company/role) with a user confirmation step.
- **Rationale**: One parser per source, converging to a single normalized pipeline, keeps
  validation/dedup/reporting logic in one tested place (FR-004–FR-006) regardless of
  input method. PapaParse handles messy real-world CSV (quoting, delimiters) and pasted
  data cleanly; SheetJS is the de-facto `.xlsx` reader. The normalization boundary is a
  Zod schema, so every row is validated identically.
- **Alternatives considered**: SheetJS for everything (weaker CSV/paste ergonomics than
  PapaParse); server-only parsing of large files (paste and small CSVs parse fine
  client-side for instant feedback, with server-side re-validation as the authoritative
  trust boundary); requiring a fixed header order (poor UX — auto-map + confirm is
  friendlier and still deterministic).

## 7. Merge fields (resolves deferred clarification)

- **Decision**: A fixed, documented vocabulary of merge tokens in `{{snake_case}}` form:
  `{{first_name}}`, `{{last_name}}`, `{{full_name}}`, `{{company}}`, `{{role}}`. Rendering
  resolves each token from the recruiter contact; a token with no value uses a defined
  safe fallback (e.g. `{{first_name}}` → "there" for greetings) or, where no sensible
  fallback exists, the field is dropped and the send preview surfaces a warning. Unknown/
  malformed tokens are rejected at template-save time (FR-011) so they can never reach a
  send.
- **Rationale**: A closed vocabulary makes templates validat save time, rendering
  total (never emits a literal `{{...}}`, satisfying SC-004 and FR-012), and testable.
  `snake_case` tokens are unambiguous to parse and match the contact attributes in the
  data model. Deferring richer/conditional logic keeps v1 simple (documented assumption).
- **Alternatives considered**: Full templating engine (Handlebars/Liquid) — powerful but
  over-scoped, larger attack surface, and conflicts with the "no rich conditional logic"
  assumption; free-form field names (can't validate at save time).

## 8. Bulk send execution model

- **Decision**: For v1, a bulk send processes recipients server-side within a single
  request, deduplicating recipients first (FR-016), sending one message per recipient via
  the provider seam, collecting a per-recipient result, and returning an aggregate +
  per-recipient summary (FR-017, FR-018). Target batch size ≤ 50 (SC-005) fits within
  serverless execution limits. Partial failures never roll back successful sends. Larger
  batches and provider-side throttling/queueing are explicitly deferred to a future
  background-job design (e.g. a durable queue) noted in the spec assumptions.
- **Rationale**: At the v1 scale (≤50), synchronous processing is the simplest correct
  design and gives immediate per-recipient feedback. Deduping up front and recording each
  outcome independently makes the flow resilient to individual failures without a
  transaction that would violate FR-018. Keeping the batch bounded respects serverless
  timeouts (a documented constraint).
- **Alternatives considered**: A background queue (Inngest/QStash) now — correct at large
  scale but premature for ≤50 and adds infrastructure (YAGNI); a single transactional
  all-or-nothing send (violates FR-018's "don't hide successful sends").

## 9. Validation strategy (trust boundaries)

- **Decision**: Zod schemas in `lib/validation/` are the single source of truth at every
  trust boundary: uploaded/pasted rows, all route-handler inputs, OAuth callback data,
  and environment variables (validated at startup). Validated types flow through `lib/`
  services; `any` is prohibited, `unknown` + narrowing used where needed.
- **Rationale**: Directly implements Constitution Principle I ("data crossing a trust
  boundary MUST be validated at runtime, and the validated type MUST flow through"). Zod
  co-locates the runtime check and the static type, so there is one definition per
  boundary. Env validation at startup fails fast on misconfiguration.
- **Alternatives considered**: Manual type guards (error-prone, duplicative);
  class-validator/DTOs (heavier, decorator-based, less idiomatic for this stack); trusting
  framework-inferred types (no runtime guarantee — unsafe at boundaries).

## 10. Testing tooling

- **Decision**: Vitest + React Testing Library for unit/component tests; Vitest for
  route-handler contract tests (asserting request/response against `contracts/http-api.md`);
  Playwright for integration/E2E covering each user story's Independent Test. The Gmail
  provider is exercised against a mock/fake implementation of the `EmailProvider` seam in
  unit/integration tests; a thin contract test validates the real Gmail MIME assembly.
- **Rationale**: Principle II mandates test-first with integration coverage of every
  user-facing flow. Vitest is fast and native to the Vite/TS ecosystem; Playwright drives
  real browser journeys (import → template → send) that map 1:1 to the spec's Independent
  Tests. The provider seam makes sending fully testable without hitting Gmail, while one
  contract test guards the real MIME/format output.
- **Alternatives considered**: Jest (slower, more config with ESM/TS); Cypress (heavier
  than Playwright for multi-tab/OAuth flows); hitting real Gmail in tests (flaky, quota-
  bound, unsafe — replaced by the fake provider + one format contract test).

## Open items intentionally deferred (not blocking)

- Background-job/queue design for bulk sends larger than v1's ≤50 target (§8).
- Additional email providers beyond Gmail — enabled by the seam (§3), built later (FR-019c).
- Advanced deliverability controls (warmup, throttling, bounce automation) — per spec
  assumptions and the constitution's deferred-principles note.
