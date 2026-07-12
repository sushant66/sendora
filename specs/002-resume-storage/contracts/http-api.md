# HTTP API Contract: Resume Storage

**Feature**: `002-resume-storage` | **Date**: 2026-07-11

Internal API consumed by the Sendora UI. All endpoints require an authenticated session
and are scoped to the caller (FR-014). Validation failures return `422` with
`{ error: "validation", fields: { <field>: <message> } }`.

Maps to user stories: **US1** save a labeled resume, **US2** browse and open, **US3**
remove, **US4** replace-with-history and restore.

---

## `GET /api/resumes?includeArchived=`

Lists the caller's resumes.
- Default (`includeArchived` absent/`false`): active resumes only (`deletedAt` null),
  ordered by label ascending (US2).
- `includeArchived=true`: also returns archived resumes, so the caller can group by
  `label` and order by `version` to render each label's history (US4, FR-011).
- **200** → `{ items: Resume[] }`

`Resume = { id, label, version, fileName, fileSize, status: "active"|"archived", createdAt }`

---

## `POST /api/resumes`

Uploads a new resume. `multipart/form-data`: `label` (text field), `file` (PDF).

- Validates `label` (non-empty, ≤150 chars) and `file` (≤10MB, `application/pdf` content-
  type **and** a `%PDF-` magic-byte check) — **422** `{ error: "validation", fields }` on
  failure (FR-002, FR-003, FR-004).
- **409** `{ error: "label_taken" }` if the caller already has an active resume under that
  label (FR-005).
- **409** `{ error: "resume_limit_reached" }` if the caller already has 20 active resumes
  (FR-006).
- **201** → `Resume` (the new row; `version` is `previous max for this label + 1`, `status:
  "active"`).

---

## `POST /api/resumes/:id/replace`

Replaces an active resume with a new file, archiving the old version (US4, FR-010,
FR-016). Multipart: `file` (PDF) only — no `label` field; the label is inherited from the
target resume. This is a **distinct action from `POST /api/resumes`**, not an alternate
mode of it: the plain upload endpoint above always rejects a duplicate active label
(FR-005), unconditionally; Replace is the only way to update an existing label's active
resume in place.

- Validates `file` the same way plain upload does (≤10MB, `application/pdf` content-type
  **and** a `%PDF-` magic-byte check) — **422** on failure.
- **200** → the new active `Resume` (`version` is `previous max for this label + 1`).
- **404** if the id doesn't exist, isn't owned by the caller, or isn't currently active
  (replace only applies to a currently-active resume; an archived one is restored, not
  replaced).
- Never returns `409 label_taken` — the label isn't submitted, so there's no new-label
  collision possible, and this action never changes the active-resume count (FR-006's cap
  does not apply to Replace).

---

## `GET /api/resumes/:id`

Streams the resume's PDF (active or archived — US2, US4).
- **200** → body is the PDF; `Content-Type: application/pdf`,
  `Content-Disposition: inline; filename="<fileName>"`.
- **404** if the id doesn't exist or isn't owned by the caller (FR-014).

---

## `DELETE /api/resumes/:id`

Removes an active resume (US3). Soft-delete only — the underlying file is retained
(FR-009, FR-010).
- **204** on success.
- **404** if the id doesn't exist, isn't owned by the caller, or is already archived
  (delete only applies to a currently-active resume).

---

## `POST /api/resumes/:id/restore`

Restores an archived resume as the active one for its label (US4, FR-012, FR-013).
- Behavior: in one transaction, archives whatever resume is currently active for that
  label (if any), then reactivates the target row. Does not create a new `version`.
- **200** → the reactivated `Resume` (`status: "active"`).
- If the target is already active, this is a no-op (spec Edge Cases): **200** → the
  resume unchanged, not an error.
- **404** if the id doesn't exist or isn't owned by the caller.
