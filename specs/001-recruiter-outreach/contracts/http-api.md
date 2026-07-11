# HTTP API Contract: Recruiter Outreach

**Feature**: `001-recruiter-outreach` | **Date**: 2026-07-11

Internal API consumed by the Sendora UI. All endpoints require an authenticated session
and are scoped to the caller (FR-022). Validation failures return `422` with
`{ error: "validation", fields: { <field>: <message> } }`. Shapes below list the
significant fields; every list endpoint supports pagination unless noted.

Maps to user stories: **US1** contacts/import, **US2**/**US4** send, **US3** templates,
**US5** history, **FR-019a** email-account connection.

---

## Email account (FR-019, FR-019a, FR-019b)

### `GET /api/email-account`
Returns the caller's connected account status.
- **200** → `{ connected: boolean, provider?: "gmail", emailAddress?: string, status?: "active"|"expired"|"revoked" }`

### `POST /api/email-account/connect`
Begins Google OAuth (incremental) requesting `gmail.send`. Returns the authorization URL.
- **200** → `{ authorizeUrl: string }`

### OAuth callback (Auth.js route)
Handled by `GET /api/auth/callback/google`; on success stores/updates the
`ConnectedEmailAccount` (status `active`, refresh token encrypted).

### `DELETE /api/email-account`
Disconnects the account (status → `revoked`).
- **204**

---

## Contacts (US1 — FR-001…FR-007)

### `GET /api/contacts?query=&cursor=`
Search + list the caller's contacts.
- **200** → `{ items: Contact[], nextCursor: string|null }`

### `POST /api/contacts`
Manual add.
- Body: `{ name: string, email: string, company?: string, role?: string }`
- **201** → `Contact`  · **409** if `email` already exists for the user

### `PATCH /api/contacts/:id` · `DELETE /api/contacts/:id`
Edit / delete a single contact. **200** / **204**. **404** if not owned.

### `POST /api/contacts/import`
Import from a parsed, normalized row set (client parses CSV/xlsx/paste; server
re-validates as the authoritative boundary).
- Body: `{ source: "csv"|"xlsx"|"paste", rows: Array<{ name, email, company?, role? }> }`
- **200** → import summary:
  ```json
  {
    "imported": 42,
    "duplicates": [{ "row": 5, "email": "a@x.com" }],
    "invalid":    [{ "row": 8, "reason": "missing/invalid email" }]
  }
  ```
- Rule: valid rows import even when others are invalid/duplicate (never all-or-nothing);
  every skipped row is reported (FR-006). Empty/oversized/unrecognized payloads → `422`
  with a clear reason (Edge Cases).

`Contact = { id, name, email, company|null, role|null, source, createdAt }`

---

## Templates (US2 starter library, US3 custom — FR-008…FR-012)

### `GET /api/templates`
Returns starter (`kind:"system"`) + the caller's custom templates.
- **200** → `{ items: Template[] }`

### `POST /api/templates` · `PATCH /api/templates/:id` · `DELETE /api/templates/:id`
Create / edit / delete a **custom** template (system templates are read-only → `403` on
mutate).
- Body: `{ name: string, subject: string, bodyHtml: string }`
- Server sanitizes `bodyHtml` and validates all `{{tokens}}` against the supported
  vocabulary; unsupported/malformed tokens → **422** `{ error: "unsupported_merge_fields",
  fields: ["{{bad_token}}"] }` (FR-011).
- **201**/**200**/**204**

### `POST /api/templates/preview`
Render a template for a given contact (used by compose preview).
- Body: `{ templateId | { subject, bodyHtml }, contactId }`
- **200** → `{ subject, bodyHtml, bodyText, warnings: [{ field, message }] }`
- Rendered output MUST contain no literal `{{token}}` (FR-012, SC-004); missing values use
  the defined fallback or produce a `warning`.

`Template = { id, kind, name, subject, bodyHtml, bodyText, mergeFields, createdAt }`

---

## Sending (US2 single, US4 bulk — FR-013…FR-019)

### `POST /api/send`
Sends a single email OR a bulk batch (uniform contract; `contactIds` length drives kind).
- Body:
  ```json
  {
    "contactIds": ["<uuid>", "..."],
    "templateId": "<uuid>",
    "override": { "subject": "...", "bodyHtml": "..." }
  }
  ```
  (`override` optional — the edited content from the compose/preview step.)
- Preconditions: an `active` connected account (else **409** `{ error: "no_active_account" }`
  → UI prompts to connect, FR-019a).
- Behavior: dedup `contactIds` (FR-016) → create `SendBatch` → render + send one message
  per recipient via the provider seam → record each `SendRecord` outcome.
- **200** → per-recipient summary:
  ```json
  {
    "batchId": "<uuid>",
    "total": 50, "sent": 48, "failed": 2,
    "results": [
      { "contactId": "...", "recipientEmail": "...", "status": "sent" },
      { "contactId": "...", "recipientEmail": "...", "status": "failed", "reason": "..." }
    ]
  }
  ```
- Rule: partial failures never roll back successful sends (FR-018); failures carry a
  reason (FR-017); an expired/revoked account mid-batch marks remaining as `failed` with a
  clear reason (FR-019b).

---

## History (US5 — FR-020, FR-021)

### `GET /api/history?cursor=`
Lists the caller's send records, newest first.
- **200** → `{ items: SendRecord[], nextCursor: string|null }`
- `SendRecord = { id, recipientEmail, contactId|null, subject, templateName|null, status,
  failureReason|null, sentAt|null, createdAt, batchId }`
  (`contactId` is null when the recruiter was later deleted — history rows are immutable
  snapshots and the `recipientEmail` snapshot preserves who it went to.)

### `GET /api/history/recontact?contactIds=`
Given contacts being composed to, returns which were previously emailed (FR-021).
- **200** → `{ previouslyContacted: [{ contactId, lastSentAt }] }`
