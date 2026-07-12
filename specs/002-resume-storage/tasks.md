---

description: "Task list for Resume Storage implementation"
---

# Tasks: Resume Storage

**Input**: Design documents from `/specs/002-resume-storage/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks are INCLUDED and ordered FIRST within each story — the Sendora
Constitution (Principle II) makes Test-First **NON-NEGOTIABLE**. Every test MUST be
written and MUST fail before its implementation task begins.

**Organization**: Tasks are grouped by user story so each story can be implemented,
tested, and demoed independently. This feature extends the existing single Next.js app
from `001-recruiter-outreach` — shared infrastructure (env validation, DB client, auth
session helper, HTTP response helpers, logger, test harness) already exists and is reused,
not rebuilt.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story the task serves (US1–US4); Setup/Foundational/Polish have none
- Exact file paths are included in every task

## Path Conventions

Single Next.js App Router app (per plan.md): `app/`, `lib/`, `components/`, `tests/` at
the repository root — same layout as `001-recruiter-outreach`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New dependency and configuration this feature needs; everything else
(project scaffold, linting, test tooling) already exists from `001-recruiter-outreach`

- [ ] T001 [P] Add an S3-compatible client dependency (`@aws-sdk/client-s3`) to `package.json` for Cloudflare R2 access
- [ ] T002 Add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` to `EnvSchema` in `lib/validation/env.ts` and to `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The storage wrapper and the `resume` table every user story reads or writes

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Implement the R2 storage wrapper (`uploadObject` / `getObjectStream` / `deleteObject`) in `lib/storage/r2-client.ts`
- [ ] T004 [P] Implement a fake storage client with the same three-function shape, for tests, in `lib/storage/fake-r2-client.ts` (mirrors `lib/email/fake-provider.ts`)
- [ ] T005 [P] Add the `resume` table (`id`, `userId`, `label`, `version`, `fileName`, `storageKey`, `fileSize`, `deletedAt`, `createdAt`, `updatedAt`; partial unique index `(userId, label)` WHERE `deletedAt IS NULL`; unique index `(userId, label, version)`; index `(userId, label)`) to `lib/db/schema.ts` and generate the migration

**Checkpoint**: Foundation ready — user stories can begin.

---

## Phase 3: User Story 1 - Save a labeled resume (Priority: P1) 🎯 MVP

**Goal**: A job seeker uploads a PDF resume with a label and it's saved.

**Independent Test**: Upload a PDF with a label and confirm it's saved; confirm a
duplicate label, a non-PDF file, an oversized file, and a missing label are each rejected
with a clear error and nothing is saved.

### Tests for User Story 1 (write first, ensure they FAIL) ⚠️

- [X] T006 [P] [US1] Contract test for `POST /api/resumes` (201, `422` validation, `409 label_taken`, `409 resume_limit_reached`) per `contracts/http-api.md` in `tests/contract/resumes-upload.test.ts`
  - Needed `// @vitest-environment node`: jsdom's File/FormData don't interop with NextRequest's formData() parsing (silently corrupts multipart bodies) — documented inline in the test file.
- [X] T007 [P] [US1] Unit tests for `ResumeLabelSchema` + `ResumeUploadSchema`, including the `%PDF-` magic-byte check rejecting a `.pdf`-renamed non-PDF, in `tests/unit/resumes-validation.test.ts`
- [X] T008 [P] [US1] Unit test for `nextResumeVersion` (the pure version-numbering helper extracted from `uploadResume`: starts at 1, is one past the prior max, ignores gaps) in `tests/unit/resumes-service-upload.test.ts` (label uniqueness and the 20-active cap are DB constraints/queries — verified by the migration's partial unique index plus contract/e2e coverage, not a DB-free unit test, matching this repo's existing convention of not unit-testing DB-touching CRUD directly — see `lib/contacts/service.ts`)
- [X] T009 [P] [US1] E2E upload journey: success, duplicate-label error, non-PDF rejected, oversized file rejected, missing-label rejected in `tests/e2e/resumes-upload.spec.ts`

### Implementation for User Story 1

