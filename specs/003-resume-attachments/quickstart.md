# Quickstart: Resume Attachments

**Feature**: `003-resume-attachments` | **Date**: 2026-07-12

How to set up the environment and validate this feature end-to-end. Builds on the setup in
`001-recruiter-outreach/quickstart.md` (Gmail sending) and `002-resume-storage/quickstart.md`
(R2 resume storage) — this feature introduces no new environment variables or external
services, only new behavior on top of both.

## Prerequisites

- Everything in `001-recruiter-outreach`'s and `002-resume-storage`'s quickstarts already
  working: a connected Gmail account, and at least one saved resume.

## Setup

```bash
pnpm db:generate    # generate the migration for send_batch.attached_resume_id
pnpm db:migrate     # apply it to NeonDB
pnpm dev
```

## Validate the user journeys

```bash
pnpm test          # Vitest unit + contract + integration
pnpm test:e2e       # Playwright user-journey tests
```

**US1 — Attach a resume when sending outreach emails**
1. Compose an email to one recruiter. Confirm a "Resume" selector appears beside
   "Template," defaulted to no attachment.
2. Pick a saved resume. Confirm the preview clearly shows which resume will be attached.
3. Send. Confirm the recipient's inbox shows the email with that exact PDF attached.
4. Repeat with multiple recipients selected (bulk) — confirm every recipient gets the same
   attached PDF.
5. Leave the selector on "No attachment" and send — confirm no attachment goes out, exactly
   as before this feature.

**US2 — See attachment history and resend it**
1. After a send with a resume attached, go to History → open that send. Confirm it shows
   which resume (label + file name) was attached.
2. Open a past send that had no attachment — confirm nothing suggests one was sent.
3. Resend the attached-resume send. Confirm the same resume goes out again automatically,
   with no re-selection required.

**US3 — Give a resume a clean file name recipients will see**
1. Resumes → Upload. Provide a custom file name (with or without `.pdf`) alongside the PDF.
   Confirm the saved resume shows that name (normalized to end in `.pdf`).
2. Leave the file name blank on another upload — confirm it falls back to the source file's
   own name, as before.
3. Use Update on an existing resume with a custom file name for the new version — confirm
   the new version shows that name.
4. Send an email attaching a custom-named resume — confirm the recipient sees that exact
   name on the attachment.

## Edge cases worth exercising manually

- Delete (archive) a resume in one tab while it's selected in Compose in another, then send
  in the first tab — confirm a clear "no longer available" message, not a silent send.
- Attempt a send where the selected resume, combined with the email body, would exceed the
  provider's size limit (hard to hit in practice given the 10MB resume cap, but exercise the
  code path with a crafted test case) — confirm a clear pre-send error, not a partial batch
  or a raw provider error.
