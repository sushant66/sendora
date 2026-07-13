# Quickstart: Resume Storage

**Feature**: `002-resume-storage` | **Date**: 2026-07-11

How to set up the environment and validate this feature end-to-end. This is the
developer-facing counterpart to the spec's user journeys. Builds on the setup in
`specs/001-recruiter-outreach/quickstart.md` — this adds only what's new.

## Prerequisites

- Everything in `001-recruiter-outreach`'s quickstart (Node 20 LTS, pnpm, NeonDB, Google
  OAuth client)
- A Cloudflare account with an R2 bucket created, and an R2 API token (access key ID +
  secret access key) scoped to that bucket

## New environment variables

Added to the existing `EnvSchema` — the app fails fast at startup if any are missing.

```bash
R2_ACCOUNT_ID=...          # Cloudflare account id
R2_ACCESS_KEY_ID=...       # R2 API token access key id
R2_SECRET_ACCESS_KEY=...   # R2 API token secret
R2_BUCKET_NAME=...         # Bucket that stores resume PDFs
```

## Setup

```bash
pnpm install                # picks up the new S3-compatible client dependency
pnpm db:generate            # generate the `resume` table migration
pnpm db:migrate             # apply it to NeonDB
pnpm dev
```

## Validate the user journeys

Each maps to a spec user story and its Independent Test.

```bash
pnpm test            # Vitest unit + contract + integration
pnpm test:e2e        # Playwright user-journey tests
```

**US1 — Save a labeled resume**
1. Sign in. Go to Resumes → Upload.
2. Choose a PDF, type a label (e.g. "Backend Engineer") → Upload.
3. Confirm it's saved; try uploading another PDF with the same label and confirm a clear
   "label already in use" error; try uploading a non-PDF file and confirm it's rejected.

**US2 — Browse and open saved resumes**
1. Resumes → confirm the list shows label, file name, and save date for each active resume.
2. Open one → confirm the exact PDF you uploaded is what opens.
3. With nothing uploaded yet, confirm the list shows a clear empty state, not an error.

**US3 — Remove a resume no longer needed**
1. Delete a resume from the list → confirm it disappears and other resumes are unaffected.
2. Try deleting it again → confirm a clear error (nothing active left to remove).

**US4 — Replace a resume without losing the old one**
1. Upload a new resume under a label that already has an active one → confirm the previous
   version is retained (visible in that label's history) rather than gone.
2. Open the history for that label → confirm each past version is listed and can be opened.
3. Restore an earlier version → confirm it becomes active again and the version it replaced
   moves into history instead.

## Constitution gates (must stay green)

```bash
pnpm typecheck       # TypeScript strict — zero errors (Principle I)
pnpm test            # all tests pass, written test-first (Principle II)
pnpm test:a11y       # accessibility checks for the /resumes page (Principle III)
pnpm lint            # design-system usage / no ad-hoc styling (Principle IV)
```
