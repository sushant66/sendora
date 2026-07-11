# Feature Specification: Recruiter Outreach

**Feature Branch**: `001-recruiter-outreach`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "Job seekers bring in recruiter contacts and upload them to the platform, select relevant email templates and create their own templates, then use templates to send emails to recruiters — either in bulk or by selecting a single recruiter and sending one email. Resume features are deferred."

## Clarifications

### Session 2026-07-11

- Q: Which connected email providers are in scope for this version? → A: Gmail only for
  v1, but the provider integration MUST be built behind an extensible seam so that
  adding further providers later is low-effort, and a job seeker can connect an
  additional provider at any time after login (not only during initial signup).
- Q: What content format do email bodies/templates use? → A: Rich text with basic
  formatting (bold, italic, lists, links); not full HTML/designed emails.
- Q: Which contact import methods are supported? → A: CSV upload, Excel (.xlsx) upload,
  and pasted rows (copy/paste from a spreadsheet).
- Q: Can outreach emails include file attachments? → A: No attachments in this version;
  job seekers can include links (e.g. to a resume or portfolio) in the email body.
  Attachments will arrive with the deferred resume feature.
- Decision (from /speckit-analyze remediation): A single bulk send is capped at 50
  recipients in this version; over-cap selections are prevented with guidance to split,
  and larger batches are deferred to a future background-processing design. Auth (Google
  sign-in) is confirmed in-scope as foundational scaffolding rather than an external
  dependency.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import recruiter contacts (Priority: P1)

A job seeker brings a set of recruiter contacts (name, email, and optional details
like company and role) into the platform, either by uploading a file or adding them
one at a time, and sees them organized in a contact list they can search and manage.

**Why this priority**: Contacts are the foundation of every other capability — no
outreach is possible without recipients. On its own it delivers value as an organized,
deduplicated place to keep track of recruiter contacts during a job search.

**Independent Test**: Upload a file of recruiter contacts (and add one manually),
then confirm the contacts appear in the list with correct details, duplicates are
flagged, and invalid rows are reported rather than silently dropped.

**Acceptance Scenarios**:

1. **Given** a file containing recruiter rows with name and email, **When** the job
   seeker uploads it, **Then** each valid row becomes a contact in their list and a
   summary reports how many were imported, skipped, or flagged as duplicates.
2. **Given** a file row missing a valid email address, **When** the file is imported,
   **Then** that row is reported as invalid with its reason and no partial contact is
   created for it.
3. **Given** an existing contact with the same email, **When** a matching row is
   imported, **Then** the system flags it as a duplicate and does not create a second
   contact for the same email.
4. **Given** an empty contact list, **When** the job seeker adds a contact manually
   with name and email, **Then** the contact appears in the list immediately.

---

### User Story 2 - Send a single templated email to one recruiter (Priority: P1)

A job seeker selects one recruiter from their contacts, chooses a relevant email
template from a provided starter library, sees it personalized with that recruiter's
details, reviews and edits it, and sends the email.

**Why this priority**: This is the core "aha" — turning a contact plus a template into
a real, personalized outreach email. Together with Story 1 it forms the minimum viable
product: import a recruiter, pick a template, send.

**Independent Test**: With at least one contact present, select a starter template,
verify merge fields resolve to the recruiter's details, edit the text, send, and
confirm the send is recorded as sent (or a clear failure reason is shown).

**Acceptance Scenarios**:

1. **Given** a contact and a starter template with merge fields (e.g. recipient name,
   company), **When** the job seeker selects both, **Then** a preview shows the
   template with the recruiter's details filled in.
2. **Given** a previewed email, **When** the job seeker edits the subject or body and
   sends, **Then** the email is delivered to that recruiter's address and recorded in
   their sending history as sent.
3. **Given** a template with a merge field for which the recruiter has no value,
   **When** the email is previewed, **Then** the missing field is handled gracefully
   (a safe fallback or a clear warning) rather than sending a literal placeholder.
4. **Given** a send that fails at the delivery step, **When** the job seeker sends,
   **Then** they see a clear failure reason and the attempt is recorded as failed.

