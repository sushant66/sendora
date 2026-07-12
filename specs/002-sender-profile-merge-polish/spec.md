# Feature Specification: Sender profile, personalized merge fields, and outreach management polish

**Feature Branch**: `002-sender-profile-merge-polish`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "Sender profile (skills, name, role, etc.) so email templates carry the job seeker's own details; a better UI/UX for discovering and inserting merge fields during template creation (replacing the static hint text); plus trust fixes, an onboarding reorder, and bulk contact management (multi-select, bulk delete with a 5 second undo)."

## Clarifications

### Session 2026-07-12 (product decisions, confirmed)

- Q: What does the sender profile hold? → A: Standard set: display name (prefilled from
  Google sign-in, editable), current or target job title, a one-line pitch/positioning
  statement, key skills, one primary link (portfolio, LinkedIn, or resume URL), location,
  and work preference (remote / hybrid / onsite / open).
- Q: Does the profile block sending the way connecting Gmail does? → A: No. Optional but
  prompted: it appears in onboarding but never blocks a send; templates using empty sender
  fields warn the same way empty recipient fields do.
- Q: How does a job seeker insert merge fields while writing? → A: An inline "/" slash menu
  inside the rich-text editor, searchable and keyboard-navigable, grouped into "Recipient"
  and "Your details" (sender) sections, replacing the static hint text.
- Q: How is this delivered? → A: One combined feature (this spec), covering profile, merge
  fields, the picker, trust fixes, onboarding reorder, and bulk contact management.

### Session 2026-07-12 (open decisions, resolved)

- Q: How does the profile produce an email signature? → A: No dedicated composite signature
  field in this version. A job seeker composes any sign-off from the individual sender merge
  fields (name, title, link). (FR-004)
- Q: How does a test send relate to sending history? → A: Excluded. Sending history represents
  real outreach only; a test is delivered to the job seeker's own inbox and confirmed in the
  UI, with no permanent history record. (FR-015)
- Q: How does bulk-delete undo behave? → A: Both bulk delete and single-contact delete offer
  the ~5 second undo. The deletion takes effect immediately and undo restores it; if the job
  seeker navigates away or reloads during the undo window, the deletion stands. (FR-023)

### Session 2026-07-12 (clarify pass)

- Q: Is the profile display name separate from the Google account name? → A: No. The profile
  display name is the single authoritative name, used for both the outreach `{{my_name}}` field
  and the in-app display (for example the dashboard greeting). It is prefilled from the Google
  account and editable, and falls back to the Google account name when left empty. (FR-001)
- Q: What happens if a new delete starts while a prior undo is still pending? → A: Single undo
  slot. Only the most recent deletion is undoable; starting any new delete (bulk or single)
  immediately commits the prior pending deletion. (FR-023)

- Q: What does "select all" cover on a paginated contacts list? → A: Two-step. Select-all
  selects the currently loaded rows, with an explicit "select all N matching" affordance to
  expand the selection to every contact matching the current search/filter. (FR-020)
- Q: How does an inserted merge field appear in the body editor? → A: As an atomic styled chip
  that inserts and deletes as a single unit and cannot be partially edited into a malformed
  token; it renders to the correct token at save and send. The plain-text Subject line holds
  raw `{{token}}` text. (FR-013)
- Q: How should the missing-value gate behave before a bulk send? → A: Warn and confirm. Show a
  summary that includes how the affected emails actually read (the resolved text for a
  missing-value recipient, not only a count), and require an explicit confirmation to proceed.
  The send is not hard-blocked, because a dropped value can still change a sentence's meaning
  and the job seeker must see that before sending. A smart-fallback enhancement (readable
  default text for a blank load-bearing field) is noted for planning. (FR-016)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set up a profile so emails speak for the sender (Priority: P1)

A job seeker fills in a short profile about themselves (name, current or target title, a
one-line pitch, key skills, a link, location, and work preference). From then on, templates
and composed emails can pull those details in through "your details" merge fields, so the
message describes the sender without retyping it every time.

**Why this priority**: Today templates personalize the recipient but say nothing about the
sender, so every job seeker hand-edits their own name, role, and pitch into each email. The
profile is the new value this feature exists to deliver, and every other story builds on it.

**Independent Test**: With no profile set, confirm sending still works (nothing is blocked).
Then fill in a profile, use a "your details" field in a template, preview it for a contact,
and confirm the sender's own details resolve correctly in the preview and in the delivered
email.

**Acceptance Scenarios**:

