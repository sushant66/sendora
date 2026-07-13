# Implementation Plan: Resume Storage

**Branch**: `002-resume-storage` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-resume-storage/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

A standalone utility for job seekers to manage labeled resume PDF variants: upload a PDF
with a label, browse/open the saved list, delete one no longer needed, and — if a label's
resume is replaced — recover an earlier version. No template builder, no editor, no AI
tailoring. Built as groundwork for a future feature that attaches a chosen resume when
sending outreach emails, but that wiring is explicitly out of scope here.

Technical approach: extend the existing single Next.js (App Router) application with one
new domain (`lib/resumes/`) following the same service/route/UI layering as every other
feature. Resume metadata lives in NeonDB via Drizzle (a new `resume` table); the PDF bytes
themselves live in Cloudflare R2 (S3-compatible object storage) behind a thin wrapper
module, since binary files are expected to accumulate indefinitely (archived version
history has no purge policy) and don't belong in the primary OLTP database. Zod validates
every boundary, including a content-based (magic-byte) PDF check. Vitest + Playwright
enforce test-first development, mirroring the `lib/email` provider-seam testing pattern
with a fake storage client.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20 LTS

**Primary Dependencies**: Next.js (App Router, React 19), Drizzle ORM + drizzle-kit,
`@neondatabase/serverless`, an S3-compatible client for Cloudflare R2 (e.g.
`@aws-sdk/client-s3`), Zod, Astryx (React + StyleX design system)

**Storage**: NeonDB (serverless PostgreSQL) via Drizzle for resume metadata; Cloudflare R2
(S3-compatible object storage) for the PDF file bytes, accessed through a thin wrapper
module — never a multi-provider seam, since only one storage backend is in scope

**Testing**: Vitest (unit + contract + integration, with a fake storage client analogous
to `lib/email/fake-provider.ts`), Playwright (E2E + `@a11y` coverage of the `/resumes` page)

**Target Platform**: Web (server-rendered + client components) on the same serverless host
as the rest of the app; modern evergreen browsers

**Project Type**: Web application — one more feature area inside the existing single
Next.js app, no separate service

**Performance Goals**: Upload-and-label completes in <30s (SC-001); locating and opening a
specific resume from a list of up to 20 in <10s (SC-002)

**Constraints**: 10MB per uploaded file; 20 active resumes per user (archived history is
uncounted and unbounded, per spec Assumptions — no purge policy this version); serverless
function body-size/execution-time limits bound the upload path

**Scale/Scope**: Single job seeker managing up to 20 active labeled resumes plus unbounded
archived history; 4 prioritized user stories, 15 functional requirements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Sendora Constitution v1.1.0.

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Type Safety & Simplicity | End-to-end TypeScript `strict`; Zod validates every trust boundary (label text, file metadata incl. a content-based magic-byte PDF check, env vars). No multi-provider storage abstraction is introduced — only one backend (R2) is in scope, so the seam is kept at the service layer (YAGNI), matching the pattern already used for a single-provider concern. | PASS |
| II. Test-First (NON-NEGOTIABLE) | Unit tests for `lib/resumes/service.ts` against a fake storage client, written before implementation; every user story (save, browse/open, delete, replace-with-history/restore) gets integration coverage in addition to unit tests. | PASS |
| III. Accessibility by Default | The new `/resumes` page is built from Astryx's accessible primitives; upload form, list, delete confirmation, and restore action are keyboard-operable and `@a11y`-tested, held to the same bar as the rest of the app. | PASS |
| IV. UX Consistency via Design System | UI built via the `impeccable` skill from Astryx components + theme tokens only; no ad-hoc styling. | PASS |
| V. Plain, Human Copy | All user-facing text (labels prompts, error messages, empty states, history/restore copy) is plain and human, with no em-dash. | PASS |

**Technology stack alignment**: Next.js + Astryx + NeonDB is unchanged. This feature adds
**one new external service and runtime dependency**: Cloudflare R2 object storage (via an
S3-compatible client). Per the constitution's Technology Stack & Constraints section, a
new external service/datastore requires explicit justification in the feature plan (see
Complexity Tracking) rather than an ad-hoc addition — no other stack pillar is replaced.

**Result**: PASS — one justified complexity item tracked below; no unjustified violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-resume-storage/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── README.md
│   └── http-api.md
└── checklists/
    └── requirements.md  # Spec quality checklist (already created)
```

### Source Code (repository root)

```text
app/
├── (app)/
│   └── resumes/                  # US1-US4: upload, browse, delete, restore
│       └── page.tsx
└── api/
    └── resumes/
        ├── route.ts               # GET list (?includeArchived=), POST upload
        └── [id]/
            ├── route.ts           # GET stream file, DELETE (soft-delete)
            └── restore/
                └── route.ts       # POST restore

lib/
├── db/
│   └── schema.ts                  # + `resume` table
├── resumes/
│   ├── service.ts                 # uploadResume/listResumes/getResumeFile/
│   │                               #   deleteResume/restoreResume
│   └── types.ts
├── storage/
│   └── r2-client.ts                # thin R2 wrapper: put/getStream/delete
└── validation/
    └── resumes.ts                  # Zod: label + file constraints (incl. magic bytes)

components/
└── resumes/                       # Astryx-based upload form, list/history, delete/restore

tests/
├── unit/                          # lib/resumes/service.ts against a fake storage client
├── contract/                      # request/response shapes vs contracts/http-api.md
├── integration/                   # upload → list → download → delete → restore
└── e2e/                           # Playwright user-journey + @a11y coverage
```

**Structure Decision**: Same single Next.js App Router application as the rest of Sendora
(Project Type: web app) — this feature is one more domain slotted into the existing
`app/(app)/`, `app/api/`, `lib/`, `components/` layout, not a new service. `lib/resumes`
isolates business logic from route handlers exactly like `lib/contacts`; `lib/storage`
isolates R2 specifics from `lib/resumes/service.ts` so a future "attach resume to email"
feature depends only on the service's `getResumeFile`, never on R2 directly.

## Complexity Tracking

> Justifications for deviations flagged in the Constitution Check.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Cloudflare R2 (new external object-storage service + a new S3-compatible client runtime dependency) | Resume PDFs are binary files; per FR-010, replacing a labeled resume retains the earlier version as archived history rather than deleting it, and the spec's Assumptions explicitly leave purging out of scope — so total stored file volume grows unbounded over time, for every user | Storing file bytes as a Postgres `bytea` column on the existing NeonDB database (zero new infra) was considered and rejected: acceptable at the 20-active-resume cap alone, but unbounded archived history would bloat the primary OLTP database and its backups, degrading a database every other feature also depends on |
