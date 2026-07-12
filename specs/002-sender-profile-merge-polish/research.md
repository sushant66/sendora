# Phase 0 Research: Sender profile, merge fields, and outreach polish

All spec clarifications are resolved (see spec Clarifications), so this document records the
implementation decisions that flow from them. Each item: Decision, Rationale, Alternatives.

## 1. Sender merge-field vocabulary and namespace

**Decision**: Add a closed set of sender tokens namespaced with a `my_` prefix, alongside the
existing recipient tokens. Sender set: `my_name`, `my_title`, `my_pitch`, `my_skills`,
`my_link`, `my_location`, `my_work_preference`. No composite `my_signature` token (spec FR-004).
Recipient set is unchanged (`first_name`, `last_name`, `full_name`, `company`, `role`).

**Rationale**: A `my_` prefix reads naturally in the "Your details" menu group and can never
collide with a recipient token. Reusing the existing closed-vocabulary + total-render engine
(`lib/templates/merge.ts`) keeps one code path for validation, warnings, and the
zero-literal-placeholder guarantee across both namespaces.

**Alternatives**: A dotted namespace (`sender.title`) rejected because the existing tokens are
flat snake_case and the regex/vocabulary already assume that shape. A composite signature token
rejected per the clarified FR-004 (job seeker composes a sign-off from individual fields).

## 2. Empty sender values and the missing-value gate

**Decision**: Sender fields resolve with the same total render as recipient fields: never emit
a literal `{{token}}`; drop an empty optional value and surface a `RenderWarning`. Before a
bulk send, compute per-recipient warnings for the whole selection and present a single summary
that includes how an affected email actually reads (the resolved text for a representative
missing-value recipient), then require an explicit confirm (spec FR-016). The gate is
warn-and-confirm, not blocking.

**Rationale**: A dropped value can still change a sentence's meaning even with no literal
placeholder ("I saw  is hiring"). Showing the real resolved reading, not just a count, lets the
job seeker judge the impact. The computation reuses the existing render warnings, so no new
rendering logic is introduced.

**Alternatives**: Advisory count only (rejected: hides the meaning change). Hard block
(rejected: over-strict when a blank is harmless, and it fights the graceful-fallback design).
A smart-fallback (readable default for a blank load-bearing field) is noted as a future
planning-time enhancement, out of scope here.

## 3. Inline slash menu + atomic merge chip (rich-text body)

**Decision**: Implement the "/" menu with `@tiptap/suggestion` and render an inserted field as
a custom atomic ProseMirror Node (a "merge chip") that carries the token in an attribute and
displays the human label. The chip is `atom: true` / `selectable`, so it inserts and deletes as
one unit and cannot be partially edited. On serialization the chip renders back to the exact
`{{token}}` text for storage, sanitization, and the existing merge engine. The menu is a
labelled listbox grouped into "Recipient" and "Your details", filterable by typing, navigable
by arrow keys, confirmed with Enter, dismissed with Escape.

**Rationale**: Directly satisfies FR-013 (survives editing) and SC-003 (0 malformed tokens).
Tiptap/ProseMirror is already the editor; Suggestion is its first-party mechanism for this exact
pattern. Storing the chip as an attribute and serializing to `{{token}}` keeps the persisted
format identical to today, so the merge engine, sanitizer, and template validation are unchanged.

**Alternatives**: Raw/highlighted text (rejected: breakable, fails SC-003). A third-party
mention library (rejected: heavier than needed; Suggestion covers it). Storing chips as HTML
spans that the merge engine must parse (rejected: changes the stored contract and complicates
sanitization).

**Accessibility**: The menu uses roving focus with `aria-activedescendant` and an accessible
name; the chip exposes its field label as its accessible name and is reachable and deletable by
keyboard, matching the existing editor's WCAG 2.1 AA bar (Constitution III).

## 4. Subject-line field insertion (plain text)

**Decision**: The subject stays a plain Astryx `TextInput`. Add an adjacent "Insert field"
menu (Astryx MoreMenu / Selector styled as a small trigger) that inserts the raw `{{token}}` at
the current caret position. No chips in the subject.

**Rationale**: The subject is not a rich-text surface, and the merge engine already handles raw
tokens in the subject. A lightweight insert affordance meets FR-011 without turning the subject
into an editor.

**Alternatives**: A full mini-editor for the subject (rejected: overkill, inconsistent with a
one-line field). Supporting "/" inside the plain input (rejected: "/" is common in real subject
text, and a plain input has no suggestion machinery).

## 5. Sender profile storage

**Decision**: One `sender_profile` row per user (1:1 with `user`), created lazily on first save.
Fields: display name, title, pitch, skills (single text field, free-form, typically a short
comma-separated list), link (URL), location, work preference (enum: `remote` | `hybrid` |
`onsite` | `open`). The display name is authoritative for both `{{my_name}}` and the in-app
greeting, falling back to `user.name` (the Google account name) when empty (spec FR-001).

