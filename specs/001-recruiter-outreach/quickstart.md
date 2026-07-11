# Quickstart: Recruiter Outreach

**Feature**: `001-recruiter-outreach` | **Date**: 2026-07-11

How to set up the environment and validate this feature end-to-end. This is the
developer-facing counterpart to the spec's user journeys.

## Prerequisites

- Node.js 20 LTS, a package manager (pnpm recommended)
- A NeonDB (serverless Postgres) database + connection string
- A Google Cloud project with an OAuth 2.0 client (Web application) and the Gmail API
  enabled, authorized for the `gmail.send` scope

## Environment variables

All are validated at startup by `EnvSchema` (Zod) — the app fails fast if any are
missing or malformed.

```bash
DATABASE_URL=postgres://...        # NeonDB connection string
AUTH_SECRET=...                    # Auth.js session/encryption secret
GOOGLE_CLIENT_ID=...               # Google OAuth client id
GOOGLE_CLIENT_SECRET=...           # Google OAuth client secret
TOKEN_ENCRYPTION_KEY=...           # Key used to encrypt stored refresh tokens at rest
APP_URL=http://localhost:3000      # Base URL for OAuth callbacks
```

## Setup

```bash
pnpm install
pnpm drizzle-kit generate          # generate SQL migration from schema
pnpm drizzle-kit migrate           # apply migrations to NeonDB
pnpm db:seed                       # seed the starter (system) email templates
pnpm dev                           # start Next.js
```

## Validate the user journeys

Each maps to a spec user story and its Independent Test. Run the automated suite, then
optionally walk through the UI.

```bash
pnpm test            # Vitest unit + contract + integration
pnpm test:e2e        # Playwright user-journey tests
```

**US1 — Import recruiter contacts**
1. Sign in with Google.
2. Contacts → Import → upload a CSV, an `.xlsx`, or paste rows.
3. Confirm the column mapping; verify the summary reports imported / duplicates / invalid,
   valid rows appear, and no partial contact is created for an invalid row.

**US2 — Single templated send** (requires a connected Gmail account)
1. Settings → Email account → Connect Gmail (grants `gmail.send`).
2. Compose → pick a recruiter + a starter template → preview shows merge fields resolved.
3. Edit subject/body → Send → the email arrives from your Gmail address and appears in
   history as `sent`.

**US3 — Custom templates**
1. Templates → New → author a rich-text body (bold/italic/lists/links) with `{{first_name}}`
   etc. → save (unsupported tokens are blocked with a warning).
2. Reopen, edit, save; confirm it is selectable in compose and renders correctly.

**US4 — Bulk send**
1. Compose → select several recruiters + a template → review per-recipient previews.
2. Send → each recruiter receives a separate email; the summary reports per-recipient
   success/failure; a duplicate-selected recruiter receives only one email.

**US5 — Sending history**
1. History → confirm each send lists recipient, template/subject, timestamp, outcome.
2. Start a new send to an already-emailed recruiter → confirm the re-contact warning.

## Constitution gates (must stay green)

```bash
pnpm typecheck       # TypeScript strict — zero errors (Principle I)
pnpm test            # all tests pass, written test-first (Principle II)
pnpm test:a11y       # accessibility checks incl. the rich-text editor (Principle III)
pnpm lint            # design-system usage / no ad-hoc styling (Principle IV)
```