- [X] T010 [P] [US1] Define `ResumeLabelSchema` (trimmed, 1-150 chars) + `ResumeUploadSchema` (≤10MB, `application/pdf` content-type + `%PDF-` magic-byte refinement) in `lib/validation/resumes.ts`
- [X] T011 [US1] Implement `uploadResume(userId, { label, file })` in `lib/resumes/service.ts` + `lib/resumes/types.ts` (depends on T003-T005, T010)
- [X] T012 [US1] `POST /api/resumes` route handler (multipart via `request.formData()`, auth → validate → delegate → map via `route()`) in `app/api/resumes/route.ts`
- [X] T013 [US1] Resumes page + upload dialog (Astryx) in `app/(app)/resumes/page.tsx` + `components/resumes/resumes-view.tsx` + `components/resumes/upload-dialog.tsx` + `components/resumes/resume-list.tsx` (built together for a working list, not just the upload form — path names refined from the original task description; formal `impeccable` design review deferred to the Polish phase, T036, once all 4 stories' UI exists)
- [X] T014 [US1] Add a "Resumes" nav entry (+ `ResumesIcon`) to the (app) shell in `components/app-sidebar.tsx` + `components/app-icons.tsx`

**Checkpoint**: US1 fully functional and independently testable (MVP part 1).

---

## Phase 4: User Story 2 - Browse and open saved resumes (Priority: P1) 🎯 MVP

**Goal**: A job seeker sees all their saved resumes and opens one to confirm its contents.

**Independent Test**: Save a couple of resumes (via US1), list them (label, file name,
save date), open one and confirm it's the exact PDF uploaded; confirm an empty list shows
a clear empty state, not an error.

### Tests for User Story 2 (write first, ensure they FAIL) ⚠️

- [X] T015 [P] [US2] Contract test for `GET /api/resumes` (list) and `GET /api/resumes/:id` (stream, `404` not owned) per `contracts/http-api.md` in `tests/contract/resumes-list.test.ts`
- [X] T016 [P] [US2] Unit test for `toResume` (the pure row-to-DTO mapping used by `listResumes`/`getResumeFile`: derives `status` from `deletedAt`, never leaks `storageKey`) in `tests/unit/resumes-service-list.test.ts` (the query behavior itself — active-only default, ordering, ownership scoping — is DB-dependent and covered by contract tests + e2e, matching this repo's existing convention)
- [X] T017 [P] [US2] E2E browse-and-open journey, including the empty-list state, in `tests/e2e/resumes-list.spec.ts`

### Implementation for User Story 2

- [X] T018 [US2] Implement `listResumes(userId, { includeArchived })` and `getResumeFile(userId, id)` in `lib/resumes/service.ts`
- [X] T019 [US2] `GET /api/resumes` route handler (`?includeArchived=`) in `app/api/resumes/route.ts`
- [X] T020 [US2] `GET /api/resumes/:id` route handler (streams the PDF, `Content-Disposition: inline`) in `app/api/resumes/[id]/route.ts`
- [X] T021 [US2] Resumes list UI (label, file name, save date, open link, loading skeleton, empty state) in `app/(app)/resumes/page.tsx` + `components/resumes/resume-list.tsx` + `components/resumes/resumes-view.tsx`

**Checkpoint**: US1 + US2 = working MVP (save a resume, then find and open it).

---

## Phase 5: User Story 3 - Remove a resume no longer needed (Priority: P2)

**Goal**: A job seeker deletes a saved resume they no longer need.

**Independent Test**: Delete an active resume and confirm it disappears from the list
while other resumes are unaffected; confirm deleting it again produces a clear error.

### Tests for User Story 3 (write first, ensure they FAIL) ⚠️

- [X] T022 [P] [US3] Contract test for `DELETE /api/resumes/:id` (`204`, `404` if already archived or not owned) in `tests/contract/resumes-delete.test.ts` (deleting has no DB-free pure logic to extract, unlike US1/US2/US4 — file retention, FR-009/010, is a service/DB concern verified here plus e2e + quickstart, not a standalone unit test)
- [X] T024 [P] [US3] E2E delete journey (remove, confirm gone, re-delete error) in `tests/e2e/resumes-delete.spec.ts`

### Implementation for User Story 3

- [X] T025 [US3] Implement `deleteResume(userId, id)` in `lib/resumes/service.ts`
- [X] T026 [US3] `DELETE /api/resumes/:id` route handler in `app/api/resumes/[id]/route.ts`
- [X] T027 [US3] Delete action (MoreMenu) + confirmation UI (AlertDialog, state owned by `resumes-view.tsx`) in `components/resumes/resume-list.tsx` + `components/resumes/resumes-view.tsx`
  - Note: `MoreMenu`/`DropdownMenu` items only support `onClick`, not `href`/`target` — the
    "Open" action (added in US2) uses `window.open` from an `onClick`, not a real `<a>` link;
    the US2 e2e test was adjusted to match (menuitem, not role=link).

**Checkpoint**: US1-US3 independently functional.

---

## Phase 6: User Story 4 - Replace a resume without losing the old one (Priority: P3)

**Goal**: A job seeker uploads a new resume under an existing label and can view or
restore an earlier version instead of losing it.

**Independent Test**: Upload a new resume under a label with an existing active resume;
confirm the previous version becomes retrievable history and the new one is active; view
that label's history; restore an earlier version and confirm it becomes active again while
the version it replaced becomes history.

### Tests for User Story 4 (write first, ensure they FAIL) ⚠️

- [X] T028 [P] [US4] Contract test for `POST /api/resumes/:id/restore` (`200`, `404` if not archived or not owned) and `GET /api/resumes?includeArchived=true` grouping in `tests/contract/resumes-restore.test.ts` (the restore-swap transaction and version-numbering-across-cycles guarantees are DB-dependent — no pure logic to extract beyond `nextResumeVersion`, already covered by T008 — so they're verified by e2e + quickstart, not a standalone unit/integration test, matching this repo's convention for DB-touching orchestration)
- [X] T031 [P] [US4] E2E replace + view history + restore journey, including that version numbers never reset or repeat across an archive-then-reupload-then-restore cycle, in `tests/e2e/resumes-restore.spec.ts`

### Implementation for User Story 4

- [X] T032 [US4] Implement `restoreResume(userId, id)` (archive-then-reactivate swap) in `lib/resumes/service.ts`
  - Note: this project's Neon HTTP driver (`drizzle-orm/neon-http`) has no `db.transaction()`
    support — it throws "No transactions support in neon-http driver". Used `db.batch([...])`
    (Neon's atomic HTTP batch) instead, which gives the same atomicity guarantee. Worth
    knowing for any future feature on this driver that assumes `db.transaction` exists.
- [X] T033 [US4] `POST /api/resumes/:id/restore` route handler in `app/api/resumes/[id]/restore/route.ts`
- [X] T034 [US4] Per-label version-history UI in `components/resumes/resume-list.tsx` (using Astryx's `useTableRowExpansionState`/`useTableRowExpansion`, discovered via the astryx CLI, rather than a separate `resume-history.tsx` — the built-in expansion chevron ("Expand row"/"Collapse row") replaces the "View history" menu item originally planned) + `components/resumes/resumes-view.tsx` (fetches `includeArchived=true` once and derives the active-resume-with-history tree client-side, rather than a second lazy-loaded endpoint)
  - Known edge case, not explicitly required by the spec: once every version of a label is
    archived (no active resume), that label's history has no parent row to nest under and
    temporarily disappears from this UI (still retrievable via the API) until the label is
    reused by a new upload, at which point its full history reappears. Worth a follow-up if
    it turns out to matter in practice.

**Checkpoint**: All user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Constitution gates and edge cases across all four stories

- [X] T035 [P] Unit tests for the file-size boundary (exactly 10MB accepted, 10MB+1 rejected) in `tests/unit/resumes-edge-cases.test.ts` (renamed-non-PDF content is already covered by T007; the near-simultaneous-same-label race and restoring an already-active version are DB-dependent — the latter got a dedicated contract-test case once this polish pass caught that `restoreResume` incorrectly 404'd instead of no-op'ing on an already-active target, now fixed and covered in `tests/contract/resumes-restore.test.ts`)
- [X] T036 [P] Accessibility pass on the `/resumes` page (upload form, list, delete confirmation, restore, history expand) to WCAG 2.1 AA, via the `impeccable` skill's `audit` command per this repo's CONTRIBUTING.md mandate. One real finding: archived (history) rows exposed bare "Open"/"Restore" buttons with no per-row context, so a screen reader user tabbing through several expanded versions heard repeated identical "Restore, button" announcements (WCAG 4.1.2). Fixed by consolidating archived-row actions into a `MoreMenu` labeled `Actions for {label} version {version}`, matching the active-row pattern. Everything else (contrast, tokens-only styling, the built-in expansion chevron's `aria-label`/`aria-expanded`) was already clean.
  - `pnpm test:a11y` (Playwright) itself needs a live app + DB, same limitation as T041 — the audit above is a static/code-level review, not a substitute for running it; do so during T041's live validation.
- [X] T037 [P] Design-system lint sweep: no ad-hoc styling on the new Resumes UI (Principle IV) — confirmed as part of T036's audit (zero raw hex/px/className styling in any new file, Astryx components + tokens only)
- [X] T038 Verify `pnpm typecheck` (zero errors), full `pnpm test` (132 unit/contract, all green), `pnpm lint` (zero errors, whole repo) — additionally ran `pnpm build` (production build, all 23 routes including the 3 new `/api/resumes*` routes and `/resumes` compile cleanly) as a stronger check than typecheck alone. `pnpm test:e2e` needs a live app + DB, same as T041 below — pending live validation
- [X] T039 [P] Update `README.md` (Features, Tech stack, prerequisites, env var list, docs links) and `.env.example` (done in Setup, T002) with the new R2 environment variables and the Resumes feature
- [X] T040 Security/isolation review: every resumes query scoped to `userId` (FR-014), unauthorized/unknown ids return `404` (never confirm existence), R2 credentials never reach the client
  - Verified every query in `lib/resumes/service.ts` filters on `eq(resumes.userId, userId)`,
    except 3 writes/reads in `restoreResume` keyed by `resumes.id` alone — those operate on
    `target.id`/`currentActive.id`, ids already proven to belong to `userId` by the
    preceding ownership-checked SELECT in the same function, not on raw request input, so
    this is the standard "verify once, act on the verified row's own key" pattern, not a
    bypass.
  - `getResumeFile`/`deleteResume`/`restoreResume` all throw the same `NotFoundError` for
    both "doesn't exist" and "not owned" — never a `403` that would confirm existence.
  - R2 credentials (`R2_*` env vars) are read only in `lib/storage/r2-client.ts`, imported
    only by `lib/resumes/service.ts` (server-only); no `"use client"` component imports
    either module — all client code goes through `apiRequest()` against our own routes.
    No `NEXT_PUBLIC_` prefix, so nothing R2-related is inlined into the client bundle either.
- [ ] T041 Run `quickstart.md` end-to-end validation against a real NeonDB + R2 bucket
  - ⏳ **Manual step — requires live credentials**, same as `001-recruiter-outreach`'s T078.
    Provision a NeonDB database (or reuse the existing one) and a Cloudflare R2 bucket +
    API token, fill `.env` (see the updated `.env.example`), then run
    `pnpm db:migrate && pnpm dev` and walk the US1-US4 journeys. Also runs the browser
    suites that need the live app: `pnpm test:e2e` and `pnpm test:a11y`.
  - What's already verified without live infra: `pnpm typecheck`, `pnpm test` (132 passing),
    `pnpm lint` (whole repo), and `pnpm build` (production build, all routes compile) — see
    T038. The migration SQL itself was generated and inspected (T005); it was not applied
    to a real database.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately
- **Foundational (Phase 2)**: depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: depends on Foundational only
- **US2 (Phase 4)**: depends on Foundational; needs a resume to exist to open one, so build US1 first for the MVP (both are P1)
- **US3 (Phase 5)**: depends on Foundational and a resume to delete (US1)
- **US4 (Phase 6)**: depends on Foundational and US1 (needs an existing active resume under a label to replace)
- **Polish (Phase 7)**: after all targeted stories

### Within Each User Story

- Tests (all `[P]`) are written FIRST and must FAIL before implementation (Principle II)
- Validation schema → service → route handler → UI
- Story complete and independently testable before the next priority

### Parallel Opportunities

- Setup: T001-T002 in parallel
- Foundational: T004-T005 in parallel after T003
- Within a story: all test tasks `[P]` run together
- With multiple developers after Foundational: US1 must land before US2-US4 can be meaningfully demoed (they all need a saved resume to act on), but US2/US3/US4 implementation work can proceed in parallel once US1's schema + service scaffolding (T005, T011) exist

---

## Parallel Example: User Story 1

```bash
# Write all US1 tests first (they must fail):
Task: "Contract test for POST /api/resumes in tests/contract/resumes-upload.test.ts"        # T006
Task: "Unit tests for label/file validation in tests/unit/resumes-validation.test.ts"        # T007
Task: "Unit tests for uploadResume in tests/unit/resumes-service-upload.test.ts"              # T008
Task: "E2E upload journey in tests/e2e/resumes-upload.spec.ts"                                # T009

# Then the parallelizable implementation:
Task: "ResumeLabelSchema + ResumeUploadSchema in lib/validation/resumes.ts"  # T010
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 US1 (save a labeled resume) → validate independently
3. Phase 4 US2 (browse and open) → validate independently
4. **STOP and VALIDATE**: upload and label a resume, find and open it from the list (SC-001, SC-002)
5. Demo / deploy the MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. + US1 → saving works (demo)
3. + US2 → browsing/opening works (MVP demo)
4. + US3 → cleanup (delete)
5. + US4 → replace-with-history and restore
6. Each story adds value without breaking the previous ones

---

## Notes

- `[P]` = different files, no dependency on incomplete work
- `[Story]` label traces each task to its user story
- Tests are NOT optional here — Principle II requires them written first and failing
  before implementation
- Commit after each task or logical group (git extension auto-commit is available but
  disabled by this repo's config — commit manually, proposing the message first)
- Stop at any checkpoint to validate a story independently
- Total tasks: **39** — Setup 2, Foundational 3, US1 9, US2 7, US3 5, US4 6, Polish 7
- T023 and T030 from the original breakdown were folded into T022 and T028 respectively,
  once implementation revealed they had no DB-free logic to unit-test independently of the
  contract test — see those tasks' notes
