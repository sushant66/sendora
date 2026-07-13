# Phase 1 Data Model: Resume Attachments

**Feature**: `003-resume-attachments` | **Date**: 2026-07-12

Derived from the spec's Key Entities and Functional Requirements. This feature adds one
column to an existing table and changes validation/behavior around an existing column; it
introduces no new table.

---

## Entity: SendBatch (extended)

Existing table (`001-recruiter-outreach`, `send_batch`). One new column:

| Field | Type | Notes |
|-------|------|-------|
| attached_resume_id | UUID (FK → Resume), null | Which resume, if any, was attached to every send in this batch (FR-001-FR-003). `onDelete: "set null"`, mirroring the existing `template_id` column exactly. |

Rules (FR-001-FR-003, FR-005-FR-006, FR-009-FR-010):

- Set once, at batch creation, from the caller-supplied `resumeId` (validated — see
  Resume Attachment Validation below). Never changes after the batch is created.
- Independent of the resume's later status: if the resume is later archived (deleted),
  `attached_resume_id` still points at it and history reads still resolve it (FR-012)
  because resumes are only ever soft-deleted, never purged.
- A resend (`resendRecord`) creates its own new batch (existing behavior, unchanged); that
  new batch's `attached_resume_id` is set from the *original* batch's value, resolved
  again at resend time (FR-009), or left null if resolution fails (FR-010) — never copied
  blindly without re-resolving.

State/behavior notes:

```text
(send) resumeId provided & valid & active --> batch.attached_resume_id = resumeId
(send) resumeId omitted                   --> batch.attached_resume_id = null
(resend) original batch.attached_resume_id set & resolvable   --> new batch's copied, attached
(resend) original batch.attached_resume_id set & unresolvable --> new batch's left null, attachment dropped (reported, not failed)
(resend) original batch.attached_resume_id null               --> new batch's left null (no attachment, as before)
```

---

## Entity: Resume (extended validation, no schema change)

Existing table (`002-resume-storage`, `resume`). `file_name` already exists; this feature
changes **who may set it and when** — it does not add a column.

| Field | Type | Notes |
|-------|------|-------|
| file_name | text, not null | *(unchanged column)* Previously always the source file's own name; now optionally caller-supplied at upload or replace time (FR-013-FR-016). Always ends in `.pdf`; unsafe characters are stripped before saving. |

Rules (FR-013-FR-016):

- A custom file name is optional on both `uploadResume`'s and `replaceResume`'s input. When
  omitted, behavior is unchanged from 002-resume-storage: the uploaded file's own name is
  used.
- A provided custom name is trimmed, has unsafe file-name characters stripped, and has
  `.pdf` appended if missing (case-insensitive check). If nothing usable remains after
  stripping, falls back to the source file's own name — never rejected outright.
- This name is what's shown in the resume list/history (unchanged display logic) **and**
  what recipients see as the attachment's file name once this feature's send integration
  uses it (FR-016) — one name, two consumers.

---

## Cross-entity rules

- **Ownership isolation**: a `resumeId` submitted to `POST /api/send` is validated to
  belong to the calling user before it's attached to a batch — an id that exists but
  belongs to someone else is treated as not found, consistent with every other
  ownership check in this app (FR-005).
- **Active-only at fresh-send time, any-status at resend time**: `sendEmails` requires the
  resume to be currently active (`deletedAt IS NULL`); `resendRecord` accepts either,
  since it's reproducing a specific historical attachment, not offering a fresh choice
  (FR-006, FR-009, Research §4).
- **History read-through**: `listHistory`/`getHistoryDetail` left-join `resume` on
  `send_batch.attached_resume_id` to surface `{ label, fileName }` when set, tolerating a
  null result the same way a deleted contact's name is already tolerated (FR-007, FR-008).
- **Size ceiling**: the combined attachment + rendered body must stay under the outgoing
  provider's raw message size limit; violating this rejects the send before any recipient
  is contacted, never partway through a batch (FR-011).

## Validation schemas (Zod, at trust boundaries)

- `SendRequestSchema` (extended) — `resumeId: z.string().min(1).optional()`, alongside the
  existing `contactIds`/`templateId`/`override` fields.
- `ResumeFileNameSchema` (new, in `lib/validation/resumes.ts`) — trims input, strips
  characters unsafe in a file name, ensures a `.pdf` suffix, and is itself optional
  wherever it's used (upload, replace); falls back to the source file's name when omitted
  or when nothing usable remains after sanitization.
