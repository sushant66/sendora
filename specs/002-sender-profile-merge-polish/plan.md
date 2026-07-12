# Implementation Plan: Sender profile, personalized merge fields, and outreach management polish

**Branch**: `002-sender-profile-merge-polish` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-sender-profile-merge-polish/spec.md`

## Summary

Make Sendora's outreach reflect the job seeker, not only the recipient. A job seeker fills in
an optional profile (name, title, pitch, skills, link, location, work preference) that becomes
a namespaced set of "your details" merge fields alongside the existing recipient fields. Merge
fields are inserted through an inline "/" slash menu in the rich-text body (as atomic,
unbreakable chips) and a lightweight "insert field" affordance on the plain-text subject,
replacing the static hint text. Compose gains two confidence features: a "send test to myself"
action and a pre-send gate that shows how emails missing a used value will actually read, with
an explicit confirm. Onboarding is reordered so a job seeker imports contacts and sees a
rendered template before authorizing Gmail. The contacts list gains multi-select with a
two-step "select all matching," and bulk (and single) delete with a ~5 second undo.

Technical approach: continue the single Next.js (App Router, TS strict) + Astryx + NeonDB
(Drizzle) application. Add one `sender_profile` table (one row per user) and a soft-delete
column on `recruiter_contact` (with a partial unique index) so a delete can be undone with the
contact's identity and its `send_record` linkage intact. Extend the existing merge engine
(`lib/templates/merge.ts`) with the closed sender vocabulary and total, warning-aware
rendering. The slash menu and the merge chip are a Tiptap Suggestion extension plus a custom
atomic Node, themed with Astryx tokens and held to the existing rich-text accessibility bar.
Zod validates every new trust boundary; Vitest + Playwright keep delivery test-first. The
custom UI surfaces (profile page, slash menu + chip, bulk-select bar, missing-value gate) are
designed and hardened with `/impeccable` during implementation.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20 LTS

**Primary Dependencies**: Next.js (App Router, React 19), Astryx (React + StyleX), Drizzle ORM
+ drizzle-kit, `@neondatabase/serverless`, Auth.js / NextAuth v5 (Google), `googleapis` (Gmail
send), Zod, Tiptap (already present) plus `@tiptap/suggestion` and a custom merge-field Node,
`sanitize-html`. No new datastore, no new external service.

**Storage**: NeonDB (serverless PostgreSQL) via the typed Drizzle layer. One new table
(`sender_profile`) and one additive migration on `recruiter_contact` (`deleted_at`,
`deleted_batch`, and a partial unique index).

**Testing**: Vitest + React Testing Library (unit/component), Vitest (contract tests for route
handlers), Playwright (E2E per user story).

**Target Platform**: Web (server-rendered + client components) on a serverless host (Vercel);
modern evergreen browsers.

**Project Type**: Web application (single Next.js app, no separate backend).

**Performance Goals**: Profile setup completable in under 2 minutes (SC-001); slash menu opens
and filters within a normal interaction budget (<200ms perceived); pre-send missing-value
summary computed client-side from already-loaded contacts (no extra round trip per recipient).

**Constraints**: 0% delivered emails contain an unresolved literal placeholder for either
namespace (SC-002); inserted body fields cannot be edited into a malformed token (SC-003);
sends remain bound by the connected Gmail account's own limits; the 50-recipient bulk cap from
001 is unchanged. No em-dash in any user-facing copy or email content (Constitution V).

**Scale/Scope**: One job seeker with up to a few thousand contacts; a single "select all
matching" delete may therefore affect a few thousand rows and must be undoable in one action.
5 prioritized user stories, 24 functional requirements.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Sendora Constitution v1.1.0.

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Type Safety & Simplicity | End-to-end TS `strict`; Zod validates every new boundary (profile CRUD, bulk-delete request, undo request, test-send request, missing-value preview input). No `any`. The sender vocabulary reuses the existing closed-vocabulary merge engine rather than a new templating layer (YAGNI). Two justified structural additions tracked below. | PASS |
| II. Test-First (NON-NEGOTIABLE) | Vitest + Playwright already configured. Each story delivered test-first: unit (sender-field render + warnings, missing-value computation, soft-delete/undo, subject/body token insertion), integration (profile CRUD, bulk delete + undo + commit boundary, test send excluded from history), E2E per story. | PASS |
| III. Accessibility by Default | The slash menu and merge chip are the custom interactive surfaces, held to WCAG 2.1 AA: the menu is a labelled listbox with full keyboard navigation and Escape to dismiss; the chip is a focusable, labelled inline element with an accessible name (its field label) and is deletable as a unit. The bulk-select bar and profile form use Astryx primitives. | PASS |
| IV. UX Consistency via Design System | All UI built from Astryx components + theme tokens. The slash menu, chip, and select-all bar are themed with tokens (no raw hex/px). The Tiptap Suggestion + Node is a functional dependency wrapped and themed, consistent with the 001 justification for Tiptap. Design craft delivered via `/impeccable`. | PASS |
| V. Plain, Human Copy | No em-dash in any new copy, starter template, or email content. The rewritten "cold outreach" starter (FR-017) and all new banners/toasts follow the plain-voice rule. | PASS |

**Technology stack alignment**: Next.js + Astryx + NeonDB unchanged. The only new runtime
dependency is `@tiptap/suggestion` (a first-party Tiptap package) plus a local custom Node;
this extends the already-ratified Tiptap editor rather than introducing a new stack pillar or
datastore. Justified in Complexity Tracking and research.md.

**Result**: PASS. Two justified complexity items tracked below; re-checked after Phase 1.

## Project Structure

### Documentation (this feature)

```text
specs/002-sender-profile-merge-polish/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── README.md
│   └── http-api.md          # New/changed route-handler contracts
└── checklists/
    └── requirements.md  # Spec quality checklist (passing)
