# Feature Specification: Resume Attachments

**Feature Branch**: `003-resume-attachments`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "Let a job seeker pick one of their saved resumes (from 002-resume-storage) to attach as a PDF when composing an email, for both single and bulk sends. Also, allow the user to optionally rename/edit a resume's file name at upload time and at update/replace time, so recipients see a clean file name on the attachment."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Attach a resume when sending outreach emails (Priority: P1)

A job seeker has already saved one or more labeled resumes (002-resume-storage). While composing an outreach email — whether to a single recruiter or a bulk list — they pick one of those resumes to send along with the email, without leaving Compose.

**Why this priority**: This is the entire point of the feature — 002-resume-storage was explicitly built as groundwork for this connection. Without it, saved resumes have no path into an actual sent email.

**Independent Test**: Can be fully tested by composing a send (single or bulk), selecting a saved resume, sending, and confirming the recipient(s) received the email with that exact PDF attached.

**Acceptance Scenarios**:

1. **Given** a user has at least one active saved resume, **When** they compose an email, **Then** they see a "Resume" selector listing their active resumes by label, defaulted to "No attachment."
2. **Given** a user selects a resume in the Resume selector, **When** they review the email before sending, **Then** the preview clearly shows which resume will be attached.
3. **Given** a user has selected a resume and confirms send (single or bulk), **When** the email(s) go out, **Then** every recipient in that batch receives the identical resume PDF attached.
4. **Given** a user leaves the Resume selector on "No attachment," **When** they send, **Then** no attachment is included, exactly as it works today.
5. **Given** a user has no saved resumes yet, **When** they open the Resume selector, **Then** they see that they have none available (not an error), with "No attachment" still usable.

---

### User Story 2 - See attachment history and resend it (Priority: P2)

A job seeker looks back at a previous send and wants to know whether a resume was attached and which one. If they resend that batch later, the same resume goes out again automatically.

