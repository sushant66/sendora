---

description: "Task list for Recruiter Outreach implementation"
---

# Tasks: Recruiter Outreach

**Input**: Design documents from `/specs/001-recruiter-outreach/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks are INCLUDED and ordered FIRST within each story — the Sendora
Constitution (Principle II) makes Test-First **NON-NEGOTIABLE**. Every test MUST be
written and MUST fail before its implementation task begins.

**Organization**: Tasks are grouped by user story so each story can be implemented,
tested, and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story the task serves (US1–US5); Setup/Foundational/Polish have none
- Exact file paths are included in every task

## Path Conventions

Single Next.js App Router app (per plan.md): `app/`, `lib/`, `components/`, `tests/` at
the repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and tooling

- [X] T001 Initialize Next.js (App Router) + TypeScript **strict** project at repo root (`tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess`)
- [X] T002 [P] Add core dependencies to `package.json`: Astryx, `drizzle-orm` + `drizzle-kit`, `@neondatabase/serverless`, `next-auth`, `googleapis`, `zod`, `@tiptap/*`, `papaparse`, `xlsx`, `sanitize-html`
- [X] T003 [P] Configure ESLint + Prettier including a rule/convention enforcing Astryx token usage (no ad-hoc colors/spacing — Principle IV) in `.eslintrc` / `prettier.config`
- [X] T004 [P] Configure Vitest + React Testing Library + Playwright with `test`, `test:e2e`, `test:a11y` scripts in `vitest.config.ts`, `playwright.config.ts`, `package.json`
- [X] T005 [P] Add `typecheck` and `lint` scripts to `package.json` (Principle I/IV gates)
- [X] T006 Configure drizzle-kit (`drizzle.config.ts`) + `db:generate` / `db:migrate` / `db:seed` scripts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting infrastructure every story depends on (DB access, login, app
shell, validation, testing harness). Sending-specific infra lives in US2, not here, so
US1 is not blocked by it.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Implement `EnvSchema` (Zod) and startup env validation in `lib/validation/env.ts` (DB URL, Google OAuth id/secret, `AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `APP_URL`)
- [X] T008 Implement the Drizzle client over the Neon serverless driver in `lib/db/client.ts`
- [X] T009 [P] Define base schema (User + Auth.js `account`/`session`/`verificationToken` tables) in `lib/db/schema.ts` and generate the initial migration
- [X] T010 Configure Auth.js (NextAuth v5) with the Google provider for login in `lib/auth/config.ts`
- [X] T011 Add the Auth.js route handler in `app/api/auth/[...nextauth]/route.ts`
- [X] T012 [P] Build the base app shell: Astryx theme provider (light/dark tokens), root layout, and `(auth)` + `(app)` route groups in `app/layout.tsx`, `app/(app)/layout.tsx`, `app/(auth)/sign-in/page.tsx`
- [X] T013 [P] Implement `getCurrentUser()` session helper + route protection enforcing per-user data scoping (FR-022) in `lib/auth/session.ts`
- [X] T014 [P] Implement structured logging + a shared error-handling utility in `lib/observability/logger.ts`
- [X] T015 [P] Implement shared API response helpers (JSON success + `422` validation-error shape, `401/403/404/409`) in `lib/http/responses.ts`
- [X] T016 [P] Add test infrastructure: DB test harness/fixtures and an authenticated-session test helper in `tests/helpers/`

**Checkpoint**: Foundation ready — user stories can begin.

---

## Phase 3: User Story 1 - Import recruiter contacts (Priority: P1) 🎯 MVP

**Goal**: A job seeker imports recruiter contacts (CSV / Excel / paste) and manages them
in a searchable, deduplicated list.

**Independent Test**: Upload a CSV and an `.xlsx`, paste rows, and add one manually;
confirm valid rows appear, duplicates are flagged, invalid rows are reported (not
silently dropped), and no partial contact is created for an invalid row.

### Tests for User Story 1 (write first, ensure they FAIL) ⚠️

- [X] T017 [P] [US1] Contract test for `/api/contacts` (POST/GET/PATCH/DELETE) and `/api/contacts/import` per `contracts/http-api.md` in `tests/contract/contacts.test.ts`
- [X] T018 [P] [US1] Unit tests for the three parsers (CSV/xlsx/paste) normalizing to the shared row shape in `tests/unit/import-parsers.test.ts`
- [X] T019 [P] [US1] Unit tests for validation + dedup + import summary (valid/duplicate/invalid rows) in `tests/unit/import-pipeline.test.ts`
- [X] T020 [P] [US1] E2E test of the import journey in `tests/e2e/contacts-import.spec.ts`

### Implementation for User Story 1

- [X] T021 [US1] Add `RecruiterContact` schema (+ unique `(user_id, email_normalized)`) to `lib/db/schema.ts` and generate migration
- [X] T022 [P] [US1] Define `ImportRowSchema` + `ContactInputSchema` (Zod) in `lib/validation/contacts.ts`
- [X] T023 [P] [US1] CSV parser in `lib/import/csv.ts` (PapaParse)
- [X] T024 [P] [US1] Excel parser in `lib/import/xlsx.ts` (SheetJS)
- [X] T025 [P] [US1] Paste parser (TSV/CSV detection) in `lib/import/paste.ts`
- [X] T026 [US1] Import pipeline (normalize → validate → dedup → summary) in `lib/import/pipeline.ts` (depends on T022–T025)
- [X] T027 [US1] Contacts service (create/edit/delete/search, dedup on normalized email) in `lib/contacts/service.ts`
- [X] T028 [US1] Contacts + import route handlers in `app/api/contacts/` (list/create/patch/delete + `import`)
- [X] T029 [US1] Contacts list + manual add/edit UI (Astryx) in `app/(app)/contacts/`
- [X] T030 [US1] Import UI: upload/paste, column auto-map + confirm, summary report (Astryx) in `app/(app)/contacts/import/`

**Checkpoint**: US1 fully functional and independently testable (MVP part 1).

---

## Phase 4: User Story 2 - Single templated send (Priority: P1) 🎯 MVP

**Goal**: A job seeker connects Gmail, picks a recruiter + starter template, previews the
merge-resolved email, edits it, and sends it — recorded as sent.

**Independent Test**: With a contact present and a connected account, select a starter
template, verify merge fields resolve, edit, send, and confirm a `sent` record (or a
clear failure). Builds the sending infrastructure reused by US4.

### Tests for User Story 2 (write first, ensure they FAIL) ⚠️

- [X] T031 [P] [US2] Contract test for `/api/email-account` (GET/connect/DELETE) per `contracts/http-api.md` in `tests/contract/email-account.test.ts`
- [X] T032 [P] [US2] Contract test for `/api/templates/preview` and single `POST /api/send` in `tests/contract/send-single.test.ts`
- [X] T033 [P] [US2] Unit test for merge-field rendering: resolves tokens, applies safe fallbacks, never emits a literal `{{token}}` (FR-012, SC-004) in `tests/unit/merge-render.test.ts`
- [X] T034 [P] [US2] Contract/format test asserting the Gmail provider builds valid base64url `multipart/alternative` MIME (per `contracts/email-provider.md`) in `tests/contract/gmail-mime.test.ts`
- [X] T035 [P] [US2] E2E single-send journey using the fake provider in `tests/e2e/send-single.spec.ts`

### Implementation for User Story 2

- [X] T036 [US2] Add `ConnectedEmailAccount` schema (status enum, encrypted tokens, `scopes`) to `lib/db/schema.ts` + migration
- [X] T037 [US2] Add `EmailTemplate` schema (+ `kind` system/custom) to `lib/db/schema.ts` + migration, and seed the starter (`system`) templates in `db:seed`
- [X] T038 [US2] Add `SendBatch` + `SendRecord` schemas (content snapshot, status) to `lib/db/schema.ts` + migration
- [X] T039 [P] [US2] Define the `EmailProvider` interface + provider factory in `lib/email/provider.ts` (per `contracts/email-provider.md`)
- [X] T040 [P] [US2] Implement the fake `EmailProvider` for tests in `lib/email/fake-provider.ts`
- [X] T041 [P] [US2] Merge-field vocabulary + renderer (`{{first_name}}` … `{{role}}`, fallbacks) in `lib/templates/merge.ts`
- [X] T042 [P] [US2] Server-side HTML sanitizer (strict allow-list: bold/italic/lists/links) in `lib/sanitize/index.ts`
- [X] T043 [US2] Implement the Gmail provider (token refresh, MIME assembly, error→result mapping, `gmail.send`) in `lib/email/gmail-provider.ts` (depends on T039)
- [X] T044 [US2] Email-account connect flow: incremental OAuth for `gmail.send`, encrypt/store refresh token, status handling (FR-019a/b) in `lib/email/account-service.ts` + `app/api/email-account/`
- [X] T045 [US2] Email-account UI (connect / disconnect / status) in `app/(app)/settings/email-account/`
- [X] T046 [US2] Template preview service + `POST /api/templates/preview` route (render for a contact, warnings) 
- [X] T047 [US2] Send service — single: render + sanitize → send via provider → snapshot `SendRecord` outcome, in `lib/send/service.ts` (depends on T039–T043)
- [X] T048 [US2] `POST /api/send` route handler (single path, requires `active` account → `409` else) in `app/api/send/`
- [X] T049 [US2] Compose UI: pick contact + template, live preview, edit subject/body, send (Astryx) in `app/(app)/compose/`

**Checkpoint**: US1 + US2 = working MVP (import a recruiter, connect Gmail, send a personalized email).

---

## Phase 5: User Story 3 - Create and manage custom templates (Priority: P2)

**Goal**: A job seeker authors rich-text templates with merge fields, saves/edits them,
and reuses them when sending.

**Independent Test**: Create a template with merge fields (unsupported tokens blocked
with a warning), reopen/edit/save, and confirm it is selectable in compose and renders
correctly.

### Tests for User Story 3 (write first, ensure they FAIL) ⚠️

- [X] T050 [P] [US3] Contract test for `/api/templates` CRUD incl. `422 unsupported_merge_fields` in `tests/contract/templates.test.ts`
- [X] T051 [P] [US3] Unit test for template token validation at save (FR-011) in `tests/unit/template-validate.test.ts`
- [X] T052 [P] [US3] Accessibility E2E test for the rich-text editor (keyboard operability, labelled controls, focus) — Principle III — in `tests/e2e/editor-a11y.spec.ts`
- [X] T053 [P] [US3] E2E create/edit/reuse template journey in `tests/e2e/templates.spec.ts`

### Implementation for User Story 3

- [X] T054 [P] [US3] `TemplateInputSchema` + merge-token validation (against the supported vocabulary) in `lib/validation/templates.ts`
- [X] T055 [US3] Template service — custom CRUD, sanitize on save, derive `body_text` + `merge_fields` in `lib/templates/service.ts`
- [X] T056 [US3] `POST/PATCH/DELETE /api/templates` route handlers (system templates read-only → `403`) in `app/api/templates/`
- [X] T057 [US3] Tiptap rich-text editor component — constrained marks, Astryx-themed, accessible toolbar — in `components/rich-text-editor/`
- [X] T058 [US3] Templates library UI (list starter + custom, create/edit/delete) in `app/(app)/templates/`

**Checkpoint**: US1–US3 independently functional.

---

## Phase 6: User Story 4 - Bulk send to multiple recruiters (Priority: P2)

**Goal**: A job seeker selects multiple recruiters + a template, reviews per-recipient
previews, sends individually personalized emails in one action, and sees a per-recipient
result summary.

**Independent Test**: Select several contacts + a template, confirm each recipient gets
an individually personalized separate email, send, and verify the per-recipient
success/failure summary; a duplicate-selected recruiter receives only one email.

### Tests for User Story 4 (write first, ensure they FAIL) ⚠️

- [X] T059 [P] [US4] Contract test for bulk `POST /api/send` (per-recipient results, partial failure) in `tests/contract/send-bulk.test.ts`
- [X] T060 [P] [US4] Unit test for recipient dedup within a send (FR-016) in `tests/unit/send-dedup.test.ts`
- [X] T061 [P] [US4] Integration test: partial failure preserves successful sends (fake provider, FR-018) in `tests/integration/bulk-partial.test.ts`
- [X] T062 [P] [US4] E2E bulk-send journey (per-recipient summary, no recipient disclosure, dup-once) in `tests/e2e/send-bulk.spec.ts`

### Implementation for User Story 4

- [X] T063 [US4] Extend the send service for batches: dedup → per-recipient send → aggregate + per-recipient results, no rollback (FR-016/17/18) in `lib/send/service.ts`
- [X] T064 [US4] `BulkSendSchema` + bulk path in `app/api/send/` (mid-batch account-inactive handling, FR-019b)
- [X] T065 [US4] Bulk compose UI: multi-select recruiters, per-recipient previews, result summary (Astryx) in `app/(app)/compose/`

**Checkpoint**: US1–US4 independently functional.

---

## Phase 7: User Story 5 - Review sending history (Priority: P3)

**Goal**: A job seeker reviews sent emails (recipient, template, time, outcome) and is
warned before re-contacting a recruiter.

**Independent Test**: After single and bulk sends, open history and confirm each send is
listed with recipient/template/timestamp/outcome; starting a send to an already-emailed
recruiter shows the re-contact warning.

### Tests for User Story 5 (write first, ensure they FAIL) ⚠️

- [X] T066 [P] [US5] Contract test for `GET /api/history` and `/api/history/recontact` in `tests/contract/history.test.ts`
- [X] T067 [P] [US5] E2E history + re-contact warning journey in `tests/e2e/history.spec.ts`

### Implementation for User Story 5

- [X] T068 [US5] History service (paginated list, re-contact lookup by `(user_id, contact_id)`) in `lib/history/service.ts`
- [X] T069 [US5] `GET /api/history` + `/api/history/recontact` route handlers in `app/api/history/`
- [X] T070 [US5] Sending-history UI (list of sends, outcomes) in `app/(app)/history/`
- [X] T071 [US5] Integrate the re-contact warning into single + bulk compose (FR-021)

**Checkpoint**: All user stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Constitution gates, edge cases, and open-source-quality finishing

- [X] T072 [P] Unit tests for edge cases: empty/oversized/unrecognized import files, malformed emails (spec Edge Cases) in `tests/unit/import-edge-cases.test.ts`
- [~] T073 [P] Accessibility audit across all screens to WCAG 2.1 AA (Principle III); fix findings — run `pnpm test:a11y`
  - Built accessibly on Astryx primitives; `tests/e2e/editor-a11y.spec.ts` covers the one
    custom control. The **cross-screen automated audit** (`pnpm test:a11y` / axe) needs the
    live browser env — pending with T078.
- [X] T074 [P] Design-system lint sweep: no ad-hoc styling, all UI on Astryx tokens (Principle IV)
  - Swept: zero raw hex, zero raw px (the editor min-height now uses spacing tokens). Numeric
    Astryx size props (e.g. `width={440}`) are the design system's own API, not ad-hoc styling.
- [~] T075 Verify `pnpm typecheck` (zero errors, Principle I) and full `pnpm test` + `pnpm test:e2e` green (Principle II)
  - `pnpm typecheck` ✓, `pnpm test` ✓ (89 unit/contract/integration), `pnpm build` ✓.
    `pnpm test:e2e` requires the live app + DB and is pending with T078.
- [X] T076 [P] Author repo docs to open-source standards: `README.md`, architecture notes, `CONTRIBUTING.md`, `.env.example`
- [X] T077 Security hardening review: refresh-token encryption at rest, least-privilege `gmail.send` scope, secrets never committed, per-user scoping (FR-022) spot-checked
- [ ] T078 Run `quickstart.md` end-to-end validation against a real NeonDB + Google OAuth client
  - ⏳ **Manual step — requires live credentials.** Provision a NeonDB database and a Google
    OAuth client (Gmail API enabled, `gmail.send` scope, redirect URIs set), fill `.env`,
    then run `pnpm db:migrate && pnpm db:seed && pnpm dev` and walk the US1–US5 journeys.
    Also runs the browser suites that need the live app: `pnpm test:e2e` and `pnpm test:a11y`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately
- **Foundational (Phase 2)**: depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: depends on Foundational only
- **US2 (Phase 4)**: depends on Foundational; its E2E uses US1's manual-add to have a contact (build US1 first for the MVP)
- **US3 (Phase 5)**: depends on Foundational; independent of US2 (enhances the template picker US2 uses)
- **US4 (Phase 6)**: depends on US2 (reuses the sending service + provider seam) and US1 (contacts)
- **US5 (Phase 7)**: depends on US2 (send records must exist)
- **Polish (Phase 8)**: after all targeted stories

### Within Each User Story

- Tests (all `[P]`) are written FIRST and must FAIL before implementation (Principle II)
- DB schema → validation → services → route handlers → UI
- Story complete and independently testable before the next priority

### Parallel Opportunities

- Setup: T002–T005 in parallel
- Foundational: T009, T012–T016 in parallel after T007/T008
- Within a story: all test tasks `[P]` run together; parser/model/schema tasks marked `[P]` run together
- With multiple developers after Foundational: US1 and US3 can proceed in parallel; US2 in parallel with US3; US4/US5 follow US2

---

## Parallel Example: User Story 1

```bash
# Write all US1 tests first (they must fail):
Task: "Contract test for /api/contacts in tests/contract/contacts.test.ts"      # T017
Task: "Unit tests for CSV/xlsx/paste parsers in tests/unit/import-parsers.test.ts"  # T018
Task: "Unit tests for validation+dedup+summary in tests/unit/import-pipeline.test.ts" # T019
Task: "E2E import journey in tests/e2e/contacts-import.spec.ts"                  # T020

# Then the parallel parsers/validation:
Task: "CSV parser in lib/import/csv.ts"      # T023
Task: "Excel parser in lib/import/xlsx.ts"   # T024
Task: "Paste parser in lib/import/paste.ts"  # T025
Task: "Zod schemas in lib/validation/contacts.ts"  # T022
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 US1 (import + manage contacts) → validate independently
3. Phase 4 US2 (connect Gmail + single templated send) → validate independently
4. **STOP and VALIDATE**: import a recruiter, connect Gmail, send a personalized email (SC-002)
5. Demo / deploy the MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. + US1 → contacts working (demo)
3. + US2 → sending working (MVP demo)
4. + US3 → custom templates
5. + US4 → bulk send
6. + US5 → history + re-contact warnings
7. Each story adds value without breaking the previous ones

---

## Notes

- `[P]` = different files, no dependency on incomplete work
- `[Story]` label traces each task to its user story
- Tests are NOT optional here — Principle II requires them written first and failing before implementation
- Commit after each task or logical group (git extension auto-commit is available)
- Stop at any checkpoint to validate a story independently
- Total tasks: **78** — Setup 6, Foundational 10, US1 14, US2 19, US3 9, US4 7, US5 6, Polish 7