**Rationale**: A single-row table is the simplest fit (YAGNI) and matches the existing
per-user ownership pattern. Skills as free text (rendered as-is) avoids a premature tag system
(spec Assumptions). Making the profile name authoritative gives one coherent identity (clarified
FR-001).

**Alternatives**: Columns on the `user` table (rejected: `user` is an Auth.js canonical table;
feature fields belong in a feature table). A structured skills relation (rejected: out of scope).

## 6. Contact soft-delete, undo, and the commit boundary

**Decision**: Add `deleted_at` (nullable timestamp) and `deleted_batch` (nullable text) to
`recruiter_contact`. A delete (bulk or single) sets both in one statement and returns
`{ deletedBatch, count }`. All contact reads filter `deleted_at IS NULL`. Undo clears the two
columns for that `deleted_batch`. The unique index on `(user_id, email_normalized)` becomes a
partial index `WHERE deleted_at IS NULL`, so a soft-deleted email no longer blocks re-adding.
"Commit on navigate-away" needs no server action: a committed delete is simply a soft-deleted
row that is no longer offered for undo (the client drops the undo affordance). Only the most
recent `deleted_batch` is undoable in the session (single undo slot, spec FR-023).

**Rationale**: Soft-delete is the only model that preserves the contact's id and its
`send_record` linkage through an undo (the FK is `ON DELETE SET NULL`). Batching by
`deleted_batch` lets a large "select all matching" delete be undone in one request without
shipping thousands of ids to the client.

**Edge**: If, before undo, a new live contact exists with a restored row's email, that one row
is skipped on restore (the partial unique index would otherwise be violated); the rest restore.
A background purge of long-soft-deleted rows is out of scope (future cleanup).

**Alternatives**: Hard delete + re-insert (rejected: orphans history, new id). Deferred delete
held only in client state for 5s (rejected: a refresh mid-window would lose the pending delete
ambiguously; the clarified rule is that navigate-away commits, which soft-delete models cleanly).

## 7. "Select all matching" bulk delete

**Decision**: The bulk-delete endpoint accepts either an explicit `ids` list (loaded-row
selection) or a `matchAll` mode carrying the current `query` (and any future filter) plus an
optional `excludedIds`. In `matchAll` mode the server soft-deletes every non-excluded contact
matching the query for that user, in one transaction, tagging them with a single `deleted_batch`.

**Rationale**: The list is paginated, so "select all N matching" cannot be expressed as loaded
ids alone (spec FR-020, two-step select-all). Server-side matching keeps the operation correct
regardless of how many pages were loaded, and the single `deleted_batch` keeps undo to one call.

**Alternatives**: Load every matching id into the client to delete by id (rejected: defeats
pagination and is fragile at a few thousand rows).

## 8. Test send excluded from history

**Decision**: Add `POST /api/send/test`. It renders the current draft for the first or selected
contact (or clearly labelled sample data when none is selected), sends through the same
provider seam to the job seeker's own connected address, and returns a simple result. It creates
no `send_batch` or `send_record` rows (spec FR-015). The subject is prefixed with a clear test
marker so the copy in the inbox is unmistakably a test.

**Rationale**: History means real outreach only (clarified FR-015). Reusing the provider seam
keeps sending in one place. Skipping persistence keeps history clean and avoids a "test" status
leaking into aggregates.

**Alternatives**: Record tests with a `test` flag (rejected: pollutes history and every
aggregate query would need to exclude them). A separate ephemeral store (rejected: unnecessary;
the inbox copy is the artifact).

## 9. Onboarding reorder

**Decision**: Reorder the dashboard "Get set up" steps to: (1) Add your recruiters (import),
(2) Personalize a template / set up your profile (optional), (3) Send your first email (which is
where Gmail is requested). The Gmail connection prompt moves to the point of first send
(compose already prompts when no account is connected). Profile is an optional step that never
blocks. Step completion continues to reflect true state.

**Rationale**: Showing the personalization value before the heavy Gmail consent makes the
permission feel earned (spec US5). Compose already gates on a connected account, so moving the
prompt is a copy/order change, not new sending logic.

**Alternatives**: Keep Gmail first (rejected: the problem this story exists to fix).

## 10. Starter template attachment fix

**Decision**: Rewrite the "Intro: cold outreach" starter so it references a link in the body
instead of promising an attachment (spec FR-017). Keep it within the supported merge vocabulary
and the plain-voice, no-em-dash rule.

**Rationale**: Attachments are unsupported; the current wording ships a broken promise on day
one. This is a content fix in `lib/templates/starters.ts` (system templates are seeded from
code), so it applies to new seeds; existing seeded rows are handled per the data-model note.

**Alternatives**: Remove the sentence entirely (rejected: the link-to-resume guidance is useful;
rewriting to a link keeps the intent).
