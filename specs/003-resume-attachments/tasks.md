---

description: "Task list for Resume Attachments implementation"
---

# Tasks: Resume Attachments

**Input**: Design documents from `/specs/003-resume-attachments/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks are INCLUDED and ordered FIRST within each story — the Sendora
Constitution (Principle II) makes Test-First **NON-NEGOTIABLE**. Every test MUST be
written and MUST fail before its implementation task begins.

**Organization**: Tasks are grouped by user story so each story can be implemented,
tested, and demoed independently. This feature extends existing domains
(`lib/send`, `lib/email`, `lib/history`, `lib/resumes`) from `001-recruiter-outreach` and
`002-resume-storage` — no new domain, no new external dependency, no new environment
variable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story the task serves (US1-US3); Setup/Foundational/Polish have none
- Exact file paths are included in every task

## Path Conventions

Single Next.js App Router app (per plan.md): `app/`, `lib/`, `components/`, `tests/` at
the repository root — same layout as `001-recruiter-outreach` and `002-resume-storage`.

---

## Phase 1: Setup

**Purpose**: Project initialization for this feature

No setup tasks — this feature introduces no new runtime dependency and no new environment
variable (unlike 002-resume-storage's R2 addition). All shared infrastructure it needs
already exists.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The schema column and provider-seam plumbing both US1 and US2 depend on

**⚠️ CRITICAL**: No US1/US2 work can begin until this phase is complete. (US3 does not
depend on this phase at all — see Dependencies below.)

- [X] T001 [P] Add a nullable `attachedResumeId` column (`text`, FK → `resumes.id`, `onDelete: "set null"` — mirrors the existing `templateId` column exactly) to `sendBatches` in `lib/db/schema.ts` and generate the migration
  - Migration `drizzle/0005_yummy_multiple_man.sql` generated and applied to the live NeonDB.
- [X] T002 [P] Extend `OutgoingMessage` in `lib/email/provider.ts` with an optional `attachment: { fileName: string; contentType: "application/pdf"; content: Buffer }` field
- [X] T003 [P] Extend the fake `EmailProvider` in `lib/email/fake-provider.ts` to record the `attachment` it received on each `sendEmail` call, so tests can assert it was passed identically to every recipient
  - No code change needed: `FakeEmailProvider.sendEmail` already pushes the whole `{ message, creds }` object, so `message.attachment` is captured automatically now that the field exists on `OutgoingMessage`. Verified, not modified.

**Checkpoint**: Foundation ready — US1 and US2 can begin; US3 could already have started.

---

## Phase 3: User Story 1 - Attach a resume when sending outreach emails (Priority: P1) 🎯 MVP

**Goal**: A job seeker picks one of their saved resumes in Compose and it goes out as a PDF
attachment on every recipient in that send, single or bulk.

**Independent Test**: Compose a send (single or bulk), select a saved resume, confirm the
preview shows it, send, and confirm every recipient receives the identical resume PDF
attached; confirm leaving the selector on "No attachment" sends exactly as before.

### Tests for User Story 1 (write first, ensure they FAIL) ⚠️

- [X] T004 [P] [US1] Unit tests for `buildRawMessage`'s attachment branch in `tests/unit/mime-attachment.test.ts`: the no-attachment case stays byte-identical to today's output (regression guard), and the attachment case produces a valid base64url nested `multipart/mixed` > `multipart/alternative` + attachment-part message with the expected headers (per `contracts/email-provider.md`)
  - Landed in `tests/contract/gmail-mime.test.ts` instead of a new file — it already tests
    this exact function; a separate file would have fragmented `buildRawMessage` coverage.
- [X] T005 [P] [US1] Unit tests for the resume-stream-to-Buffer helper and the pre-send size-limit guard (representative-message-size check against the provider's raw-message ceiling) in `tests/unit/send-attachment.test.ts`
- [X] T006 [P] [US1] Extend contract tests for `POST /api/send` with `resumeId` per `contracts/http-api.md`: 200 attached (identical attachment recorded by the fake provider for every recipient), 404 unknown/unowned resume, 409 `resume_unavailable` (archived resume), 409 `attachment_too_large`, in `tests/contract/send-single.test.ts` and `tests/contract/send-bulk.test.ts`
- [X] T007 [P] [US1] E2E in `tests/e2e/send-single.spec.ts` and `tests/e2e/send-bulk.spec.ts`: select a resume in Compose, confirm the preview shows the attachment line, send (single and bulk) with a resume attached; confirm the existing no-attachment scenarios are unaffected

### Implementation for User Story 1

- [X] T008 [US1] Add the `multipart/mixed` branch to `buildRawMessage` in `lib/email/mime.ts`, gated on `message.attachment` being present; no change to the no-attachment code path (depends on T002)
- [X] T009 [US1] Add `resumeId: z.string().min(1).optional()` to `SendRequestSchema` in `lib/validation/send.ts`
  - Note: `sendEmails`'s own resumeId ownership/active-status/attach wiring (the DB-touching
    orchestration) is not separately unit-tested — matching this repo's existing convention
    (see 002-resume-storage's tasks.md notes) of covering DB-dependent orchestration via
    contract tests (route pass-through, T006) + e2e (T007) + the live quickstart (T029),
    not a fake-DB unit test. Only the pure pieces (mime, stream-to-buffer, size guard,
    `runSendLoop` threading) are unit-tested directly (T004/T005).
- [X] T010 [US1] Implement the resume-stream-to-Buffer helper and the pre-send size-limit check in `lib/send/service.ts` (depends on T002)
- [X] T011 [US1] In `sendEmails` (`lib/send/service.ts`): validate `resumeId` ownership (404) and active status (409 `resume_unavailable`), fetch its bytes once per batch, run the size guard (409 `attachment_too_large`), thread the same attachment through every `runSendLoop`/`provider.sendEmail` call, and set `sendBatches.attachedResumeId` (depends on T001, T008, T009, T010)
- [X] T012 [US1] Add a "Resume" `Selector` to `components/compose/compose-view.tsx` (mirrors the existing "Template" selector: active resumes only via the existing `GET /api/resumes` call, defaults to no attachment) and an attachment line in `components/compose/email-preview.tsx`

**Checkpoint**: US1 fully functional and independently testable (MVP).

---

## Phase 4: User Story 2 - See attachment history and resend it (Priority: P2)

**Goal**: A job seeker sees which resume (if any) was attached to a past send, and a resend
of that batch reattaches the same resume automatically.

**Independent Test**: Send with a resume attached (US1), view that send in History and
confirm the resume is shown, resend it and confirm the same resume is attached again; a
send with no attachment shows nothing suggesting one.

### Tests for User Story 2 (write first, ensure they FAIL) ⚠️

- [X] T013 [P] [US2] Extend contract tests in `tests/contract/history.test.ts`: `GET /api/history` and `GET /api/history/:id` return `attachedResume` (label + fileName) when set and omit/null it otherwise; `POST /api/history/:id/resend` reattaches the original batch's resume, and degrades gracefully (sends without it, `attachmentDropped: true`) when it can't be resolved
- [X] T014 [P] [US2] E2E in `tests/e2e/history.spec.ts`: a past send's attached resume is visible in the list/detail view, and resending it reattaches the same resume with no re-selection

### Implementation for User Story 2

- [X] T015 [US2] Left-join `resume` on `sendBatches.attachedResumeId` in `listHistory`/`getHistoryDetail`; add `attachedResume: { label, fileName } | null` to `HistoryEvent`/`HistoryDetail` in `lib/history/service.ts` + `lib/history/types.ts` (depends on T001)
- [X] T016 [US2] In `resendRecord` (`lib/send/service.ts`): look up the original batch's `attachedResumeId` via the record's `batchId`, re-resolve it with `getResumeFile`, reattach and set the new batch's `attachedResumeId` on success, or proceed without it and report `attachmentDropped: true` on `ResendResult` (`lib/history/types.ts`) on failure — never fail the resend itself (depends on T001, T002, T015)
- [X] T017 [US2] Show the attached resume (label + file name) in `components/history/history-view.tsx` and `components/history/history-detail-drawer.tsx`; toast when a resend's attachment was dropped (depends on T015, T016)

**Checkpoint**: US1 + US2 independently functional (attach-and-send, then see/resend it).

---

## Phase 5: User Story 3 - Give a resume a clean file name recipients will see (Priority: P2)

**Goal**: A job seeker can set a custom file name for a resume at upload or update time, so
recipients see a clean name on the email attachment.

**Independent Test**: Upload (or update) a resume with a custom file name and confirm both
the resume list and a subsequent sent attachment show that exact, normalized name.

This story does not depend on the Foundational phase or US1/US2 — it only touches
002-resume-storage's existing code. It can be built any time; sequenced here by priority.

### Tests for User Story 3 (write first, ensure they FAIL) ⚠️

- [X] T018 [P] [US3] Unit tests for `ResumeFileNameSchema` in `tests/unit/resumes-validation.test.ts`: strips unsafe characters, appends `.pdf` when missing (case-insensitive), and falls back to the source file's own name when nothing usable remains after stripping
- [X] T019 [P] [US3] Extend contract tests for `POST /api/resumes` and `POST /api/resumes/:id/replace` with an optional `fileName` field per `contracts/http-api.md` in `tests/contract/resumes-upload.test.ts` and `tests/contract/resumes-replace.test.ts`
- [X] T020 [P] [US3] E2E in `tests/e2e/resumes-upload.spec.ts` and `tests/e2e/resumes-restore.spec.ts`: upload/update a resume with a custom file name and confirm it's shown, normalized to end in `.pdf`

### Implementation for User Story 3

- [X] T021 [US3] Add `ResumeFileNameSchema` to `lib/validation/resumes.ts` and thread an optional `fileName` through `ResumeUploadSchema` and the replace-input shape
- [X] T022 [US3] `uploadResume` and `replaceResume` in `lib/resumes/service.ts` use `input.fileName ?? file.name` when saving (depends on T021)
- [X] T023 [US3] `app/api/resumes/route.ts` and `app/api/resumes/[id]/replace/route.ts` read the optional `fileName` form field and pass it through (depends on T021)
- [X] T024 [US3] Optional file-name field in `components/resumes/upload-dialog.tsx` (both the plain-upload and Update modes)

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Constitution gates and edge cases across all three stories

- [X] T025 [P] Accessibility pass (via the `impeccable` skill's `audit` command, per CONTRIBUTING.md) on the new "Resume" selector, the preview's attachment line, the History attachment display, and the resumes file-name field, to WCAG 2.1 AA
  - Static/code-level review (no live dev server in this environment, same limitation as
    T029 below): every new interactive element reuses an existing accessible Astryx
    primitive as-is — `Selector` (Resume, mirrors the already-accessible Template selector),
    `TextInput` (File name, with a proper `label` + `description` used as help text) — and
    every new display-only addition (`EmailPreview`'s attachment line, History's `MetaRow`
    and list-row text) is plain `Text`/`MetaRow`, no custom interactive elements introduced.
    No new component needed a custom accessibility implementation.
- [X] T026 [P] Design-system lint sweep: confirm no ad-hoc styling on any new/changed UI (Principle IV) — Astryx components + tokens only
  - Confirmed: no raw hex/px/className styling added in any new/changed component file;
    only existing Astryx components and props.
- [X] T027 Verify `pnpm typecheck` (zero errors), full `pnpm test` (all unit/contract green), `pnpm lint` (zero errors), and `pnpm build` (production build compiles)
  - `tsc --noEmit`: clean. `vitest run`: 28 files, 161 tests, all passing. `eslint` over
    every touched directory: clean. `next build`: compiled successfully, all 23 routes
    (including the unchanged-signature `/api/send`, `/api/history*`, `/api/resumes*`
    routes) generated with no errors.
- [X] T028 Security/isolation review: `resumeId` ownership is checked before attaching (404 for unowned/unknown, never 403); resend's re-resolution repeats the same ownership check; no resume bytes are retained beyond the request that sends them
  - `resolveAttachment` (lib/send/service.ts) scopes its lookup to `eq(resumes.userId, userId)`
    and throws `NotFoundError` (never `ForbiddenError`) for both unknown and not-owned ids.
    `resendRecord` re-resolves via `getResumeFile(userId, ...)`, which applies the same
    ownership scoping independently at resend time — never trusts the original batch's
    reference blindly. History's left joins on `resumes` are also scoped by `userId`. The
    attachment `Buffer` is a local variable for the duration of one request (send or
    resend) only; nothing persists it beyond that call.
- [ ] T029 Run `quickstart.md` end-to-end validation against a real NeonDB + R2 bucket + connected Gmail account (manual, live credentials — same limitation as 002-resume-storage's T041)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — nothing to do
- **Foundational (Phase 2)**: no dependencies — BLOCKS US1 and US2 only
- **US1 (Phase 3)**: depends on Foundational
- **US2 (Phase 4)**: depends on Foundational and US1 (needs a send with an attachment to view/resend)
- **US3 (Phase 5)**: no dependency on Foundational, US1, or US2 — can be built in parallel with any of them, sequenced here only by priority order
- **Polish (Phase 6)**: after all targeted stories

### Within Each User Story

- Tests (all `[P]`) are written FIRST and must FAIL before implementation (Principle II)
- Validation schema → service → route (where changed) → UI
- Story complete and independently testable before the next priority

### Parallel Opportunities

- Foundational: T001-T003 all in parallel
- Within a story: all test tasks `[P]` run together
- US3 can proceed in parallel with Foundational/US1/US2 the whole time, since it shares no files with them
- With multiple developers: US1 must land before US2 can be meaningfully demoed (US2 needs an attached send to view/resend), but US3 work can run fully in parallel with both from the start

---

## Parallel Example: User Story 1

```bash
# Write all US1 tests first (they must fail):
Task: "Unit tests for buildRawMessage's attachment shape in tests/unit/mime-attachment.test.ts"        # T004
Task: "Unit tests for the stream-to-Buffer helper + size guard in tests/unit/send-attachment.test.ts"  # T005
Task: "Extend POST /api/send contract tests with resumeId in tests/contract/send-single.test.ts + send-bulk.test.ts"  # T006
Task: "E2E attach-and-send in tests/e2e/send-single.spec.ts + send-bulk.spec.ts"                        # T007
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 2 Foundational
2. Phase 3 US1 (attach a resume and send it) → validate independently
3. **STOP and VALIDATE**: select a resume, send, confirm the recipient received it attached (SC-001, SC-002)
4. Demo / deploy the MVP

### Incremental Delivery

1. Foundational → foundation ready
2. + US1 → attach-and-send works (MVP demo)
3. + US2 → history shows it, resend reattaches it
4. + US3 → clean file names (can land any time, even before US1/US2)
5. Each story adds value without breaking the previous ones

---

## Notes

- `[P]` = different files, no dependency on incomplete work
- `[Story]` label traces each task to its user story
- Tests are NOT optional here — Principle II requires them written first and failing
  before implementation
- Commit after each task or logical group (git extension auto-commit is available but
  disabled by this repo's config — commit manually, proposing the message first)
- Stop at any checkpoint to validate a story independently
- Total tasks: **29** — Setup 0, Foundational 3, US1 9, US2 5, US3 7, Polish 5
