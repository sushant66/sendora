# Phase 1 Data Model: Recruiter Outreach

**Feature**: `001-recruiter-outreach` | **Date**: 2026-07-11

Derived from the spec's Key Entities and Functional Requirements. Types are expressed
generically (with the intended PostgreSQL/Drizzle representation noted); all writes go
through the typed Drizzle layer and all external inputs are validated with Zod first.

Conventions: every table has `id` (UUID, primary key), `created_at` and `updated_at`
(timestamptz). All user-owned tables carry `user_id` and are always queried scoped to the
authenticated user (FR-022). Email uniqueness and dedup are case-insensitive on a
normalized (trimmed, lower-cased) email value.

---

## Entity: User (Job Seeker)

The authenticated owner of all data. Managed by Auth.js; the app treats it as the
identity root.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID (PK) | |
| email | text, unique, not null | The job seeker's login email (from Google) |
| name | text, null | Display name |
| image | text, null | Avatar URL from Google |
| created_at / updated_at | timestamptz | |

Relationships: 1→N `ConnectedEmailAccount`, `RecruiterContact`, `EmailTemplate`,
`SendBatch`, `SendRecord`.

*(Auth.js also manages its standard `account`/`session`/`verification_token` tables; the
OAuth tokens for Gmail live on `ConnectedEmailAccount` below rather than being read from
the raw Auth.js account row, to keep the provider seam self-contained.)*

---

## Entity: ConnectedEmailAccount

A job seeker's authorization to send from an external email provider (FR-019, FR-019a,
FR-019c). Gmail is the only `provider` value in v1; the column exists so additional
providers slot in without a schema change.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK → User) | |
| provider | text, not null | Enum-like; `gmail` in v1 (future: `outlook`, `smtp`, …) |
| email_address | text, not null | The address emails are sent from |
| access_token | text (encrypted), null | Short-lived; refreshed as needed |
| refresh_token | text (encrypted), not null | Encrypted at rest |
| token_expires_at | timestamptz, null | |
| scopes | text[] | Granted scopes (must include `gmail.send`) |
| status | text, not null | `active` \| `expired` \| `revoked` (FR-019b) |
| connected_at | timestamptz | |
| created_at / updated_at | timestamptz | |

Constraints & rules:
- Unique `(user_id, provider, email_address)` — a given account is connected once.
- `status` transitions: `active` → `expired` (token refresh fails) → `active` (reconnect);
  `active`/`expired` → `revoked` (user disconnects or Google revokes). Sending requires an
  `active` account (FR-019a); non-active surfaces a connect/reconnect prompt.
- Tokens are never returned to the client.

State transitions:

```text
(none) --connect--> active --refresh-fails--> expired --reconnect--> active
   active|expired --disconnect/revoke--> revoked --connect--> active
```

---

## Entity: RecruiterContact

A recruiter the job seeker intends to reach (US1). Owned by one user.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK → User) | |
| name | text, not null | Contact full name (min 1 char) |
| email | text, not null | Validated email; stored as entered |
| email_normalized | text, not null | Trimmed + lower-cased; used for dedup/uniqueness |
| company | text, null | Optional (merge field `{{company}}`) |
| role | text, null | Optional (merge field `{{role}}`) |
| source | text, not null | `csv` \| `xlsx` \| `paste` \| `manual` (provenance) |
| created_at / updated_at | timestamptz | |

Constraints & rules (FR-003, FR-004, FR-005):
- Unique `(user_id, email_normalized)` — enforces per-user dedup at the database level.
- `email` MUST pass email validation on import and manual entry; invalid rows are rejected
  and reported, never partially created (FR-004).
- On import, an incoming row matching an existing `email_normalized` is flagged as a
  duplicate and not inserted (FR-005, FR-006).

Merge-field derivation: `{{first_name}}`/`{{last_name}}` are derived from `name` at render
time; `{{full_name}}` = `name`.

---

## Entity: EmailTemplate

A reusable email definition (US2 starter library, US3 custom templates).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK → User), null | Null for system/starter templates; set for custom |
| kind | text, not null | `system` (starter library) \| `custom` |
| name | text, not null | Template display name |
| subject | text, not null | May contain merge tokens |
| body_html | text, not null | Sanitized rich-text HTML (bold/italic/lists/links) |
| body_text | text, not null | Plain-text alternative derived from body |
| merge_fields | text[] | Distinct tokens referenced (for validation/UX) |
| created_at / updated_at | timestamptz | |

