# Phase 0 Research: Resume Attachments

**Feature**: `003-resume-attachments` | **Date**: 2026-07-12

This document resolves the technical unknowns for the plan. Each decision records what was
chosen, why, and the alternatives considered. Decisions are constrained by the Sendora
Constitution v1.1.0 and the existing `lib/send`/`lib/email`/`lib/history`/`lib/resumes`
code this feature extends.

## 1. Schema shape for the attachment reference

- **Decision**: A single nullable `attached_resume_id` column on `send_batch`, a text FK →
  `resume.id` with `onDelete: "set null"` — the exact same nullability/cascade shape as the
  existing `template_id` column on the same table.
- **Rationale**: The spec's decision #1 is one resume per send, applied identically to
  every recipient in the batch; the spec explicitly puts "attaching more than one resume to
  a single send" out of scope. A single nullable FK is the smallest thing that satisfies
  that (Constitution Principle I, YAGNI) and it directly reuses a pattern already proven
  in this exact table.
- **Alternatives considered**: A separate `email_attachments` join table (batch id +
  resume id + attachment type), enabling one-to-many attachments per send. Rejected for
  now: it adds a new table, a new migration, and an extra join at every read site for a
  capability (multiple attachments) the spec explicitly excludes. If multi-attachment
  becomes a real requirement later, migrating a single FK column to a join table is a
  well-understood, mechanical schema change (add table, backfill from the column, drop the
  column), not a redesign — so starting simple does not foreclose that path.

## 2. Reading resume bytes for the MIME attachment

- **Decision**: Reuse `lib/resumes/service.ts`'s existing `getResumeFile(userId, id)`,
  which already returns `{ body: ReadableStream<Uint8Array>, contentLength, fileName }`.
  Add a small helper in `lib/send/service.ts` that fully drains that stream into a `Buffer`
  once per batch (e.g. via `new Response(body).arrayBuffer()`, a platform API already
  available in the Next.js/Node runtime this app targets), before the per-recipient send
  loop begins.
- **Rationale**: `getResumeFile` is exactly the seam 002-resume-storage's plan called out
  as the thing a future attachment feature should depend on ("never on R2 directly").
  Draining once and holding the `Buffer` in memory for the loop directly satisfies FR-004
  (fetch once per batch, not once per recipient) with no new storage-layer code.
- **Alternatives considered**: Re-fetching per recipient — rejected outright by FR-004 and
  wasteful for bulk sends; adding a new `getResumeBuffer` method to the storage layer —
  rejected as an unnecessary second read path when the stream-to-buffer conversion is a
  one-line, request-scoped concern that belongs in the caller, not the storage wrapper.

## 3. MIME shape for an attached message

- **Decision**: `OutgoingMessage` (lib/email/provider.ts) gains an optional field:
  `attachment?: { fileName: string; contentType: "application/pdf"; content: Buffer }`.
  `buildRawMessage` (lib/email/mime.ts) checks for this field: when absent, it produces
  exactly the same `multipart/alternative` message as today (byte-for-byte unchanged,
  keeping the existing MIME contract test green with no modification); when present, it
  wraps that same `multipart/alternative` part as the first part of an outer
  `multipart/mixed` message, with the PDF as a second part carrying
  `Content-Disposition: attachment; filename="<fileName>"`,
  `Content-Type: application/pdf`, and `Content-Transfer-Encoding: base64`. A second,
  independently-injectable boundary string (mirroring the existing `boundary` parameter's
  test-determinism purpose) separates the outer `multipart/mixed` parts from the inner
  `multipart/alternative` boundary.
- **Rationale**: This is the standard RFC 2046 shape for a "rich text body + attachment"
  email (nested `multipart/mixed` > `multipart/alternative` + attachment part), which is
  what Gmail (and every other mail client) expects. Keeping the no-attachment path
  byte-for-byte identical satisfies FR-005's requirement that adding this feature not
  change the existing MIME contract.
- **Alternatives considered**: A flat `multipart/mixed` with three parts (text, html,
  attachment) instead of nesting `multipart/alternative` inside `multipart/mixed` —
  rejected because it changes how mail clients choose between the plain-text and HTML
  parts (an `alternative` part groups them explicitly as "pick one representation"; three
  flat `mixed` parts would let a client show both text and HTML at once, which is wrong).

## 4. Validating a resume is attachable at send time

- **Decision**: `sendEmails` validates a submitted `resumeId` in two steps: (1) ownership
  — the resume must belong to the calling user, else `NotFoundError` (mirrors every other
  ownership check in this app: unowned/unknown → not found, never 403); (2) availability
  — the resume must currently be active (`deletedAt IS NULL`), else `ConflictError`
  (`"resume_unavailable"`, mapping to `409` like the existing `"no_active_account"`
  pattern), since the Compose selector only ever lists active resumes and hitting this
  means the resume was deleted in the (short) window between loading Compose and hitting
  send. `resendRecord`, in contrast, does **not** require the resume to still be active —
  it calls `getResumeFile` directly (active or archived both resolve, since resumes are
  only ever soft-deleted), matching the spec's decision #3 that a resend should succeed
  even against an archived resume.
