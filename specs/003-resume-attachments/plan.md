# Implementation Plan: Resume Attachments

**Branch**: `003-resume-attachments` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-resume-attachments/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Connects 002-resume-storage to sending: a job seeker picks one of their saved resumes in
Compose and it goes out as a PDF attachment on every recipient in that send (single or
bulk). One resume per send, optional, defaulting to none. The choice is recorded on the
send batch (a nullable FK, mirroring the existing `templateId` column) so History can show
what was attached and a resend can reattach it automatically. Also lets a user set a custom
file name for a resume at upload/update time, since that name is what recipients see on the
attachment.

Technical approach: extend the existing `lib/send`, `lib/email`, and `lib/history` domains
rather than adding a new one. `EmailProvider.sendEmail`'s `OutgoingMessage` gains an
optional `attachment` field; `buildRawMessage` wraps the current `multipart/alternative`
body inside an outer `multipart/mixed` only when an attachment is present, so the existing
no-attachment MIME shape and its contract tests are untouched. The attachment's PDF bytes
are read from R2 (via the existing `getResumeFile` service function) once per batch and
reused for every recipient. Resume file naming becomes user-editable by extending the
existing upload/replace Zod schemas and service functions — no new storage or table for
that part, `resume.file_name` already exists.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20 LTS

**Primary Dependencies**: Next.js (App Router, React 19), Drizzle ORM + drizzle-kit,
`@neondatabase/serverless`, `googleapis` (Gmail), Zod, Astryx (React + StyleX design
system). No new runtime dependency is introduced by this feature.

**Storage**: NeonDB (serverless PostgreSQL) via Drizzle — one new nullable FK column on the
existing `send_batch` table. No new table, no change to Cloudflare R2 (the existing
`getResumeFile` read path is reused as-is).

**Testing**: Vitest (unit tests for the MIME multipart builder and the send/resend service
logic against the existing fake `EmailProvider`; contract tests for the extended
`POST /api/send` and history endpoints), Playwright (E2E for compose → attach → send →
history → resend).

**Target Platform**: Web (server-rendered + client components) on the same host as the
rest of the app; modern evergreen browsers.

**Project Type**: Web application — extends existing feature areas (`lib/send`,
`lib/email`, `lib/history`, `lib/resumes`), no new top-level domain.

**Performance Goals**: Attachment selection and send take no perceptibly longer than
today's no-attachment send for a single job seeker's typical batch sizes (SC-001); the
attachment's bytes are fetched from R2 exactly once per batch, not once per recipient
(FR-004), so a bulk send's cost scales with recipient count the same way it does today.

**Constraints**: A resume is already capped at 10MB (002-resume-storage, unchanged); the
combined outgoing MIME message (attachment + body) must stay under the Gmail API's ~25MB
raw-message limit, checked before sending rather than assumed (FR-011).

**Scale/Scope**: Same single job seeker / single Gmail account scale as 001 and 002; 3
prioritized user stories, 16 functional requirements, one schema migration (one nullable
column), no new table.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Sendora Constitution v1.1.0.

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Type Safety & Simplicity | End-to-end TypeScript `strict`. `SendRequestSchema` gains an optional `resumeId`, validated the same way every other field on that boundary is. No new abstraction layer: the attachment is a plain optional field threaded through the existing `EmailProvider`/`OutgoingMessage` seam, not a new provider or a new domain. The schema choice (nullable FK on `send_batch`, not a join table) was deliberately kept to the simplest shape that satisfies the spec's explicit single-attachment-per-send scope (YAGNI) — see Research §1. | PASS |
| II. Test-First (NON-NEGOTIABLE) | `buildRawMessage`'s new multipart/mixed branch, `runSendLoop`'s attachment threading, and `resendRecord`'s attachment-lookup/fallback are all pure, DB-free logic written test-first against the existing fake provider, mirroring 001's pattern. Every user story (attach-and-send, history/resend, custom file name) gets integration coverage in addition to unit/contract tests. | PASS |
| III. Accessibility by Default | The new "Resume" `Selector` in Compose and the file-name field in the resume upload/update dialogs are built from the same Astryx primitives already used for the "Template" selector and the existing upload form, so they inherit the same keyboard/focus/contrast/labeling guarantees. | PASS |
| IV. UX Consistency via Design System | New UI (Resume selector, attachment line in `EmailPreview`, file-name input) reuses existing Astryx components and tokens exactly as `compose-view.tsx` and `upload-dialog.tsx` already do — no ad-hoc styling. | PASS |
| V. Plain, Human Copy | The attachment line in the preview, the "attachment no longer available" and "attachment dropped from resend" messages, and the file-name field's help text are all plain, honest, and free of em-dashes. | PASS |

**Technology stack alignment**: No new external service, datastore, or runtime dependency.
This feature is additive within the existing NeonDB/Drizzle + R2 + Gmail-provider stack.

**Result**: PASS — no violations, nothing to justify in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-resume-attachments/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── README.md
│   ├── http-api.md
│   └── email-provider.md
└── checklists/
    └── requirements.md   # Spec quality checklist (already created)
```

### Source Code (repository root)

```text
app/
└── api/
    ├── send/
    │   └── route.ts               # POST — SendRequestSchema gains resumeId
    ├── history/
    │   ├── route.ts               # GET list — HistoryEvent gains attachedResume
    │   └── [id]/route.ts          # GET detail — HistoryDetail gains attachedResume
    │       └── resend/route.ts    # POST — unchanged surface, new internal behavior
    └── resumes/
        └── route.ts               # POST upload — ResumeUploadSchema gains optional fileName
        └── [id]/replace/route.ts  # POST — gains optional fileName

lib/
├── db/
│   └── schema.ts                  # send_batch gains nullable attached_resume_id FK
├── send/
│   ├── service.ts                 # sendEmails/runSendLoop/resendRecord gain attachment handling
│   └── types.ts                   # (unchanged shape, if any new fields needed)
├── email/
│   ├── provider.ts                 # OutgoingMessage gains optional `attachment`
│   ├── mime.ts                      # buildRawMessage: multipart/mixed when attachment present
│   └── gmail-provider.ts            # no behavior change (delegates to mime.ts as today)
├── history/
│   ├── service.ts                  # listHistory/getHistoryDetail join resumes for attachedResume
│   └── types.ts                    # HistoryEvent/HistoryDetail gain attachedResume
├── resumes/
│   └── service.ts                  # uploadResume/replaceResume accept an optional custom fileName
└── validation/
    ├── send.ts                     # SendRequestSchema gains optional resumeId
    └── resumes.ts                  # ResumeFileNameSchema (sanitize + .pdf suffix)

components/
├── compose/
│   ├── compose-view.tsx            # + "Resume" Selector, wired into the send request
│   └── email-preview.tsx           # + attachment line
└── resumes/
    └── upload-dialog.tsx            # + optional file-name field

tests/
├── unit/                           # mime.ts multipart/mixed shape; send/resend attachment logic
├── contract/                       # POST /api/send + history endpoints with resumeId/attachedResume
├── integration/                    # attach → send → history → resend
└── e2e/                            # Playwright: compose with a resume attached, view in history, resend
```

**Structure Decision**: No new domain — this feature extends `lib/send`, `lib/email`,
`lib/history`, and `lib/resumes` in place, following the same layering every existing
feature uses. This mirrors 002-resume-storage's own stated intent: `getResumeFile` was
built as the seam this feature would need, and that is exactly what `lib/send/service.ts`
calls into, never R2 directly.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

No violations — table intentionally omitted.