---

### User Story 3 - Create and manage custom templates (Priority: P2)

A job seeker creates their own email template with a subject, body, and merge fields,
saves it to their template library, edits it later, and reuses it when sending.

**Why this priority**: Personal templates let job seekers develop their own voice and
reuse it. It materially improves the product but the starter library from Story 2
already makes sending possible, so it ranks below the core send flow.

**Independent Test**: Create a template with merge fields, save it, reopen and edit it,
then confirm it is selectable in the send flow and its merge fields resolve correctly.

**Acceptance Scenarios**:

1. **Given** the template library, **When** the job seeker creates a template with a
   subject, body, and supported merge fields and saves it, **Then** it appears in
   their template library.
2. **Given** an unsupported or malformed merge field in a template, **When** the job
   seeker saves, **Then** the system warns them which fields are unsupported before
   the template can be used for sending.
3. **Given** a saved custom template, **When** the job seeker edits and saves it,
   **Then** the updated version is used for future sends (past sent emails are
   unchanged).

---

### User Story 4 - Bulk send to multiple recruiters (Priority: P2)

A job seeker selects multiple recruiters, chooses a template, reviews per-recipient
personalized previews, and sends an individually personalized email to each recruiter
in one action, then sees a per-recipient result summary.

**Why this priority**: Bulk sending is the efficiency multiplier that makes the
platform worth using at scale, but it depends on the single-send flow (Story 2) being
correct first, so it follows as P2.

**Independent Test**: Select several contacts and a template, confirm each recipient
gets an individually personalized email (not a shared one), send, and verify the
summary reports success/failure per recipient.

**Acceptance Scenarios**:

1. **Given** multiple selected recruiters and a template, **When** the job seeker
   requests previews, **Then** each recipient's email is personalized to their own
   details independently.
2. **Given** a confirmed bulk send, **When** it runs, **Then** each recruiter receives
   a separate email addressed only to them (recipients are not exposed to one another).
3. **Given** a bulk send where some deliveries fail, **When** it completes, **Then**
   the summary reports which recipients succeeded and which failed with reasons, and
   the successful sends are still recorded.
4. **Given** a recruiter appears more than once in the selection, **When** the bulk
   send runs, **Then** that recruiter receives only one email.

---

### User Story 5 - Review sending history (Priority: P3)

A job seeker views a history of the emails they have sent — to whom, which template,
when, and the delivery outcome — so they can track their outreach and avoid contacting
the same recruiter twice by accident.

**Why this priority**: History adds confidence and prevents mistakes, but outreach can
function without it, so it is the lowest priority of the core set.

**Independent Test**: After sending single and bulk emails, open the history and
confirm each send is listed with recipient, template, timestamp, and outcome.

**Acceptance Scenarios**:

1. **Given** previously sent emails, **When** the job seeker opens their history,
   **Then** each send is listed with recipient, subject/template, timestamp, and
   outcome (sent or failed).
2. **Given** a recruiter already emailed recently, **When** the job seeker starts a new
   send to that same recruiter, **Then** they are alerted that this recruiter was
   contacted before.

---

### Edge Cases

- An uploaded file is empty, in an unrecognized format, or exceeds the supported size —
  the job seeker is told why it cannot be imported and no partial import occurs. File
  size/format are checked before parsing; the server re-validates the resulting rows as
  the authoritative boundary.
- A file contains some valid and some invalid rows — valid rows import and invalid rows
  are reported; the import is never all-or-nothing without informing the user.
- A recruiter's email address is malformed or later bounces — sends to it are flagged
  rather than silently succeeding.
- A template references a merge field the recruiter has no value for — handled with a
  safe fallback or warning, never a literal `{{placeholder}}` in the delivered email.
- The job seeker attempts a bulk send larger than the per-action limit (50 recipients in
  this version) — the system prevents the send and asks the job seeker to reduce or split
  the selection, rather than partially processing it. Within the limit, every selected
  recipient is processed and reported without loss.