- **Rationale**: A fresh send and a resend have different correctness requirements: a
  fresh send's Resume selector promises "one of your active resumes," so send-time must
  re-check that promise still holds; a resend is reproducing a specific past batch's
  exact attachment, which by design may since have been archived (e.g. replaced by a newer
  version) without that making the resend wrong.
- **Alternatives considered**: Treating an inactive resume at send time as "not found"
  (404) like ownership failures — rejected because the spec's edge case wants a specific,
  actionable message ("no longer available, pick again"), not a generic not-found, since
  the resume did exist moments earlier in the same session.

## 5. Resend's attachment lookup

- **Decision**: `resendRecord` (which operates on a single `SendRecord`, creating a new
  one-record batch per call — the existing behavior, unchanged) looks up the **original**
  batch's `attachedResumeId` via `sendRecord.batchId`, then attempts `getResumeFile` for
  that id. If it resolves, the new resend batch is created with the same
  `attachedResumeId` and the attachment is sent. If it fails (defensive-only path — no
  hard-delete exists in this app today, so this should not happen in practice), the resend
  still proceeds without the attachment, the new batch's `attachedResumeId` is left null
  (history should reflect what actually went out, not what was intended), and the result
  returned to the caller carries a plain field the UI uses to tell the user the attachment
  was dropped.
- **Rationale**: Directly satisfies FR-009/FR-010 — resend reproduces the original
  attachment automatically, and a resolution failure degrades gracefully rather than
  failing the whole resend, consistent with this app's existing partial-failure posture
  (a send's per-recipient failures already never roll back the batch).
- **Alternatives considered**: Snapshotting the resume's bytes or a copy at original send
  time so resend never depends on the resume still existing — rejected per the spec's
  decision #3 ("no attachment snapshotting at send time; store a reference, not a copy"),
  and unnecessary today since resumes are never hard-deleted.

## 6. Enforcing the outgoing message size limit

- **Decision**: Before entering the per-recipient send loop, `sendEmails` builds one
  representative raw MIME message (using the first recipient's rendered content plus the
  attachment buffer, if any) and checks its encoded length against a fixed ceiling set
  safely under Gmail's ~25MB raw-message limit. If it's over, the send is rejected up front
  with a clear `ConflictError` (`"attachment_too_large"`, `409`) before any recipient is
  contacted — never a partial batch, never a raw provider error surfaced to the user.
- **Rationale**: Per-recipient body content (subject/HTML/text after merge-field
  resolution) varies only trivially in size between recipients compared to a resume
  attachment that can be up to 10MB; checking once against a representative recipient is
  sufficient and avoids re-encoding the full message once per recipient in a bulk send.
  FR-011 requires this to fail gracefully rather than being assumed safe.
- **Alternatives considered**: Checking only the attachment's raw byte size against a
  fixed threshold without building the full message — simpler, but less precise (it
  ignores base64's ~33% size inflation and the body's own contribution); building and
  checking the encoded size for every recipient — rejected as wasted work for bulk sends,
  since the attachment (the dominant factor by far) is identical for every recipient in
  the batch.

## 7. Custom resume file name

- **Decision**: `lib/validation/resumes.ts` gains a `ResumeFileNameSchema`: trims input,
  strips characters unsafe in a file name (path separators, control characters), appends
  `.pdf` if the result doesn't already end with it (case-insensitively), and falls back to
  the original uploaded file's name if nothing usable remains after stripping. This is
  threaded as an optional field on both the upload (`ResumeUploadSchema`) and replace
  inputs; when omitted, behavior is exactly what it is today (the source file's own name).
  No schema/table change — `resume.file_name` already exists and already means "the name
  shown for this resume"; this only changes who gets to set it and when.
- **Rationale**: Directly satisfies FR-013-FR-016. Keeping this as an optional override on
  the existing field (rather than adding a second "display name" column) avoids introducing
  a distinction the rest of the app (list display, history, and now the email attachment)
  would otherwise have to reconcile between "file name" and "display name" — there is
  exactly one name, and it is now user-editable at the two points (upload, replace) where a
  file is provided.
- **Alternatives considered**: A separate `display_name` column distinct from the
  originally-uploaded file's name — rejected as an unnecessary second field; nothing in the
  spec needs to recall the original, system-derived name once a custom one is set.

## 8. Compose UI shape for resume selection

- **Decision**: A second `Selector` in Compose, labeled "Resume," placed beside the
  existing "Template" `Selector`, populated from the same `GET /api/resumes` call the
  Resumes page already uses (no `includeArchived`, so active-only by construction),
  defaulting to an empty selection with placeholder text conveying "no attachment" — the
  identical UX pattern the Template selector already uses for "optional, none selected."
- **Rationale**: Reuses an existing, already-accessible, already-tested component pattern
  exactly as-is (Constitution Principle IV); introduces no new selection paradigm for the
  user to learn.
- **Alternatives considered**: A separate explicit "No attachment" option row in the list
  — rejected as redundant with the placeholder-based "nothing selected" convention already
  established by the Template selector in the same form.

## Open items intentionally deferred (not blocking)

- Per-recipient different attachments, non-PDF attachment types, and multiple attachments
  per send are all explicitly out of scope per the spec; the schema/MIME shapes chosen here
  do not block adding them later (see §1, §3).
- A cover-letter or second-document-type attachment is not addressed here; would need its
  own spec if the "one resume, one PDF" scope proves too narrow later.