Constraints & rules (FR-008–FR-012):
- Starter templates (`kind='system'`, `user_id` null) are readable by all users, not
  editable by users.
- Custom templates are created/edited/deleted only by their owner (FR-009, FR-022).
- On save, all `{{tokens}}` in `subject` + `body` MUST belong to the supported vocabulary
  (§7 of research); unsupported/malformed tokens block save with a warning (FR-011).
- `body_html` is server-side sanitized to the allow-list; editing produces a new version
  used for future sends — already-sent emails are immutable (FR-010 note in US3).

---

## Entity: SendBatch

Groups the send records produced by one send action (single or bulk) so results can be
reported in aggregate (US4, FR-018).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK → User) | |
| connected_account_id | UUID (FK → ConnectedEmailAccount) | Account used to send |
| template_id | UUID (FK → EmailTemplate), null | Source template (null if fully ad-hoc) |
| kind | text, not null | `single` \| `bulk` |
| total | int | Recipients after dedup (FR-016) |
| sent_count | int | |
| failed_count | int | |
| status | text, not null | `in_progress` \| `completed` |
| created_at / updated_at | timestamptz | |

Rules: recipients are deduplicated before the batch is created (FR-016). A single send is
a batch of size 1 (uniform reporting). `status` → `completed` once every record has a
terminal outcome; partial failures leave `sent_count`>0 and `failed_count`>0 with all
successful sends preserved (FR-018).

---

## Entity: SendRecord (Outreach Email)

One email sent (or attempted) to one recruiter (FR-013–FR-017, FR-020). This is the
history row (US5).

| Field | Type | Notes |
|-------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK → User) | |
| batch_id | UUID (FK → SendBatch) | |
| contact_id | UUID (FK → RecruiterContact) | Recipient |
| recipient_email | text, not null | Snapshot of the address sent to |
| subject | text, not null | Rendered (merge-resolved) subject snapshot |
| body_html | text, not null | Rendered, merge-resolved, sanitized HTML snapshot |
| body_text | text, not null | Rendered plain-text snapshot |
| status | text, not null | `pending` \| `sent` \| `failed` |
| failure_reason | text, null | Present when `status='failed'` (FR-017) |
| provider_message_id | text, null | Provider's id for a successful send |
| sent_at | timestamptz, null | Set when `status='sent'` |
| created_at / updated_at | timestamptz | |

Constraints & rules:
- Content is **snapshotted** at send time — editing a template later never alters history
  (US3 acceptance #3, US5).
- Rendered content MUST NOT contain an unresolved literal `{{token}}` (FR-012, SC-004);
  the render step guarantees this before a record reaches `sent`.
- `status` transitions: `pending` → `sent` (provider accepted) | `failed` (provider error
  or account not active). No re-send on retry of an interrupted batch — already-`sent`
  records are not re-processed (Edge Case: interrupted bulk send).

State transitions:

```text
pending --provider accepts--> sent
pending --provider error / account inactive--> failed
```

---

## Cross-entity rules

- **Ownership isolation (FR-022)**: every query for contacts, templates, batches, and
  records is filtered by `user_id`; starter templates are the only cross-user-readable
  rows and are read-only.
- **Re-contact warning (FR-021)**: computed by looking up prior `SendRecord`s
  (`status='sent'`) for the same `(user_id, contact_id)` when a new send is composed.
- **Dedup within a send (FR-016)**: performed on `email_normalized` before batch creation
  so a recruiter appearing twice yields one `SendRecord`.

## Validation schemas (Zod, at trust boundaries)

- `ImportRowSchema` — normalized `{ name, email, company?, role? }` (shared by CSV/xlsx/
  paste); rejects rows without a valid email.
- `ContactInputSchema` — manual add/edit.
- `TemplateInputSchema` — `{ name, subject, bodyHtml }`; validates merge tokens against the
  supported vocabulary and sanitizes HTML.
- `SingleSendSchema` / `BulkSendSchema` — `{ templateId | inlineContent, contactId(s),
  connectedAccountId }`.
- `EnvSchema` — required environment variables (DB URL, Google OAuth client id/secret,
  token-encryption key) validated at startup.
