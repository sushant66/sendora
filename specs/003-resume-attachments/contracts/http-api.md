# HTTP API Contract Deltas: Resume Attachments

**Feature**: `003-resume-attachments` | **Date**: 2026-07-12

Only the fields/behavior this feature changes are shown. Everything else on each endpoint
is unchanged from `001-recruiter-outreach/contracts/http-api.md` (send, history) and
`002-resume-storage/contracts/http-api.md` (resumes).

---

## `POST /api/send` (extended — FR-001-FR-006, FR-011)

Body gains one optional field:

```json
{
  "contactIds": ["<uuid>", "..."],
  "templateId": "<uuid>",
  "override": { "subject": "...", "bodyHtml": "..." },
  "resumeId": "<uuid>"
}
```

- `resumeId` omitted or absent → the send has no attachment, exactly as it works today.
- **404** if `resumeId` doesn't exist or isn't owned by the caller (same "unowned/unknown →
  not found" convention as every other reference in this app).
- **409** `{ error: "resume_unavailable" }` if `resumeId` exists and is owned by the caller
  but is not currently active (it was deleted between loading Compose and sending) —
  distinct from `no_active_account`, so the UI can tell the user specifically that their
  chosen resume is gone and ask them to pick again.
- **409** `{ error: "attachment_too_large" }` if attaching the resume would push the total
  outgoing message over the provider's size limit — checked before any recipient is
  contacted (FR-011).
- **200** response shape is unchanged (`{ batchId, total, sent, failed, results }`).

---

## `GET /api/history?cursor=` and `GET /api/history/:id` (extended — FR-007, FR-008)

`HistoryEvent` and `HistoryDetail` each gain one optional field:

```json
{
  "attachedResume": { "label": "Backend Engineer", "fileName": "backend-resume.pdf" }
}
```

- Present only when that batch had a resume attached; absent/`null` otherwise.
- Resolved via a left join on `send_batch.attached_resume_id` — tolerates the join coming
  back empty (treated as no attachment shown) the same way a deleted contact's name is
  already tolerated elsewhere in history, even though resumes are never hard-deleted today.

---

## `POST /api/history/:id/resend` (unchanged request/response shape — FR-009, FR-010)

No change to the request or the success/failure response shape. Behavior only: if the
original batch had a resume attached, the resend automatically reattaches it by re-resolving
the reference at resend time (not a blind copy). If that resolution fails (defensive-only
path), the resend still completes without the attachment; the resend result's existing
`reason`-style feedback channel is used to tell the caller the attachment was dropped,
rather than surfacing this as a failure.

---

## `POST /api/resumes` and `POST /api/resumes/:id/replace` (extended — FR-013-FR-016)

Both multipart endpoints gain one optional text field:

- `fileName` (optional) — a custom file name for the resume. When present: sanitized
  (unsafe characters stripped) and normalized to end in `.pdf`. When absent, or when
  nothing usable remains after sanitization: falls back to the uploaded file's own name,
  exactly as these endpoints behave today.
- No new error shape — an unusable custom name never causes a `422`; it degrades to the
  fallback instead (see Research §7 for why this is a fallback, not a rejection).
- Response `Resume.fileName` reflects whichever name was actually saved (custom or
  fallback) — no change to the `Resume` shape itself.
