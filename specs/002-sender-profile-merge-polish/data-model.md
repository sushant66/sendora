# Phase 1 Data Model: Sender profile, merge fields, and outreach polish

Additive to the 001 schema (`lib/db/schema.ts`). One new table and one additive migration on
`recruiter_contact`. No changes to `email_template`, `send_batch`, or `send_record` shapes.

## New entity: SenderProfile

One row per user (1:1 with `user`), created lazily on first save. Holds the "about me" values
that back the sender merge fields and the in-app display name.

| Field | Type | Notes |
|-------|------|-------|
| `id` | text (uuid) | PK |
| `userId` | text | FK → `user.id` `ON DELETE CASCADE`; **unique** (one profile per user) |
| `displayName` | text, nullable | Authoritative name for `{{my_name}}` and the in-app greeting; falls back to `user.name` when null/empty (FR-001) |
| `title` | text, nullable | Current or target job title → `{{my_title}}` |
| `pitch` | text, nullable | One-line positioning statement → `{{my_pitch}}` |
| `skills` | text, nullable | Free-form (typically comma-separated) → `{{my_skills}}` |
| `link` | text, nullable | Portfolio / LinkedIn / resume URL → `{{my_link}}`; validated as a URL |
| `location` | text, nullable | → `{{my_location}}` |
| `workPreference` | text, nullable | Enum: `remote` \| `hybrid` \| `onsite` \| `open` → `{{my_work_preference}}` |
| `createdAt` | timestamptz | default now |
| `updatedAt` | timestamptz | default now |

**Validation (Zod, `lib/validation/profile.ts`)**: all fields optional; each string trimmed and
length-bounded (short single-line fields capped, pitch/skills a larger cap so one field cannot
bloat an email); `link` must be a valid `http(s)` URL when present; `workPreference` must be one
of the four enum values. Empty strings normalize to null.

**Ownership**: a user reads/writes only their own profile (FR-006, FR-024).

**Indexes**: unique index on `userId`.

## Changed entity: RecruiterContact (soft-delete)

Additive columns to support undoable delete (FR-022/FR-023).

| Field | Type | Notes |
|-------|------|-------|
| `deletedAt` | timestamptz, nullable | Non-null means soft-deleted; excluded from all reads |
| `deletedBatch` | text, nullable | Groups the rows removed by one delete action; the unit of undo |

**Index change**: the existing unique index `recruiter_contact_user_email_idx` on
`(user_id, email_normalized)` becomes **partial**: `WHERE deleted_at IS NULL`. A soft-deleted
email therefore no longer blocks importing or adding the same email again.

**Read paths**: every contact query (list, search, `all=1` for compose, recontact lookup,
import dedup) MUST filter `deleted_at IS NULL`. Import dedup checks only live rows (a soft-deleted
duplicate does not count).

**Lifecycle**:

```text
live ──(delete: set deleted_at = now, deleted_batch = B)──▶ soft-deleted (hidden)
soft-deleted ──(undo restore of batch B: clear deleted_at + deleted_batch)──▶ live
soft-deleted ──(commit: no action; simply no longer offered for undo)──▶ soft-deleted (final)
```

- Only the most recent `deleted_batch` is undoable in a session (single undo slot). Starting a
  new delete makes any prior pending batch final (FR-023).
- Restore skips any row whose `email_normalized` now collides with a live contact (partial
  unique index); the rest of the batch restores. This is reported honestly to the user.
- `send_record.contact_id` (FK `ON DELETE SET NULL`) is untouched by soft-delete, so history
  stays linked to the same contact id across a delete/undo cycle. History also keeps its own
  `recipient_email`/subject/body snapshot, so it remains readable regardless.

**Purge**: hard-deleting long-soft-deleted rows is out of scope (future cleanup job).

## Merge-field vocabulary (not a table; the closed contract)

Extends `lib/templates/merge.ts`. Two namespaces, one render path.

| Namespace | Tokens | Source | Empty handling |
|-----------|--------|--------|----------------|
| Recipient | `first_name`, `last_name`, `full_name`, `company`, `role` | `RecruiterContact` | identity tokens fall back to a safe greeting word; `company`/`role` drop with a warning (unchanged from 001) |
| Sender | `my_name`, `my_title`, `my_pitch`, `my_skills`, `my_link`, `my_location`, `my_work_preference` | `SenderProfile` (name falls back to `user.name`) | each drops with a warning when the profile value is empty; never a literal placeholder |

- `mergeFields` on `email_template` may now contain sender tokens; save-time validation accepts
  both namespaces and still rejects unknown tokens (FR-007).
- `EmailTemplate.bodyHtml` stores raw `{{token}}` text exactly as today. The editor's merge chip
  serializes back to this format, so the stored contract and sanitizer are unchanged.

## Entity relationships (additions)

```text
user 1───1 sender_profile
user 1───* recruiter_contact   (recruiter_contact gains deleted_at / deleted_batch)
recruiter_contact 1───* send_record   (unchanged; ON DELETE SET NULL; unaffected by soft-delete)
```

## Migration notes

- New `sender_profile` table; additive columns + partial unique index on `recruiter_contact`
  via drizzle-kit. All additive and backward compatible (existing rows have `deleted_at = null`,
  so they remain live).
- Replacing the plain unique index with a partial one is a drop-and-create in the migration; no
  data change.
- The rewritten "cold outreach" starter (FR-017) is a change to the seed source
  (`lib/templates/starters.ts`). System templates are **shared rows** (`user_id = null`), seeded
  by the idempotent `lib/db/seed.ts` (it deletes all system rows and re-inserts from source, so
  it is safe to re-run). The fix is therefore: edit `starters.ts` and re-run the seed to refresh
  the single shared set. No per-user migration and no schema change are required for this part.
