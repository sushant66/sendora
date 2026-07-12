# HTTP API contracts (feature 002)

Internal route handlers. All authenticated; all scoped to the current user; all bodies validated
with Zod. JSON unless noted. Error shape reuses the existing `{ error, fields? }` convention.

## Sender profile

### `GET /api/profile`

Returns the current user's profile, or an empty profile shape if none saved yet.

```jsonc
// 200
{
  "displayName": "Ada Lovelace",   // null when unset (client falls back to account name)
  "title": "Senior Frontend Engineer",
  "pitch": "I build accessible design systems.",
  "skills": "React, TypeScript, StyleX",
  "link": "https://ada.dev",
  "location": "Remote (UK)",
  "workPreference": "remote"        // "remote" | "hybrid" | "onsite" | "open" | null
}
```

### `PUT /api/profile`

Upserts the profile (creates the row lazily on first save). All fields optional; empty strings
normalize to null.

```jsonc
// request (any subset)
{ "displayName": "Ada Lovelace", "title": "...", "pitch": "...", "skills": "...",
  "link": "https://ada.dev", "location": "...", "workPreference": "remote" }
// 200 → the saved profile (same shape as GET)
// 422 → { "error": "validation", "fields": { "link": "Enter a valid URL.",
//         "workPreference": "Choose one of remote, hybrid, onsite, open." } }
```

## Bulk contact delete + undo (soft-delete)

### `POST /api/contacts/bulk-delete`

Soft-deletes contacts in one action, tagging them with a single `deletedBatch`. Two modes:

```jsonc
// mode A — explicit ids (loaded-row selection)
{ "ids": ["c_1", "c_2", "c_3"] }

// mode B — everything matching the current search/filter (two-step "select all N matching")
{ "matchAll": true, "query": "acme", "excludedIds": ["c_9"] }

// 200
{ "deletedBatch": "b_abc123", "count": 42 }
// 422 → { "error": "validation", "fields": { "ids": "Provide ids or matchAll." } }
```

- Exactly one of `ids` / `matchAll` is required. `ids` is bounded to a sane maximum per request.
- Only live rows (`deleted_at IS NULL`) owned by the user are affected.
- The operation makes any previously pending `deletedBatch` final (single undo slot, FR-023).

### `POST /api/contacts/restore`

Undo: clears the soft-delete for one batch.

```jsonc
// request
{ "deletedBatch": "b_abc123" }
// 200
{ "restored": 41, "skipped": 1 }   // skipped = rows whose email now collides with a live contact
// 404 → { "error": "not_found" }  // batch already committed/unknown (undo no longer available)
```

- Restore re-activates rows by `deleted_batch`. A row whose `email_normalized` now matches a live
  contact is left deleted and counted in `skipped` (partial unique index; reported honestly).

## Test send

### `POST /api/send/test`

Renders the current draft and sends one test to the job seeker's own connected address. Creates
NO `send_batch` / `send_record` rows (FR-015).

```jsonc
// request (mirrors the real send override shape; templateId optional)
{ "contactId": "c_1",            // optional: preview target; omit to use sample data
  "templateId": "t_1",           // optional
  "override": { "subject": "Following up on {{role}}", "bodyHtml": "<p>Hi {{first_name}}...</p>" } }

// 200
{ "status": "sent", "toEmail": "ada@ada.dev" }
// 200 (delivery failed at provider)
{ "status": "failed", "reason": "The provider rejected the message." }
// 409 → { "error": "no_active_account" }   // no connected inbox (prompt to connect, like a real send)
// 422 → { "error": "validation", "fields": { "bodyHtml": "Add a subject and body first." } }
```

- The delivered test subject carries a clear test marker so the inbox copy is unmistakably a test.
- When `contactId` is omitted, merge fields resolve against clearly labelled sample data.
- Sender (`my_*`) fields resolve from the current profile, identical to a real send.

## Missing-value gate (reuses existing render; no new endpoint)

The pre-send summary (FR-016) is computed on the client from data already loaded in compose:

- The set of tokens used = extracted from the current subject + body (same regex as the engine).
- Recipient emptiness = per selected contact, which used recipient tokens have no value.
- Sender emptiness = which used sender tokens have no profile value (same for all recipients).
- The "how it actually reads" sample uses the existing `POST /api/templates/preview` for a
  representative affected recipient (already returns the resolved subject/body).

No new endpoint is required; `GET /api/profile` and `GET /api/contacts?all=1` (existing) plus the
existing preview endpoint provide everything the gate needs.

## Merge-field list (client constant, no endpoint)

The slash menu and the subject "insert field" menu read a static typed list derived from the
merge vocabulary: `{ token: "first_name", label: "First name", group: "recipient" }`,
`{ token: "my_title", label: "Your title", group: "sender" }`, etc. Shipped as a shared constant,
not fetched.
