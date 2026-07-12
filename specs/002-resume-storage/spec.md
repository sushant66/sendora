# Feature Specification: Resume Storage

**Feature Branch**: `002-resume-storage`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "Upload multiple PDFs, each with a label (\"Backend Engineer,\" \"Full Stack,\" \"DevOps\"). That's it — upload, label, store, pick from list. No builder, no editor, no AI tailoring. As a standalone utility, laid as groundwork for a future feature that attaches a chosen resume when sending outreach emails."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a labeled resume (Priority: P1)

A job seeker has several resume variants (e.g. tailored for "Backend Engineer," "Full Stack," "DevOps" roles) as separate PDF files. They upload one, give it a short label, and it's saved for later use.

**Why this priority**: Without the ability to save a labeled resume, nothing else in this feature has any value. This is the minimum useful action.

**Independent Test**: Can be fully tested by uploading a PDF with a label and confirming it appears saved — delivers value on its own even before any other capability exists.

**Acceptance Scenarios**:

1. **Given** a user has a PDF resume file and no saved resumes yet, **When** they upload it with the label "Backend Engineer," **Then** the resume is saved under that label.
2. **Given** a user already has an active resume labeled "Backend Engineer," **When** they try to upload another resume with the same label, **Then** the upload is rejected with a clear message that the label is already in use.
3. **Given** a user attempts to upload a file that is not a valid PDF (regardless of its file name), **When** they submit it, **Then** the upload is rejected with a clear error and nothing is saved.
4. **Given** a user attempts to upload a file larger than the allowed size limit, **When** they submit it, **Then** the upload is rejected with a clear error.
5. **Given** a user attempts to upload without providing a label, **When** they submit it, **Then** the upload is rejected and they're asked to provide a label.

---

### User Story 2 - Browse and open saved resumes (Priority: P1)

A job seeker returns to the app later and wants to see all the resumes they've saved, and open one to confirm it's the right file before using it elsewhere.

**Why this priority**: "Pick from a list" is the other half of the core value — saving a resume is useless if it can't be found and confirmed later. Together with User Story 1, this is the full MVP.

**Independent Test**: Can be fully tested by saving a couple of resumes (via User Story 1) and then listing and opening them — delivers the complete "store and retrieve" value on its own.

**Acceptance Scenarios**:

1. **Given** a user has saved several resumes under different labels, **When** they view their resume list, **Then** they see every currently active resume with its label, original file name, and when it was saved.
2. **Given** a user sees a resume in their list, **When** they choose to open it, **Then** they can view/download the exact PDF they uploaded.
3. **Given** a user has saved no resumes yet, **When** they view their resume list, **Then** they see a clear empty state rather than an error.

---

### User Story 3 - Remove a resume no longer needed (Priority: P2)