1. **Given** a signed-in job seeker with no profile, **When** they open their profile, **Then**
   the display name is prefilled from their Google account and every other field is empty and
   editable.
2. **Given** a completed profile, **When** a template that references a sender field (for
   example the sender's title) is previewed for a contact, **Then** the sender's own value is
   filled in, alongside the recipient's details.
3. **Given** a template that references a sender field the job seeker has left blank, **When**
   it is previewed, **Then** the blank sender field is handled gracefully (safe fallback or a
   clear warning) and never delivered as a literal placeholder.
4. **Given** no profile at all, **When** the job seeker sends outreach, **Then** the send is
   not blocked, and any referenced empty sender fields are warned about rather than leaking a
   literal placeholder.
5. **Given** an existing profile, **When** the job seeker edits and saves a field, **Then**
   future previews and sends use the updated value (emails already sent are unchanged).

---

### User Story 2 - Insert merge fields without memorizing them (Priority: P1)

While writing a template or composing an email, a job seeker types "/" in the body to open a
searchable menu of available merge fields, grouped into the recipient's details and their own
details, and picks one to drop it in at the cursor, instead of remembering and typing the
exact `{{token}}` by hand.

**Why this priority**: The current experience is a line of static hint text listing raw
tokens; a job seeker has to copy the exact spelling by hand, and a typo silently produces a
broken or empty field. This directly undermines the product's core promise of never leaking a
stray placeholder, and it becomes more important now that the vocabulary has grown with sender
fields.

**Independent Test**: In both the template editor and compose, type "/" in the body, confirm a
grouped, searchable, keyboard-navigable menu appears, select a field, and confirm the correct
token is inserted at the cursor and renders correctly in the preview. Confirm the subject line
also offers a way to insert fields. Confirm the menu is fully operable by keyboard.

**Acceptance Scenarios**:

1. **Given** the body editor in the template editor or compose, **When** the job seeker types
   "/", **Then** a menu opens showing available fields grouped into "Recipient" and "Your
   details", searchable by typing.
2. **Given** the open menu, **When** the job seeker selects a field (by click or keyboard),
   **Then** the corresponding merge field is inserted at the cursor and the menu closes.
3. **Given** the open menu, **When** the job seeker presses Escape, **Then** the menu closes
   and no field is inserted.
4. **Given** the subject line, **When** the job seeker wants a merge field there, **Then** a
   lightweight insertion affordance lets them add one without typing braces by hand.
5. **Given** a field was inserted by the menu, **When** the job seeker continues editing around
   it, **Then** the field stays intact and resolves correctly at preview and send time.

---

### User Story 3 - Send with confidence (Priority: P2)

Before committing to a real send, a job seeker sends a test copy of the email to their own
inbox to see exactly how it looks, and before a bulk send they see a single summary of which
recipients are missing details used by the template, instead of clicking through previews one
recipient at a time.

**Why this priority**: Sending is irreversible and tied to the job seeker's name. A test send
and an up-front "what will read oddly" summary remove the main sources of pre-send anxiety and
catch mistakes the current one-at-a-time preview hides. It depends on the merge and preview
behaviour but is not required for the profile itself, so it sits below the P1 stories.

**Independent Test**: With Gmail connected, compose an email, send a test to yourself, and
confirm it arrives fully rendered and clearly marked as a test. Select several contacts where
some are missing a company or role, and confirm a single summary states how many and which
recipients are missing each field before sending.

**Acceptance Scenarios**:

1. **Given** a composed email and a connected inbox, **When** the job seeker sends a test to
   themselves, **Then** the test arrives at their own address, fully personalized (using the
   first or selected recipient, or clearly labelled sample data when none is selected).
2. **Given** no connected inbox, **When** the job seeker tries to send a test, **Then** they
   are prompted to connect Gmail, the same as for a real send.
3. **Given** several selected recipients where some lack a value used by the template, **When**
   the job seeker reviews before sending, **Then** a single summary reports how many and which
   recipients are missing each field (recipient and sender fields alike).
4. **Given** a starter template, **When** the job seeker reads it, **Then** it does not tell the
   recruiter to expect a file attachment, because attachments are not supported in this version.

---

### User Story 4 - Manage the contact list in bulk (Priority: P2)

A job seeker selects several recruiter contacts at once and deletes them in a single action,
confirms the count first, and gets a brief window to undo if it was a mistake.

**Why this priority**: Imported lists accumulate stale, wrong, or duplicate rows, and removing
them one at a time is tedious. Bulk delete with an undo makes cleanup safe and fast. It is
independent of the profile and merge work, so it can ship on its own.

**Independent Test**: Select multiple contacts, delete them in one action, confirm the count in
the confirmation, and confirm they disappear. Within the undo window, undo and confirm all of
them return exactly as they were. Let the window lapse and confirm the deletion stands.

**Acceptance Scenarios**:

1. **Given** the contacts list, **When** the job seeker selects several rows (including a select
   all for the current view), **Then** the number selected and the available bulk actions are
   shown.
2. **Given** a multi-row selection, **When** the job seeker chooses bulk delete, **Then** a
   confirmation states how many contacts will be removed before anything happens.
3. **Given** a confirmed bulk delete, **When** it completes, **Then** the selected contacts are
   removed from the list and a brief (about 5 second) undo affordance appears.
4. **Given** the undo affordance is showing, **When** the job seeker uses it, **Then** all
   deleted contacts return with the same identity and their sending history still attributed to
   them.
5. **Given** the undo window has passed, **When** the job seeker looks again, **Then** the
   contacts are gone and the undo is no longer offered.

---

### User Story 5 - Get set up in the right order (Priority: P3)

A first-time job seeker is guided to bring in their recruiters and see a real, personalized
template before being asked to authorize Gmail sending, and is invited (but not required) to
set up their profile along the way.

**Why this priority**: Asking for Gmail send permission before any value is shown is a heavy,
scary first ask. Reordering so the job seeker experiences the personalization first makes the
permission request feel earned. It is a sequencing and copy change on top of existing steps, so
it is the lowest priority of the set.

**Independent Test**: As a brand-new account, walk the setup guidance and confirm the order
leads through importing contacts and seeing a rendered template before any Gmail authorization
prompt, that the profile appears as an optional step, and that the Gmail prompt appears at the
point of the first send.

**Acceptance Scenarios**:

1. **Given** a new account, **When** the job seeker follows the setup guidance, **Then**
   importing contacts and seeing a rendered template come before any prompt to authorize Gmail.
2. **Given** the setup guidance, **When** the job seeker reviews the steps, **Then** setting up
   a profile is offered as an optional step and never blocks progress.
3. **Given** the job seeker reaches their first real send without a connected inbox, **When**
   they send, **Then** they are prompted to connect Gmail at that moment.
4. **Given** each setup step, **When** a step is complete, **Then** the guidance reflects its
   true state and does not mark undone steps as done.

---

### Edge Cases

- A profile field is left blank and referenced by a template. The empty value is dropped with a
  warning surfaced in preview, never delivered as a literal placeholder (same rule as recipient
  fields).
- A job seeker types a malformed token by hand (for example a misspelled field) rather than
  using the picker. Save-time validation warns which tokens are unsupported before the template
  can be used, and rendering never emits a literal `{{token}}`.
- The "/" character is typed as ordinary content (for example a URL path or "24/7"). The slash
  menu must not trap the job seeker: it can be dismissed with Escape and continuing to type
  ordinary text is not swallowed by the menu.
- A test send is attempted with no connected inbox. The job seeker is prompted to connect Gmail,
  the same as a real send, rather than failing silently.
- A bulk delete is followed by the job seeker navigating away or reloading during the undo
  window. The deletion commits (stands); the undo is only available in-session within the ~5
  second window (FR-023).
- A job seeker starts a second delete while the first is still undoable. The first deletion
  commits immediately; only the newest delete is undoable (FR-023).
- A contact removed by bulk delete had sending history. Its history remains readable and
  correctly attributed whether or not the contact is later restored (history keeps its own
  recipient snapshot).
- The same contact is selected and bulk-deleted while a send to it is in flight or already
  recorded. History is unaffected; only the contact record is removed.
- A skills value or pitch is very long. It renders and is stored within a sane length bound so a
  single field cannot bloat an email or the profile form.

## Requirements *(mandatory)*

### Functional Requirements

**Sender profile**

- **FR-001**: The system MUST let a job seeker create and edit a personal profile at any time
  after signing in, containing: display name (prefilled from their Google account, editable),
  current or target job title, a one-line pitch, key skills, one primary link (portfolio,
  LinkedIn, or resume URL), location, and work preference. The display name is the single
  authoritative name: it feeds both the outreach `{{my_name}}` field and the in-app display
  (for example the dashboard greeting), and falls back to the Google account name when empty.
- **FR-002**: The profile MUST be optional. A missing or partially filled profile MUST NOT
  block any send. The profile is surfaced during onboarding but never gates sending.
- **FR-003**: The system MUST expose the profile's values as a closed, validated set of sender
  merge fields, namespaced so they never collide with the existing recipient fields
  (`first_name`, `last_name`, `full_name`, `company`, `role`).
- **FR-004**: The system MUST NOT introduce a separate composite signature field in this
  version. A job seeker composes any sign-off from the individual sender merge fields (FR-003),
  and the starter templates and picker SHOULD make the relevant sender fields (name, title,
  link) easy to place for a sign-off.
- **FR-005**: The system MUST validate the primary link as a well-formed URL and MUST constrain
  work preference to a defined set of values (remote / hybrid / onsite / open), reporting a
  clear reason when either is invalid.
- **FR-006**: A job seeker MUST only be able to view and edit their own profile.

**Merge fields (recipient and sender)**

- **FR-007**: The merge-field vocabulary MUST remain a closed set across both namespaces, and
  the system MUST warn the job seeker at template save time when a template references an
  unsupported or malformed field, before the template can be used to send.
- **FR-008**: When rendering, the system MUST resolve every field and MUST NOT deliver a literal
  `{{token}}`. Empty optional values (recipient or sender) MUST be dropped and surfaced as a
  warning in the preview.
- **FR-009**: A sender field referenced by a template but left blank in the profile MUST be
  handled exactly like an empty recipient field: warned in preview, never delivered literally.

**Merge-field picker**

- **FR-010**: In the rich-text body editor, used in both the template editor and compose, typing
  "/" MUST open a searchable menu of available merge fields, grouped into "Recipient" and "Your
  details" (sender) sections; selecting an item (by pointer or keyboard) MUST insert the
  corresponding field at the cursor, and Escape MUST dismiss the menu without inserting.
- **FR-011**: The subject line MUST offer a lightweight way to insert merge fields without the
  job seeker typing braces by hand.
- **FR-012**: The system MUST replace the current static merge-field hint text with the picker
  as the primary way to discover and insert fields.
- **FR-013**: The merge-field picker MUST meet the same accessibility bar as the existing editor
  (keyboard operable, labelled, focus managed). In the rich-text body, an inserted field MUST be
  an atomic chip that inserts and deletes as a single unit and cannot be partially edited into a
  malformed token; it MUST render to the correct token at preview and send time. In the
  plain-text subject line, an inserted field is raw `{{token}}` text.

**Compose confidence and trust**

- **FR-014**: The system MUST let a job seeker send a test copy of the currently composed email
  to their own connected inbox, personalized for the first or selected recipient, or with
  clearly labelled sample data when no recipient is selected. The test MUST be clearly
  identifiable as a test to the job seeker, and MUST require a connected inbox just like a real
  send.
- **FR-015**: A test send MUST NOT be recorded in the job seeker's sending history. Sending
  history represents real outreach only. The test is delivered to the job seeker's own inbox
  and confirmed in the UI, with no permanent history record.
- **FR-016**: Before a bulk send, the system MUST present a single summary of how many and which
  recipients are missing values used by the selected template or body (recipient and sender
  fields alike), so the job seeker does not have to inspect each recipient's preview one at a
  time. The summary MUST show how the affected emails actually read (the resolved text for a
  representative missing-value recipient), not only a count, and the job seeker MUST explicitly
  confirm before the send proceeds. The send MUST NOT be hard-blocked on missing values.
- **FR-017**: Starter (system) templates MUST NOT instruct the recruiter to expect a file
  attachment, because attachments are not supported in this version; any such wording MUST be
  rewritten to reference a link instead.

**Onboarding**

- **FR-018**: The first-run setup guidance MUST order steps so that importing contacts and
  seeing a rendered, personalized template come before any prompt to authorize Gmail sending,
  and the Gmail authorization MUST be requested at the point of the first send.
- **FR-019**: Setting up a profile MUST appear as an optional, prompted step in the setup
  guidance, and the guidance MUST reflect the true completion state of each step.

**Bulk contact management**

- **FR-020**: The system MUST let a job seeker select multiple contacts at once. Select-all
  MUST select the currently loaded rows, and MUST offer an explicit affordance to expand the
  selection to all contacts matching the current search/filter (a "select all N matching"
  action). The system MUST show how many contacts are selected and which bulk actions are
  available.
- **FR-021**: The system MUST let a job seeker delete the selected contacts in one action, gated
  by a confirmation that states how many contacts will be removed.
- **FR-022**: After a bulk delete, the system MUST offer a brief (about 5 second) undo that
  restores all deleted contacts with the same identity and their sending history still
  attributed to them.
- **FR-023**: Both bulk delete and single-contact delete MUST offer the ~5 second undo. The
  deletion MUST take effect immediately (the contacts are removed from the list) and undo MUST
  restore them with identity and history linkage intact (FR-022). If the job seeker navigates
  away or reloads during the undo window, the deletion MUST stand (commit). Only the most recent
  deletion is undoable at a time: starting any new delete (bulk or single) MUST commit any prior
  pending deletion immediately.

**Access and data ownership**

- **FR-024**: A job seeker MUST only be able to view and act on their own profile, contacts,
  templates, and sending history (unchanged from the existing product, restated for the new
  profile entity).

### Key Entities *(include if data involved)*

- **Sender Profile**: The job seeker's own details used to personalize outreach. Attributes:
  display name, current or target title, one-line pitch, key skills, one primary link, location,
  work preference. Belongs to exactly one job seeker; optional; editable at any time.
- **Merge Field Vocabulary**: The closed set of supported fields in two namespaces, recipient
  (from a contact) and sender (from the profile), each field either always-present or optional
  with defined empty handling.
- **Recruiter Contact**: Unchanged, except that a contact can now be removed by a bulk delete
  and (per FR-022) restored within the undo window without losing its identity or history
  linkage.
- **Test Send**: A one-off email the job seeker sends to their own inbox to preview a real send.
  It is delivered and confirmed in the UI but never recorded in sending history (FR-015).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A job seeker can complete a usable profile (enough to personalize a template) in
  under 2 minutes.
- **SC-002**: 0% of delivered emails contain an unresolved literal placeholder, whether the
  field is a recipient field or a sender field (extends the existing zero-placeholder
  guarantee).
- **SC-003**: A job seeker can insert any supported merge field without typing braces by hand,
  and 0 malformed or unsupported tokens reach a saved template.
- **SC-004**: Before their first real send, a job seeker can send a test to their own inbox and
  it arrives fully rendered, in 100% of cases where an inbox is connected.
- **SC-005**: Before a bulk send, a job seeker can see how many recipients are missing each used
  field without opening any individual recipient preview.
- **SC-006**: A bulk delete of N contacts can be undone within the undo window in 100% of cases,
  restoring all N contacts with identity and history linkage intact.
- **SC-007**: In first-run setup, a job seeker sees a rendered, personalized template before any
  Gmail authorization prompt is shown, in 100% of new-account walkthroughs.
- **SC-008**: A first-time job seeker can go from an empty account to a first outreach email that
  includes their own details (via the profile) in under the existing 5 minute first-send target
  (excludes the one-time external Google consent step).

## Assumptions

- **Sender token names** follow a `my_*` namespace (for example a name field, a title field, a
  pitch field, a skills field, a link field, a location field, and a work-preference field). The
  exact spellings are an implementation detail settled in planning; only the namespace and the
  closed-set rule are fixed here.
- **Skills** are entered as free text (for example a short comma-separated list) and rendered
  as-is; a structured skills tag system is out of scope.
- **Missing-value gate is warn-and-confirm**, not blocking (FR-016): the job seeker may proceed
  after seeing how the affected emails read and explicitly confirming (subject to the existing
  50-recipient cap). A **smart-fallback** enhancement (a readable default for a blank
  load-bearing field, or author-defined fallback text) is a planning-time option on top of the
  gate, not a requirement of this feature.
- **Inserted tokens' visual treatment** is resolved (FR-013): atomic chips in the rich-text
  body, raw `{{token}}` text in the subject. The exact chip visual styling remains for
  `/impeccable` during design.
- **Test-send labelling**: a test copy is distinguishable to the job seeker (for example a clear
  marker in the subject) and is never recorded in sending history (FR-015).
- **Sending history keeps its own recipient snapshot**, so deleting (or restoring) a contact
  does not alter previously recorded sends.
- The existing stack and boundaries are unchanged: a single web application, the same data
  store, the provider-agnostic sending seam (Gmail only), input validation at every trust
  boundary, and test-first delivery, all per the constitution.

### Out of Scope (this feature)

- Follow-up sequences, scheduled or "send later" sending, and multi-step cadences.
- Reply, open, or click tracking of any kind.
- Additional email providers (for example Outlook); Gmail remains the only provider.
- File attachments (job seekers still include links in the body).
- A full contact status or pipeline system (stages such as contacted / replied / interviewing),
  bulk tagging, and saved segments.
- Rich conditional logic in templates beyond simple field substitution.