- A send is interrupted midway through a bulk batch — already-sent emails are not
  re-sent, and unsent recipients are clearly identified.
- The same recruiter appears multiple times in a contact list or a bulk selection —
  deduplicated so they are not emailed twice in one action.

## Requirements *(mandatory)*

### Functional Requirements

**Contacts**

- **FR-001**: The system MUST allow a job seeker to import recruiter contacts by
  uploading a CSV file, uploading an Excel (.xlsx) file, or pasting rows copied from a
  spreadsheet, creating one contact per valid row. All three import methods MUST apply
  the same validation, duplicate detection, and import-summary reporting.
- **FR-002**: The system MUST allow a job seeker to add, edit, and delete recruiter
  contacts individually.
- **FR-003**: A recruiter contact MUST support at minimum a name and an email address,
  and optional company and role details.
- **FR-004**: The system MUST validate email addresses on import and manual entry, and
  reject entries without a valid email while reporting the reason.
- **FR-005**: The system MUST detect duplicate contacts by email address and prevent
  creating multiple contacts with the same email for one job seeker.
- **FR-006**: On import, the system MUST report a summary of rows imported, skipped
  (with reasons), and flagged as duplicates.
- **FR-007**: The system MUST let a job seeker view, search, and select from their list
  of recruiter contacts.

**Templates**

- **FR-008**: The system MUST provide a starter library of relevant email templates the
  job seeker can select and use.
- **FR-009**: The system MUST allow a job seeker to create, edit, and delete their own
  email templates with a subject and body.
- **FR-009a**: Email bodies and templates MUST support rich text with basic formatting
  — at minimum bold, italic, ordered/unordered lists, and links. Full HTML layout/
  designed emails (images, multi-column layout, buttons) are out of scope for this
  version.
- **FR-010**: Templates MUST support merge fields that personalize the email using a
  recruiter's details (at minimum recipient name; company and role where available).
- **FR-011**: The system MUST warn the job seeker when a template contains unsupported
  or malformed merge fields before the template can be used to send.
- **FR-012**: When rendering a template for a recruiter, the system MUST resolve merge
  fields from that recruiter's details and handle missing values gracefully (safe
  fallback or warning), never delivering a literal placeholder.

**Sending**

- **FR-013**: The system MUST let a job seeker select a single recruiter and a
  template, preview the personalized email, edit it, and send it.
- **FR-014**: The system MUST let a job seeker select multiple recruiters and a
  template and send an individually personalized email to each in one action. In this
  version a single bulk action is limited to 50 recipients; larger batches are deferred
  to a future version.
- **FR-014a**: The system MUST prevent a bulk send that exceeds the per-action recipient
  limit, informing the job seeker to reduce or split the selection rather than partially
  processing it.
- **FR-015**: In a bulk send, each recruiter MUST receive a separate email addressed
  only to them; recipients MUST NOT be exposed to one another.
- **FR-016**: The system MUST deduplicate recipients within a single send so a
  recruiter is not emailed more than once by one action.
- **FR-017**: The system MUST record the outcome of every send attempt (sent or failed,
  with reason) per recipient.
- **FR-018**: For a bulk send with partial failures, the system MUST report per-
  recipient results and MUST NOT roll back or hide the successful sends.
- **FR-019**: The system MUST send outreach emails through the job seeker's own
  connected email account, so that emails are sent from the job seeker's real address
  and recruiter replies return directly to the job seeker's inbox. For this version the
  only supported provider is Gmail.
- **FR-019a**: The system MUST allow a job seeker to connect their email account and
  MUST require a connected account before any send can occur; if no account is
  connected, the system MUST prompt the job seeker to connect one rather than failing
  silently. A job seeker MUST be able to connect their account at any time after login,
  not only during initial signup.
- **FR-019b**: The system MUST handle the case where the connected account's send
  capacity is exhausted or the connection has expired/been revoked, surfacing a clear
  reason and recording affected sends as failed rather than silently dropping them.