A job seeker no longer needs a saved resume variant (e.g. they're no longer pursuing that role) and wants it out of their list.

**Why this priority**: Cleanup is valuable but the library is still useful without it — a user can ignore a stale resume. This refines the experience rather than enabling it.

**Independent Test**: Can be fully tested by saving a resume and then removing it, confirming it no longer appears in the list — independently valuable as a cleanup action.

**Acceptance Scenarios**:

1. **Given** a user has an active resume labeled "DevOps," **When** they delete it, **Then** it no longer appears in their resume list, and their other saved resumes are unaffected.
2. **Given** a user has already removed a resume, **When** they try to remove it again, **Then** they see a clear error (there is nothing active left to remove).

---

### User Story 4 - Replace a resume without losing the old one (Priority: P3)

A job seeker updates their "Backend Engineer" resume and uses Replace to upload a new file for it — but wants the option to bring back the previous version if the new one turns out worse, rather than it being gone for good.

**Why this priority**: This protects against an accidental or regretted replacement. It's a safety net on top of the core save/browse/remove experience, valuable but not required for the feature to be useful.

**Independent Test**: Can be fully tested by saving a resume under a label, using Replace to upload a new file for it, and then restoring the earlier one — independently demonstrates the version-safety value.

**Acceptance Scenarios**:

1. **Given** a user has an active resume labeled "Backend Engineer," **When** they use Replace to upload a new file for that resume, **Then** the previous resume is kept as retrievable history rather than deleted, and the new one becomes the active resume for that label.
2. **Given** a user has a labeled resume with prior versions in its history, **When** they view that history, **Then** they can see and open each past version.
3. **Given** a user is looking at a past version of a labeled resume, **When** they restore it, **Then** it becomes the active resume for that label again, and the version it replaced becomes part of the history instead.

**Note**: Replace is a distinct action from uploading a new resume (US1) — the plain upload
flow always rejects a duplicate active label (FR-005); Replace is how an existing label's
active resume is updated in place. This distinction was clarified after initial
implementation revealed FR-005 and FR-010 described contradictory behavior for the same
trigger ("uploading under an existing label") — see FR-016.

---

### Edge Cases

- What happens when a file is renamed to end in `.pdf` but its contents are not actually a PDF? It is rejected — validity is checked by content, not by file name.
- What happens when a user tries to restore a version that is already the active one for its label? Treated as already satisfied — no change occurs.
- What happens when a user has reached the maximum number of active saved resumes but also has archived history? The limit counts active resumes only; archived history never blocks a new upload.
- What happens if a user tries to open or remove a resume that belongs to another user (e.g. by guessing an identifier)? Treated as if it doesn't exist.
- What happens when two upload requests for the same new label are submitted at nearly the same time? Exactly one succeeds; the other is rejected as a duplicate label.
- What happens if a user replaces a resume that reaches the active-resume limit? It never does — replacing archives one resume and creates one, so the active count never changes; the limit (FR-006) only applies to uploads that would increase it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to upload a PDF file together with a text label in a single action.
- **FR-002**: System MUST reject any upload whose content is not a valid PDF, regardless of the file's name or declared type.
- **FR-003**: System MUST reject any upload larger than 10 MB.
- **FR-004**: System MUST require a non-empty label for every uploaded resume.
- **FR-005**: System MUST prevent a user from having two active resumes under the same label at the same time, rejecting the newer upload attempt with a clear, specific error.
- **FR-006**: System MUST limit each user to 20 active saved resumes at a time, rejecting further uploads past that limit with a clear error until the user removes one.
- **FR-007**: Users MUST be able to view a list of all their own active saved resumes, showing at minimum each one's label, original file name, and save date.
- **FR-008**: Users MUST be able to open or download any of their own saved resumes (active or archived) to confirm its exact contents.
- **FR-009**: Users MUST be able to remove an active saved resume; removing one MUST NOT affect any other saved resume.
- **FR-010**: When a user uses Replace (FR-016) to upload a new file for a label's active resume, the system MUST retain the previous resume as history rather than discarding it.
- **FR-011**: Users MUST be able to view the history of past resumes saved under a given label, in the order they were saved.
- **FR-012**: Users MUST be able to restore a past version of a label's resume, making it the active one again.
- **FR-013**: Restoring a past version MUST retire whatever resume was previously active for that label, so that exactly one resume per label is ever active at a time.
- **FR-014**: A user's saved resumes, including their history, MUST be private — no other user can view, list, open, or remove them.
- **FR-015**: System MUST NOT modify, merge, edit, or otherwise alter an uploaded PDF's content in any way.
- **FR-016**: Replace MUST be a distinct, explicit action from uploading a new resume (FR-001), reached from an existing active resume, not an implicit side effect of typing a matching label into the plain upload flow. The plain upload flow's FR-005 rejection behavior is unaffected by Replace's existence.

### Key Entities

- **Resume**: A single uploaded PDF document owned by one user. Has a label, an original file name, a save date, and a status of either active or archived. Represents one version within its label's history.
- **Label**: The user-chosen name identifying a resume variant (e.g. "Backend Engineer"). At most one resume per label is active for a given user at any time; earlier resumes saved under that label become archived history when replaced.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can upload and label a new resume in under 30 seconds.
- **SC-002**: A user can locate and open a specific saved resume from a list of up to 20 in under 10 seconds.
- **SC-003**: 100% of invalid uploads (wrong file type or over the size limit) are rejected with an understandable error, with nothing saved.
- **SC-004**: A user who replaces a labeled resume can retrieve the exact previous version's content with no data loss or corruption.
- **SC-005**: Zero instances of one user accessing, listing, or removing another user's saved resumes.

## Assumptions

- Users are already signed in (via the app's existing authentication) before accessing this feature; this spec does not introduce a new identity system.
- Resumes are personal, single-user working documents — there is no shared or organization-wide resume library concept.
- Labels are freely typed by the user; there is no predefined or curated list of role categories to choose from.
- Retaining archived resume versions indefinitely is acceptable for this feature; a data-retention or permanent-purge policy is out of scope unless it later becomes an operational concern.
- This feature does not connect to sending outreach emails — choosing a resume to attach to an email is a separate, future feature. This feature only needs to make that future connection straightforward, not build it.