**Why this priority**: Confirms what was actually sent (this app's "sending is sacred" principle extends to attachments) and keeps resend behavior consistent without asking the user to re-pick anything. Valuable, but the send itself (US1) delivers the feature's core value on its own.

**Independent Test**: Can be fully tested by sending with a resume attached, viewing that send in History to confirm the resume is shown, then resending it and confirming the same resume is attached again.

**Acceptance Scenarios**:

1. **Given** a past send included a resume attachment, **When** a user views that send in History, **Then** they see which resume (label and file name) was attached.
2. **Given** a past send had no resume attached, **When** a user views it in History, **Then** nothing is shown suggesting one was.
3. **Given** a user resends a past batch that had a resume attached, **When** the resend goes out, **Then** the same resume is attached again automatically, without the user re-selecting it.
4. **Given** a resend's originally-attached resume can no longer be found (an edge case, since resumes are never hard-deleted today), **When** the resend is triggered, **Then** the email still sends without the attachment, and the user is told plainly that the attachment could not be included — the resend is never blocked or failed outright because of this.

---

### User Story 3 - Give a resume a clean file name recipients will see (Priority: P2)

A job seeker's saved resume file was originally named something unhelpful (e.g. "Resume (3).pdf" or "scan_final2.pdf"). Since that file name is what a recruiter sees on the email attachment, the user wants to set a cleaner name before or after saving it.

**Why this priority**: Directly improves how the sent attachment reads to its recipient, but the feature is still useful without it (attachments still send correctly with whatever name the source file had) — it's a polish layer on top of US1.

**Independent Test**: Can be fully tested by uploading (or updating) a resume with a custom file name and confirming both the resume list and a subsequent sent attachment show that exact name.

**Acceptance Scenarios**:

1. **Given** a user is uploading a new resume, **When** they optionally provide a custom file name, **Then** the resume is saved and shown using that name instead of the source file's original name.
2. **Given** a user leaves the file name field blank while uploading, **When** the resume is saved, **Then** it falls back to the original uploaded file's name, exactly as it works today.
3. **Given** a user is updating an existing resume's file (the 002-resume-storage Update action), **When** they optionally provide a custom file name for the new version, **Then** the new version is saved and shown using that name.
4. **Given** a user provides a custom file name without a `.pdf` extension, **When** they submit it, **Then** the system appends `.pdf` automatically rather than rejecting the input.
5. **Given** a user provides a custom file name containing characters unsafe for a file name (e.g. `/`, `\`, control characters), **When** they submit it, **Then** those characters are stripped or replaced before saving, rather than the upload being rejected.

---

### Edge Cases

- What happens when the resume selected in Compose is deleted (archived) by the user before they hit send? The selector's list only ever shows currently-active resumes, so this requires deleting it in a separate tab/session mid-compose; on send, the system re-validates the resume is still active and, if not, tells the user clearly and asks them to pick again rather than silently sending without it or silently sending a stale file.
- What happens if the selected resume belongs to a different user (e.g. a tampered request)? Treated exactly like every other ownership check in this app — as if the resume does not exist.
- What happens if a resume's file, combined with the email body, would push the total outgoing message over the email provider's size limit? The send is rejected up front with a clear, specific error, rather than a raw provider error or a partially-sent batch.
- What happens to a resume's history/attachment record when the resume itself is later deleted (archived)? The historical record of what was attached to a past send is unaffected — history describes what was sent at the time, independent of the resume's current status.
- What happens when a custom file name is provided that is empty after stripping unsafe characters? Falls back to the original file's name, same as leaving the field blank.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to select one of their own active saved resumes to attach when composing an email, for both single-recipient and bulk sends.
- **FR-002**: The default selection MUST be "no attachment"; users are never required to attach a resume to send an email.
- **FR-003**: When a resume is selected, every recipient in that send batch MUST receive the identical resume file — the feature does not support choosing different resumes per recipient within one batch.
- **FR-004**: The email preview shown to the user before sending MUST truthfully reflect whether a resume is attached and which one, updating immediately when the selection changes.
- **FR-005**: The system MUST validate that a selected resume belongs to the sending user before including it in a send; a resume that isn't the user's own MUST be treated as if it doesn't exist.
- **FR-006**: The system MUST re-validate at send time that a selected resume is still active; if it is no longer active, the send MUST be stopped with a clear message rather than silently sending with or without the attachment.
- **FR-007**: A record of which resume (if any) was attached to a send MUST be retained as part of that send's history, viewable later alongside the rest of that send's details.
- **FR-008**: Viewing a past send's history MUST show the attached resume's label and file name when one was attached, and show nothing suggesting an attachment when there wasn't one.
- **FR-009**: Resending a past batch MUST automatically reattach the same resume that batch originally used, without requiring the user to re-select it.
- **FR-010**: If a resend's originally-attached resume can no longer be found, the resend MUST still proceed without the attachment, and MUST clearly tell the user the attachment was dropped — it MUST NOT fail the entire resend.
- **FR-011**: The system MUST prevent a send from being submitted if including the selected resume would push the total outgoing message past the email provider's size limit, with a clear, specific error rather than a failed or partial send.
- **FR-012**: Deleting (archiving) a resume MUST NOT alter or remove any historical record of past sends that used it while it was active.
- **FR-013**: Users MAY optionally provide a custom file name when uploading a new resume or updating an existing resume's file (002-resume-storage's Update action); when omitted, the system falls back to the original uploaded file's name exactly as today.
- **FR-014**: A custom file name MUST always be saved with a `.pdf` extension — the system appends one automatically if missing rather than rejecting the input.
- **FR-015**: A custom file name MUST have unsafe file-name characters stripped or replaced before saving; if nothing usable remains after stripping, the system falls back to the original file's name.
- **FR-016**: The saved (possibly custom) file name MUST be what recipients see as the attachment's file name when that resume is sent.

### Key Entities

- **Send Attachment Reference**: A record, held on a send batch, pointing to the resume (if any) selected for that send at the time it was sent. Persists independently of the resume's later status so history remains accurate even if the resume is later archived.
- **Resume** *(extends 002-resume-storage's entity)*: Gains an optional, user-editable file name distinct from the originally uploaded file's name — this is the name shown in the app and used as the attachment's name when sent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can select a resume and send an email (single or bulk) with it attached in under 15 seconds beyond the time it takes to compose the email itself.
- **SC-002**: 100% of sends with a resume selected show that resume clearly in the pre-send preview — never an invisible or ambiguous attachment.
- **SC-003**: 100% of resends of a batch that originally had a resume attached reattach that same resume automatically, with zero user re-selection required.
- **SC-004**: Zero sends fail outright due to an unresolvable attachment reference — the system always degrades to "sent without attachment, and said so" rather than blocking the send.
- **SC-005**: Zero instances of one user's send including another user's resume.

## Assumptions

- Users are already signed in and already have at least the ability to save resumes (002-resume-storage) before using this feature; no new identity or resume-storage system is introduced here.
- A "send batch" (single or bulk) is the right unit to attach a resume to — this feature does not introduce per-recipient customization of any kind beyond what already exists (e.g. per-recipient merge fields in the template stay as they are).
- Retaining the historical attachment reference indefinitely, independent of the resume's current status, is acceptable — no separate purge or retention policy is introduced.
- The custom file name only affects display and the outgoing attachment's name; it never changes the underlying stored file's bytes or its storage key/location.
- Attaching more than one resume to a single send, per-recipient different resumes, and non-PDF attachment types are all out of scope for this feature.
