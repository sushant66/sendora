# Implementation Plan: Recruiter Outreach

**Branch**: `001-recruiter-outreach` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-recruiter-outreach/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Sendora's core outreach workflow: a job seeker imports recruiter contacts (CSV / Excel /
paste), selects or authors rich-text email templates with merge fields, and sends
personalized emails to recruiters individually or in bulk — sent from the job seeker's
own connected Gmail account so replies return to their inbox. Every send is recorded
with a per-recipient outcome, and the job seeker is warned before re-contacting someone.

Technical approach: a single Next.js (App Router) TypeScript application, UI built from
Astryx components, data in NeonDB (serverless Postgres) via Drizzle ORM, authentication
and Gmail access via Auth.js (NextAuth) with Google OAuth. Sending is abstracted behind
a provider-agnostic `EmailProvider` seam (Gmail is the only implementation this version)
so additional providers can be added later with low effort. Zod validates every trust
boundary; Vitest + Playwright enforce test-first development.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20 LTS

**Primary Dependencies**: Next.js (App Router, React 19), Astryx (React + StyleX design
system), Drizzle ORM + drizzle-kit, `@neondatabase/serverless`, Auth.js / NextAuth v5
(Google provider), `googleapis` (Gmail API), Zod, Tiptap (rich-text editing), PapaParse
(CSV/paste), SheetJS `xlsx` (Excel), `sanitize-html` (server-side HTML sanitization)

**Storage**: NeonDB (serverless PostgreSQL) accessed exclusively through a typed Drizzle
data layer; migrations managed by drizzle-kit

**Testing**: Vitest + React Testing Library (unit/component), Vitest (contract tests for
route handlers), Playwright (integration/E2E of primary user journeys)

**Target Platform**: Web (server-rendered + client components) deployed to a serverless
host (e.g. Vercel); modern evergreen browsers

**Project Type**: Web application (single Next.js app, no separate backend service)

**Performance Goals**: Import summary for 100 contacts visible in <1 min (SC-001); first
send within 5 min of empty account (SC-002); bulk send of 50 recipients returns a
per-recipient summary (SC-005). Interactive UI actions target <200ms perceived response.

**Constraints**: Sends are bound by the connected Gmail account's own rate/quota limits
(no platform-side warmup/throttling this version); serverless function execution time
bounds bulk-send batch size processed per invocation; 0% delivered emails may contain an
unresolved literal placeholder (SC-004)

**Scale/Scope**: Single job seeker managing up to a few thousand recruiter contacts;
bulk sends up to ~50 recipients per action for v1 (larger batches noted as future work
requiring a background queue). 5 prioritized user stories, 25 functional requirements.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Sendora Constitution v1.0.0.

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Type Safety & Simplicity | End-to-end TypeScript `strict`; Zod validates every trust boundary (file uploads, pasted rows, API inputs, OAuth callbacks, env vars); Drizzle gives typed rows. Single app, no premature services. `any` forbidden; `unknown` + narrowing at boundaries. | PASS |
| II. Test-First (NON-NEGOTIABLE) | Vitest + Playwright configured before feature code; each user story delivered test-first (failing test → implement). Every user-facing flow (import, single send, bulk send, template CRUD, history) gets integration coverage in addition to unit tests. | PASS |
| III. Accessibility by Default | UI composed from Astryx's WCAG-oriented primitives; the one custom interactive surface (rich-text editor) is held to WCAG 2.1 AA (keyboard operability, focus, labels) — verified in the accessibility checklist. | PASS |
| IV. UX Consistency via Design System | All UI built from Astryx components + theme tokens; no ad-hoc colors/spacing/typography. Rich-text editor (Tiptap) is a functional dependency wrapped and themed with Astryx tokens, not a styling bypass (see Complexity Tracking). | PASS |

**Technology stack alignment**: Next.js + Astryx + NeonDB matches the constitution's
ratified stack. New runtime dependencies (Auth.js, Drizzle, googleapis, Tiptap,
PapaParse, SheetJS, sanitize-html, Zod) are justified in `research.md`; none introduce a
new datastore or replace a stack pillar.

**Result**: PASS — no unjustified violations. Two justified complexity items tracked
below.

## Project Structure

### Documentation (this feature)

```text
specs/001-recruiter-outreach/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── README.md
│   ├── http-api.md          # Internal HTTP/route-handler contracts
│   └── email-provider.md    # Provider-agnostic sending seam contract
└── checklists/
    └── requirements.md  # Spec quality checklist (already created)
```

### Source Code (repository root)

```text
app/                              # Next.js App Router
├── (auth)/
│   └── sign-in/                  # Google sign-in entry
├── (app)/                        # Authenticated application shell
│   ├── contacts/                 # US1: import + manage recruiter contacts
│   ├── templates/                # US3: starter library + custom template CRUD
│   ├── compose/                  # US2 + US4: single and bulk send flows
│   ├── history/                  # US5: sending history + re-contact warnings
│   └── settings/
│       └── email-account/        # FR-019a: connect Gmail account
└── api/
    ├── auth/[...nextauth]/       # Auth.js route handler
    ├── contacts/                 # Contact CRUD + import route handlers
    ├── templates/                # Template CRUD
    ├── send/                     # Single + bulk send
    └── history/                  # Sending history queries

lib/
├── db/                           # Drizzle schema, client, migrations helpers
│   ├── schema.ts
│   └── client.ts
├── auth/                         # Auth.js config, Google OAuth + gmail.send scope
├── email/                        # Provider-agnostic sending
│   ├── provider.ts               # EmailProvider interface (the seam)
│   └── gmail-provider.ts         # Gmail implementation
├── import/                       # Contact import parsers → normalized rows
│   ├── csv.ts
│   ├── xlsx.ts
│   └── paste.ts
├── templates/                    # Merge-field rendering + validation
├── validation/                   # Zod schemas (shared trust-boundary contracts)
└── sanitize/                     # Server-side rich-text HTML sanitization

components/                       # Astryx-based UI components (themed)

tests/
├── unit/                         # Vitest unit tests (parsers, merge render, dedup)
├── contract/                     # Route-handler contract tests vs contracts/
├── integration/                  # Vitest integration (db + services)
└── e2e/                          # Playwright user-journey tests (per user story)
```

**Structure Decision**: Single Next.js App Router application (Project Type: web app).
No separate backend — route handlers and server actions provide the API surface, with
business logic in `lib/` modules that are independently unit-testable and free of
framework/UI coupling. Route groups (`(auth)`, `(app)`) separate the unauthenticated and
authenticated shells. The `lib/email` seam isolates provider specifics so Gmail is the
sole implementation now and additional providers slot in later (FR-019c).

## Complexity Tracking

> Justifications for deviations flagged in the Constitution Check.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Auth.js + Google OAuth + `gmail.send` scope (adds an auth/integration layer) | FR-019 requires sending from the job seeker's own Gmail; Google OAuth is the only way to obtain send authorization, and Google sign-in doubles as the assumed authentication dependency | A platform-side sender (no OAuth) was rejected in the spec (Option B); it would violate FR-019's "from the user's real address, replies to their inbox" |
| Tiptap rich-text editor (a non-Astryx interactive component) | FR-009a requires rich-text bodies (bold/italic/lists/links); Astryx provides no rich-text-editing primitive | Plain `<textarea>` rejected — cannot produce required formatted output; building a ProseMirror-equivalent from Astryx primitives is far higher effort. Tiptap is themed with Astryx tokens and held to the same a11y bar, so Principle IV intent is preserved |
