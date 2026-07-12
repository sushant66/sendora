# Phase 1 Data Model: Resume Storage

**Feature**: `002-resume-storage` | **Date**: 2026-07-11

Derived from the spec's Key Entities and Functional Requirements. Types are expressed
generically (with the intended PostgreSQL/Drizzle representation noted); all writes go
through the typed Drizzle layer, the PDF bytes themselves live in Cloudflare R2 (see
`research.md` §1), and all external inputs are validated with Zod first.

Convention: like every other user-owned table, `resume` carries `user_id` and is always
queried scoped to the authenticated user (mirrors FR-022 in `001-recruiter-outreach`; here,
FR-014).

---

## Entity: Resume

A single uploaded PDF document owned by one user (FR-001, FR-010). One row = one version
in its label's history.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK → User) | |
| label | text, not null | User-chosen name, e.g. "Backend Engineer"; trimmed, 1-150 chars |
| version | integer, not null | Monotonic per `(user_id, label)`, starts at 1, never reused or reset |
| file_name | text, not null | Original uploaded file name, for display |
| storage_key | text, not null | R2 object key: `${user_id}/${id}.pdf` |
| file_size | integer, not null | Bytes; ≤ 10MB (FR-003) |
| deleted_at | timestamptz, null | Null = active; set = archived |
| created_at / updated_at | timestamptz | |

Constraints & rules (FR-002–FR-006, FR-010–FR-013):
- **Partial unique** `(user_id, label)` `WHERE deleted_at IS NULL` — at most one active
  resume per label per user (FR-005); an archived row never blocks reuse of its label.
- Unique `(user_id, label, version)` — version numbers never collide within a label's
  lineage.
- A user may have at most 20 rows with `deleted_at IS NULL` at a time (FR-006); archived
  rows are uncounted.
- `file_name`/`storage_key`/`file_size` are set once at upload and never change.
- Content is validated before a row is created: `application/pdf` content-type **and** a
  `%PDF-` magic-byte check (FR-002); rejected uploads create no row.

State transitions (FR-010, FR-012, FR-013):

```text
(upload) --new label or reused-but-archived label--> active (version = prior max + 1)
active --delete (FR-009)--> archived (deleted_at set; file retained)
active --new upload under same label (FR-010)--> archived (this row); a new active row is
    created at version + 1
archived --restore (FR-012)--> active; whatever row was active for that label (if any)
    --> archived in the same transaction (FR-013)
```

Exactly one of `active` / `archived` is true at any time for a given row; exactly one row
per `(user_id, label)` is ever `active`.

---

## Cross-entity rules

- **Ownership isolation (FR-014)**: every query — list, open/download, delete, restore —
  is filtered by `user_id`; a resume id that exists but belongs to another user is treated
  as not found, never as a permission error that would confirm its existence.
- **History grouping (FR-011)**: a label's version history is `SELECT * FROM resume WHERE
  user_id = ? AND label = ? ORDER BY version ASC`; the current active version is the one
  row in that set with `deleted_at IS NULL`.
- **Content immutability (FR-015)**: a resume's stored bytes are never modified after
  upload; "replacing" a resume always creates a new row/version, never an in-place edit of
  the file.

## Validation schemas (Zod, at trust boundaries)

- `ResumeLabelSchema` — trimmed string, 1-150 characters.
- `ResumeUploadSchema` — file metadata: size ≤ 10MB, `content-type === "application/pdf"`,
  and a custom refinement asserting the file's leading bytes are the `%PDF-` signature.
- `EnvSchema` (extended) — adds `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, validated at startup alongside the existing
  required variables.
