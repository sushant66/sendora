---
description: "Task list for feature 002 — sender profile, merge fields, and outreach polish"
---

# Tasks: Sender profile, personalized merge fields, and outreach management polish

**Input**: Design documents from `/specs/002-sender-profile-merge-polish/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: REQUIRED. Constitution II (Test-First) is non-negotiable for this project. Every
story is delivered test-first: write the test, watch it fail, implement, refactor.

**UI craft**: The four custom surfaces (profile page, slash menu + chip, contacts selection bar
+ undo toast, missing-value gate) are built **through `/impeccable` while implementing them**,
not in a later polish pass. Those tasks say so explicitly.

**Organization**: Tasks are grouped by user story so each can be implemented and tested
independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1..US5 (setup, foundational, and polish tasks carry no story label)
- Paths follow plan.md (single Next.js app at repo root: `app/`, `lib/`, `components/`, `tests/`)

---

## Phase 1: Setup (Shared)

**Purpose**: Bring in the one new dependency and shared test scaffolding.

- [X] T001 Add `@tiptap/suggestion` to dependencies in `package.json` and install (pnpm)
- [X] T002 [P] Add test factories for `SenderProfile` and soft-deleted contacts in `tests/factories/`

---

## Phase 2: Foundational (Merge Contract) — BLOCKS US1, US2, US3

**Purpose**: Extend the closed merge vocabulary and render path once, so the profile, the
picker, and the missing-value gate all share one contract.

**Note**: US4 (bulk contacts) and US5 (onboarding) do NOT depend on this phase and may start
right after Setup.

- [X] T003 [P] Unit tests for sender-field rendering, per-field empty warnings, and 0 literal placeholders (both namespaces) in `tests/unit/merge.sender.test.ts`
- [X] T004 [P] Unit tests for template save-time validation accepting the sender namespace and rejecting unknown tokens in `tests/unit/templates.validation.test.ts`
- [X] T005 Extend `MERGE_TOKENS` with the sender namespace (`my_name`, `my_title`, `my_pitch`, `my_skills`, `my_link`, `my_location`, `my_work_preference`) and resolve them in `lib/templates/merge.ts`
- [X] T006 Extend the render signature to accept a sender context (profile) alongside the contact, keeping total render + warnings, in `lib/templates/merge.ts` (depends T005)
- [X] T007 [P] Create the shared merge-field descriptor list (`{ token, label, group }`, recipient + sender) in `lib/templates/fields.ts`
- [X] T008 Update template save-time validation to accept both namespaces in `lib/validation/templates.ts` and `lib/templates/service.ts` (depends T005)

**Checkpoint**: Merge engine supports both namespaces; US1/US2/US3 can begin.

---

## Phase 3: User Story 1 - Sender profile & sender merge fields (Priority: P1) 🎯 MVP

**Goal**: A job seeker fills in an optional profile whose values fill "your details" merge
fields in templates and sends, without ever blocking a send.

**Independent Test**: Save a profile, use a `my_*` field in a template, preview for a contact and
see both sender and recipient values resolve; leave a sender field blank and see a warning, not a
placeholder; confirm sending still works with no profile.

### Tests (write first, must fail)

- [X] T009 [P] [US1] Contract test for `GET`/`PUT /api/profile` in `tests/contract/profile.test.ts`
- [X] T010 [P] [US1] Integration test: save profile, `my_*` resolves in preview, empty sender warns, send not blocked without a profile, in `tests/integration/profile.test.ts`
- [X] T011 [P] [US1] E2E: set up profile, use it in a template, preview, in `tests/e2e/profile.spec.ts`

### Implementation

- [X] T012 [US1] Add the `sender_profile` table to `lib/db/schema.ts` and generate + apply the migration (drizzle-kit)
- [X] T013 [P] [US1] Zod schema for the profile (optional fields, URL + work-preference enum, length bounds) in `lib/validation/profile.ts`
- [X] T014 [P] [US1] Profile types / DTO in `lib/profile/types.ts`
- [X] T015 [US1] Profile service (get, lazy upsert) in `lib/profile/service.ts` (depends T012, T013)
- [X] T016 [US1] `GET`/`PUT` route handlers in `app/api/profile/route.ts` (depends T015)
- [X] T017 [US1] Wire the sender profile into render at the send and preview call sites (`lib/send/*`, `app/api/templates/preview/route.ts`) so `my_*` resolves everywhere (depends T006, T015)
- [X] T018 [US1] Make the profile display name authoritative (fallback to the Google account name) in the session helper + dashboard greeting (`lib/auth/session.ts`, `components/dashboard/dashboard-view.tsx`)
- [X] T019 [US1] Build the profile page **through `/impeccable`** (Astryx form, tokens only, WCAG AA) in `components/profile/profile-view.tsx` and `app/(app)/profile/page.tsx` (depends T016)
- [X] T020 [US1] Add the Profile nav entry in `components/app-sidebar.tsx`

**Checkpoint**: US1 fully functional and independently testable. This is the MVP.

---

## Phase 4: User Story 2 - Insert merge fields without memorizing them (Priority: P1)

**Goal**: A `/` menu in the body (grouped Recipient / Your details, searchable, keyboard) inserts
fields as atomic chips; the subject has a lightweight insert affordance. Static hint text is gone.

**Independent Test**: In the template editor and compose, type `/`, insert fields, confirm they
are chips that delete as a unit and cannot be half-edited; insert into the subject; Escape
dismisses; typing `/` as ordinary text is not trapped.

### Tests (write first, must fail)

- [X] T021 [P] [US2] Unit test: merge chip serializes to `{{token}}` and deletes as one unit in `tests/unit/merge-chip.test.ts`
- [X] T022 [P] [US2] Component test: slash menu opens on `/`, filters, arrow/Enter/Escape, grouped recipient/sender in `tests/unit/slash-menu.test.tsx`
- [X] T023 [P] [US2] E2E: insert via slash menu in template editor + compose, subject insert, in `tests/e2e/merge-picker.spec.ts`

### Implementation

- [X] T024 [US2] Custom atomic merge-field Node (chip) with a token attribute and `{{token}}` serialization in `components/rich-text-editor/merge-field-node.ts`
- [X] T025 [US2] Slash-menu Suggestion extension (grouped, searchable, keyboard-navigable, Escape) in `components/rich-text-editor/merge-suggestion.tsx` (depends T024, T007)
- [X] T026 [US2] Parse stored `{{token}}` into chips when loading existing content in the editor (depends T024)
- [X] T027 [US2] Integrate the Node + Suggestion into `RichTextEditor` and style the chip + menu **through `/impeccable`** (tokens only, WCAG AA, accessible name = field label) in `components/rich-text-editor/rich-text-editor.tsx` (depends T024, T025)
- [X] T028 [P] [US2] Subject-line "Insert field" affordance inserting a raw token at the caret, built **through `/impeccable`**, in `components/compose/compose-view.tsx` and `components/templates/template-editor-dialog.tsx` (depends T007)
- [X] T029 [US2] Remove the static `MERGE_HINT` text and wire the picker in the template editor dialog and compose (depends T027)

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Send with confidence (Priority: P2)

**Goal**: A "send test to myself" action, and a pre-send gate that shows how missing-value emails
actually read plus an explicit confirm. Starter templates no longer promise an attachment.

**Independent Test**: Send a test to yourself and confirm it arrives rendered, marked as a test,
and is NOT in history; select contacts missing a used value and confirm one summary shows the real
reading and requires a confirm; confirm the "cold outreach" starter has no attachment wording.

### Tests (write first, must fail)

- [X] T030 [P] [US3] Contract test for `POST /api/send/test` (no history rows, `no_active_account`, validation) in `tests/contract/send-test.test.ts`
- [X] T031 [P] [US3] Unit test: missing-value computation over a selection (recipient + sender) in `tests/unit/missing-value.test.ts`
- [X] T032 [P] [US3] Integration test: test send creates no `send_batch`/`send_record`; starter has no attachment wording, in `tests/integration/send-test.test.ts`
- [X] T033 [P] [US3] E2E: send test to self; missing-value gate shows reading + requires confirm, in `tests/e2e/compose-confidence.spec.ts`

### Implementation

- [X] T034 [US3] Test-send request Zod schema in `lib/validation/send.ts`
- [X] T035 [US3] Test-send service (render current draft incl. `my_*`, send via the provider seam, create NO records) in `lib/send/test-send.ts` (depends T006, T017)
- [X] T036 [US3] `POST /api/send/test` route in `app/api/send/test/route.ts` (depends T034, T035)
- [X] T037 [P] [US3] Missing-value computation util over a selection (used tokens × contacts × profile) in `lib/compose/missing-values.ts` (depends T005)
- [X] T038 [US3] "Send test to myself" control in compose, built **through `/impeccable`**, in `components/compose/compose-view.tsx` (depends T036)
- [X] T039 [US3] Missing-value pre-send gate UI (summary + how-it-reads sample via the existing preview, using the first affected recipient in the selection as the representative, + explicit confirm), built **through `/impeccable`**, in `components/compose/` (depends T037)
- [X] T040 [US3] Rewrite the "Intro: cold outreach" starter to reference a link (not an attachment) and demonstrate a `my_*` sign-off (name / title / link, FR-004) in `lib/templates/starters.ts`, then refresh the shared system rows by re-running the idempotent seed `lib/db/seed.ts`. System starters are shared `user_id=null` rows; no per-user migration and no schema change are needed. (F1, U2)

**Checkpoint**: US1, US2, US3 all work independently.

---

## Phase 6: User Story 4 - Manage the contact list in bulk (Priority: P2)

**Goal**: Multi-select (with a two-step "select all N matching"), bulk + single delete with a
confirm and a ~5 second undo that restores identity and history linkage; navigate-away commits.

**Independent Test**: Select rows, expand to "select all matching," delete, confirm the count,
undo and confirm all return with history attributed; let the window lapse and confirm the delete
stands; start a second delete during a pending undo and confirm the first commits.

**Note**: Depends only on Setup (Phase 1), not on the merge foundation.

### Tests (write first, must fail)

- [X] T041 [P] [US4] Contract test for `POST /api/contacts/bulk-delete` (ids + matchAll) and `POST /api/contacts/restore` in `tests/contract/bulk-delete.test.ts`
- [X] T042 [P] [US4] Unit + integration tests for soft-delete/restore: **unit** for collision-skip on restore and single-slot commit-on-new-delete in `tests/unit/soft-delete.test.ts` (T1, Constitution II); **integration** for delete hides rows, undo restores identity + history linkage, and **user-scoping** (a user cannot delete or restore another user's contacts or `deletedBatch`, FR-024/C1) in `tests/integration/bulk-delete.test.ts`
- [X] T043 [P] [US4] E2E: multi-select, select-all-matching, delete, undo, lapse-commits, in `tests/e2e/bulk-contacts.spec.ts`

### Implementation

- [X] T044 [US4] Add `deleted_at` + `deleted_batch` columns and convert the unique index to partial (`WHERE deleted_at IS NULL`) on `recruiter_contact` in `lib/db/schema.ts` + migration
- [X] T045 [US4] Filter `deleted_at IS NULL` in every contact read path (list, search, `all=1`, import dedup, recontact lookup) in `lib/contacts/` (depends T044)
- [X] T046 [P] [US4] Bulk-delete and restore request Zod schemas in `lib/validation/contacts.ts`
- [X] T047 [US4] Soft-delete + restore service (ids or matchAll; single `deletedBatch`; skip email collisions on restore), **scoped to the current user for both delete and restore so another user's contacts or `deletedBatch` can never be affected (FR-024)**, in `lib/contacts/soft-delete.ts` (depends T044, T046)
- [X] T048 [US4] `POST /api/contacts/bulk-delete` route in `app/api/contacts/bulk-delete/route.ts` (depends T047)
- [X] T049 [US4] `POST /api/contacts/restore` route in `app/api/contacts/restore/route.ts` (depends T047)
- [X] T050 [US4] Multi-select rows + selection bar + "select all N matching", built **through `/impeccable`**, in `components/contacts/contacts-view.tsx` (depends T048)
- [X] T051 [US4] Bulk-delete confirm dialog + ~5s undo toast (single slot; commit on navigate-away; covers single delete too), built **through `/impeccable`**, in `components/contacts/` (depends T048, T049)

**Checkpoint**: US4 works independently.

---

## Phase 7: User Story 5 - Get set up in the right order (Priority: P3)

**Goal**: First-run guidance leads through importing contacts and seeing a rendered template
before any Gmail prompt; profile is an optional step; Gmail is requested at first send.

**Independent Test**: As a fresh account, walk the setup and confirm the order and that the Gmail
prompt appears at first send, with profile offered but not required.

**Note**: Depends only on Setup (Phase 1). Uses US1's profile step if present, but degrades
cleanly if built first.

### Tests (write first, must fail)

- [X] T052 [P] [US5] E2E: setup order shows import + rendered template before the Gmail prompt; profile optional; Gmail prompt at first send, in `tests/e2e/onboarding.spec.ts`

### Implementation

- [X] T053 [US5] Reorder the dashboard "Get set up" steps (import, then personalize/profile, then first send), add the optional profile step, and ensure the personalize step surfaces a **real rendered template preview reachable without a connected inbox** so a rendered template is seen before any Gmail prompt (SC-007, U1), built **through `/impeccable`**, in `components/dashboard/dashboard-view.tsx`
- [X] T054 [US5] Confirm the Gmail connection prompt surfaces at first send (compose gating copy), in `components/compose/compose-view.tsx`

**Checkpoint**: All five stories independently functional.

---

## Phase 8: Polish & Cross-Cutting

**Purpose**: Final verification. (UI craft is already done in-story via `/impeccable`.)

- [X] T055 [P] Accessibility verification of the slash menu + chip (keyboard, labels, focus) per Constitution III
- [X] T056 [P] Copy review: no em-dash in any new copy, starter templates, or email content (Constitution V)
- [X] T057 `pnpm typecheck` and `pnpm lint` pass with zero errors
- [ ] T058 Run `quickstart.md` manual verification across all five stories (automated proxies done: full `vitest` suite green, `next build` clean, and each journey encoded as a self-skipping E2E spec; the authenticated manual pass remains for the operator)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)**: no dependencies.
- **Foundational (P2, merge contract)**: after Setup. Blocks **US1, US2, US3**.
- **US1 (P1)**: after Foundational.
- **US2 (P1)**: after Foundational; T027/T029 also lean on US1 only for shared editor use, but US2 is independently testable (recipient fields alone exercise the menu).
- **US3 (P2)**: after Foundational; T035 depends on US1's render wiring (T017).
- **US4 (P2)**: after **Setup only** (independent of the merge contract).
- **US5 (P3)**: after **Setup only**; integrates the US1 profile step if available.
- **Polish (P8)**: after the desired stories are complete.

### Within a story

- Tests first (must fail), then schema/models, then services, then routes, then UI.
- UI tasks marked "through `/impeccable`" build structure and craft together.

### Parallel opportunities

- Setup T002 ∥ dependency install.
- Foundational: T003 ∥ T004 (tests); T007 ∥ T005/T006.
- Every story's test tasks ([P]) run in parallel.
- With capacity: **US4 and US5 can start immediately after Setup**, in parallel with the
  merge-foundation + US1/US2/US3 track.

---

## Parallel Example: User Story 1

```bash
# Tests first, in parallel:
Task: "Contract test for GET/PUT /api/profile in tests/contract/profile.test.ts"
Task: "Integration test for profile render + no-block in tests/integration/profile.test.ts"
Task: "E2E profile setup in tests/e2e/profile.spec.ts"

# Then parallel scaffolding:
Task: "Zod profile schema in lib/validation/profile.ts"
Task: "Profile types in lib/profile/types.ts"
```

---

## Implementation Strategy

### MVP (User Story 1)

1. Phase 1 Setup → 2. Phase 2 Foundational (merge contract) → 3. Phase 3 US1 → **STOP and
validate**: a job seeker's own details flow into templates and sends. Ship.

### Incremental delivery

- MVP = Setup + Foundational + US1.
- Add US2 (picker) → the field experience is complete for both namespaces.
- Add US3 (confidence), US4 (bulk contacts), US5 (onboarding) in priority order, each
  independently testable and shippable.

### Parallel team strategy

- Track A: Foundational → US1 → US2 → US3 (the merge/personalization line).
- Track B: US4 (bulk contacts) and US5 (onboarding) start right after Setup, no wait on Track A.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- Tests are required (Constitution II), written before implementation and confirmed failing.
- UI is built through `/impeccable` in-story, not polished afterward.
- Commit after each task or logical group. Stop at any checkpoint to validate a story.
- Keep all styling on Astryx tokens; no em-dash in user-facing copy or email content.