- **FR-019c**: The email-provider integration MUST be designed behind a provider-
  agnostic seam so that support for additional email providers can be added in a future
  version with low effort and without reworking the contacts, template, or sending
  flows. (Only Gmail is delivered in this version.)

**History**

- **FR-020**: The system MUST maintain a per-job-seeker history of sent emails,
  including recipient, template/subject, timestamp, and outcome.
- **FR-021**: The system MUST alert a job seeker when they begin a send to a recruiter
  they have already contacted.

**Access & data ownership**

- **FR-022**: A job seeker MUST only be able to view and act on their own contacts,
  templates, and sending history.

### Key Entities *(include if feature involves data)*

- **Job Seeker**: The authenticated user of the platform (via Google sign-in) who owns
  contacts, templates, connected email accounts, and sending history.
- **Connected Email Account**: A job seeker's authorization to send from an external
  email provider (Gmail in this version) — sender address, granted scopes, and
  connection status (active / expired / revoked). Belongs to one job seeker; the model
  admits additional providers in future (FR-019c).
- **Recruiter Contact**: A person the job seeker intends to reach. Key attributes:
  name, email address, optional company, optional role. Belongs to one job seeker.
- **Email Template**: A reusable email definition with a subject, body, and merge
  fields. Either a platform-provided starter template or a job-seeker-created template.
- **Outreach Email / Send Record**: A single email sent (or attempted) to one recruiter
  using a template, capturing the resolved content, recipient, timestamp, and outcome.
- **Send Batch**: A group of send records produced by one bulk-send action, used to
  report aggregate and per-recipient results.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A job seeker can import a file of recruiter contacts and see the results
  (imported / skipped / duplicates) in under 1 minute for a typical list of 100
  contacts.
- **SC-002**: With Gmail already connected, a first-time job seeker can go from an empty
  account to sending their first personalized outreach email in under 5 minutes
  (excludes the one-time external Google OAuth consent step, which is outside the app's
  control).
- **SC-003**: 95% of imported rows that contain a valid name and email are successfully
  turned into usable contacts without manual correction.
- **SC-004**: Every delivered email is correctly personalized — 0% of delivered emails
  contain an unresolved literal placeholder.
- **SC-005**: A job seeker can select and send to 50 recruiters in a single bulk action
  and receive a per-recipient result summary.
- **SC-006**: 100% of send attempts (single or bulk) appear in the job seeker's history
  with an accurate outcome.
- **SC-007**: A job seeker is warned before re-contacting a recruiter in at least 95% of
  cases where that recruiter was previously emailed.

## Assumptions

- Authentication is provided by Google sign-in and delivered in this feature as
  foundational scaffolding (Gmail sending requires Google OAuth regardless); an expanded
  account system — additional login methods, profile management — is out of scope for
  this version. All flows assume an authenticated job seeker.
- Contact import is via CSV upload, Excel (.xlsx) upload, pasted spreadsheet rows,
  and/or manual entry; direct API integrations with external services (e.g. LinkedIn)
  are out of scope for this version.
- Resume-related features are explicitly deferred and out of scope for this feature.
- Outreach emails cannot carry file attachments in this version; job seekers may
  include links (e.g. to a resume or portfolio) in the email body. File attachments
  are deferred and expected to arrive with the resume feature.
- Email personalization uses a small, defined set of merge fields based on recruiter
  contact attributes (name, company, role); rich conditional logic is out of scope for
  this version.
- Emails are sent on demand when the job seeker triggers a send; scheduled sending,
  multi-step sequences/follow-ups, and open/click tracking are out of scope for this
  version.
- Outreach is sent from the job seeker's own connected email account (Gmail/Outlook);
  a connected account is a prerequisite for sending, and the job seeker's sends are
  therefore subject to their email provider's own daily/rate limits.
- Advanced deliverability and anti-spam controls (sending-rate throttling, warmup,
  bounce/complaint automation) are out of scope for this version, consistent with the
  constitution's deferred-principles note; basic per-recipient success/failure
  reporting is in scope.
- "Bulk send" means each recipient receives an individual, separately addressed email —
  never a single email with many recipients disclosed to one another.