```

### Source Code (repository root)

```text
app/(app)/
├── profile/                     # US1: sender profile page (new)
├── contacts/                    # US4: multi-select + bulk delete + undo (extend)
├── compose/                     # US2 + US3: slash menu, subject insert, test send, gate (extend)
├── templates/                   # US2: slash menu in the template editor (extend)
└── dashboard/                   # US5: reordered setup checklist (extend)

app/api/
├── profile/                     # US1: GET/PUT sender profile (new)
├── contacts/
│   ├── bulk-delete/             # US4: soft-delete by ids or by matching query (new)
│   └── restore/                 # US4: undo a soft-delete batch (new)
├── send/
│   └── test/                    # US3: send a test to the job seeker's own inbox (new)
└── templates/preview/           # US3: reused for the missing-value gate (extend)

lib/
├── profile/                     # US1: profile types + service (new)
├── templates/
│   └── merge.ts                 # extend: sender vocabulary + total render for both namespaces
├── contacts/                    # US4: soft-delete / restore service (extend)
├── compose/                     # US3: missing-value computation over a selection (extend)
├── validation/
│   ├── profile.ts               # new Zod schema
│   ├── contacts.ts              # extend: bulk-delete / restore request schemas
│   └── send.ts                  # extend: test-send request schema
└── db/schema.ts                 # sender_profile table + recruiter_contact soft-delete columns

components/
├── profile/                     # US1: profile form (new, Astryx)
├── rich-text-editor/            # US2: merge-field slash-menu extension + chip Node (extend)
├── contacts/                    # US4: selection bar, bulk-delete dialog, undo toast (extend)
└── compose/                     # US3: test-send control + missing-value gate (extend)

tests/
├── unit/                        # merge sender fields, missing-value calc, soft-delete/undo, insertion
├── contract/                    # profile, bulk-delete, restore, test-send route contracts
├── integration/                 # profile CRUD, delete+undo+commit, test send not in history
└── e2e/                         # one journey per user story
```

**Structure Decision**: Single Next.js App Router application (unchanged from 001). New route
handlers and `lib/` modules follow the existing separation: framework-free business logic in
`lib/` (merge, profile, contacts soft-delete, missing-value), thin route handlers validating
with Zod. The merge chip and slash menu live inside the existing `components/rich-text-editor`
so both compose and the template editor inherit them.

## Complexity Tracking

> Justifications for the two structural additions flagged in the Constitution Check.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Tiptap Suggestion extension + custom atomic merge-field Node | FR-010/FR-013 require an inline "/" menu and inserted fields that behave as unbreakable chips (SC-003: 0 malformed tokens). Astryx has no rich-text-editing or suggestion primitive; ProseMirror (via Tiptap, already in the stack) is the mechanism for atomic inline nodes and suggestion menus. | Raw `{{token}}` text (rejected: freely breakable, fails SC-003) and a separate popover that pastes text (rejected: still produces breakable text and duplicates editor state). The extension builds on the already-justified Tiptap dependency, adding no new stack pillar. |
| `recruiter_contact` soft-delete (`deleted_at`, `deleted_batch`) + partial unique index | FR-022/FR-023 require undo that restores a contact with the same identity and its `send_record` linkage intact. `send_record.contact_id` is `ON DELETE SET NULL`, so a hard delete + re-insert would orphan history and mint a new id. Soft-delete preserves the row and its id; undo clears the flag. | Hard delete + re-insert on undo (rejected: breaks history linkage and identity). A separate "deleted contacts" table (rejected: duplicates the schema and the unique constraint, more complex than one nullable column + partial index). |
