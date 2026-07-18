<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/wordmark-dark.svg">
  <img src="./docs/wordmark-light.svg" alt="Sendora" width="300">
</picture>

### Recruiter outreach for job seekers, sent from your own inbox

[![CI](https://github.com/sushant66/sendora/actions/workflows/ci.yml/badge.svg)](https://github.com/sushant66/sendora/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-App_Router-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)](https://www.typescriptlang.org)

</div>

Import recruiter contacts, pick or author rich-text email templates with merge fields,
attach the right resume, and send personalized emails (individually or in bulk) **from your
own connected Gmail or Yahoo account**, so replies come straight back to your inbox. Every
send is recorded with a per-recipient outcome, and you are warned before re-contacting
someone.

> Sending is from your real address via the narrow `gmail.send` scope only (or your own
> Yahoo app password). Sendora never reads your mail, and refresh tokens and provider
> secrets are encrypted at rest.

<!--
  Add a product screenshot here once you have one, e.g.:
  <p align="center"><img src="docs/screenshot-compose.png" alt="Sendora compose screen" width="800"></p>
  The app is OAuth-gated, so capture it from a running instance after signing in.
-->

## Contents

- [Why Sendora](#why-sendora)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts and quality gates](#scripts-and-quality-gates)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Why Sendora

Job seekers reaching out to recruiters juggle a spreadsheet of contacts, a handful of
near-identical email drafts, and the constant risk of pasting the wrong name into the wrong
message. Bulk-email tools solve the volume problem but send from a shared marketing domain,
so replies never reach the applicant. Sendora keeps outreach personal and in your own inbox:
each recruiter gets a separately personalized email sent from your real address, with the
right resume attached, and a record of who you have already contacted.

## Features

- **Import contacts** from CSV, Excel (`.xlsx`), or pasted rows, with column auto-mapping,
  per-user dedup, and a summary that reports duplicates and invalid rows (never silently
  dropped).
- **Templates** — a starter library plus your own rich-text templates (bold, italic, lists,
  links) with a fixed, validated merge-field vocabulary. Save and update templates directly
  from the compose screen.
- **Merge fields** — a namespaced vocabulary including `my_*` fields from your sender
  profile, inserted through an inline "/" slash-menu picker as atomic, un-splittable chips.
- **Compose** — pick recruiters and a template, personalize, and preview the merge-resolved
  email live before sending. No delivered email ever contains a literal `{{placeholder}}`, and
  a pre-send gate blocks sending while any required value is missing.
- **Bulk send** — each recruiter gets a separate, individually personalized email; a
  per-recipient result summary shows successes and failures (partial failures never hide
  successful sends). A test-send lets you mail a draft to yourself first.
- **Resumes** — upload labeled resume PDF variants ("Backend Engineer", "Full Stack",
  "DevOps"), browse and open them, and replace one without losing the previous version:
  older versions become retrievable history and can be restored. Attach one resume per send
  batch, with an editable file name.
- **History** — every send with recipient, template, time, and outcome, plus a re-contact
  warning before you email someone again.
- **Bring your own sender** — connect Gmail (via Google OAuth `gmail.send`) or Yahoo (via a
  Yahoo app password over SMTP) behind one provider-agnostic seam.

## Tech stack

- **Next.js** (App Router, React 19) + **TypeScript** (`strict`)
- **[Astryx](https://astryx.design)** design system (all UI and theming; see `DESIGN.md`)
- **NeonDB** (serverless Postgres) via **Drizzle ORM**
- **Cloudflare R2** (S3-compatible object storage) for resume PDF bytes
- **Auth.js** (NextAuth v5) + Google OAuth for login and the `gmail.send` grant
- **Gmail API** and **Yahoo SMTP** behind a provider-agnostic `EmailProvider` seam
- **Zod** at every trust boundary, **Tiptap** rich-text, **Vitest** + **Playwright** tests

## Getting started

### Prerequisites

- **Node.js 20.10+** (CI runs Node 24; an `.nvmrc` pins the recommended version)
- **[pnpm](https://pnpm.io)** (`corepack enable` will provide the pinned version)
- A **NeonDB** database (or any Postgres connection string)
- A **Google Cloud** OAuth 2.0 client with the Gmail API enabled
- A **Cloudflare R2** bucket (for resume storage)

### Setup

```bash
git clone https://github.com/sushant66/sendora.git
cd sendora
pnpm install
cp .env.example .env             # fill in the values (see below)
pnpm db:generate                 # generate SQL migrations from the schema
pnpm db:migrate                  # apply migrations to your database
pnpm db:seed                     # seed the starter email templates
pnpm dev                         # http://localhost:3000
```

Configure the Google OAuth client's authorized redirect URIs to include:

- `${APP_URL}/api/auth/callback/google` (login)
- `${APP_URL}/api/email-account/callback` (the `gmail.send` connection)

Yahoo needs no server credentials: users connect by pasting their own Yahoo email and an
app-specific password (generated in Yahoo Account Security).

## Environment variables

All variables are validated at startup by `EnvSchema`; the app fails fast if any are missing
or malformed. Copy `.env.example` to `.env` and fill in:

| Variable               | Description                                                                |
| ---------------------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`         | NeonDB / Postgres connection string                                        |
| `AUTH_SECRET`          | Auth.js session secret (`openssl rand -base64 32`)                         |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                                                     |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                                                 |
| `TOKEN_ENCRYPTION_KEY` | Key to encrypt stored provider secrets at rest (`openssl rand -base64 32`) |
| `APP_URL`              | Base URL for OAuth callbacks (e.g. `http://localhost:3000`)                |
| `R2_ACCOUNT_ID`        | Cloudflare R2 account ID                                                   |
| `R2_ACCESS_KEY_ID`     | R2 access key ID                                                           |
| `R2_SECRET_ACCESS_KEY` | R2 secret access key                                                       |
| `R2_BUCKET_NAME`       | R2 bucket name for resume PDFs                                             |

## Scripts and quality gates

```bash
pnpm dev            # start the dev server
pnpm build          # production build
pnpm typecheck      # TypeScript strict, zero errors (Constitution I)
pnpm test           # Vitest unit + contract + integration
pnpm test:e2e       # Playwright user-journey tests (needs the app + DB running)
pnpm test:a11y      # accessibility checks (Playwright, @a11y-tagged)
pnpm lint           # ESLint incl. design-system usage (Constitution IV)
pnpm format         # Prettier
```

Husky pre-commit hooks run lint-staged; CI runs lint and typecheck on every push and pull
request.

## Project structure

```
app/          Next.js App Router: auth shell, authenticated app, and thin API route handlers
lib/          Framework-free, unit-testable modules (db, auth, validation, import, email, send, …)
components/   Shared UI built from Astryx components + theme tokens
drizzle/      Generated SQL migrations
specs/        Spec-first design docs, one directory per feature
tests/        Vitest and Playwright suites
docs/         Architecture and supporting documentation
```

See [`docs/architecture.md`](./docs/architecture.md) for how the layers fit together and why.

## Documentation

- [`PRODUCT.md`](./PRODUCT.md) — who it is for, product purpose, design principles.
- [`DESIGN.md`](./DESIGN.md) — how the Astryx design system is used (the enforced visual system).
- [`docs/architecture.md`](./docs/architecture.md) — how the code is organized and why.
- `specs/001-recruiter-outreach/` — spec, plan, data model, and API contracts for recruiter outreach.
- `specs/002-sender-profile-merge-polish/` — sender profile, merge fields, and outreach polish.
- `specs/002-resume-storage/` — resume storage.
- `specs/003-resume-attachments/` — resume attachments on send.
- `.specify/memory/constitution.md` — the engineering principles that govern the build.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) and the
[Code of Conduct](./CODE_OF_CONDUCT.md). In short: work is spec-first, test-first is
non-negotiable, all UI is built from Astryx components and tokens, and every trust boundary
is validated with Zod.

## Security

Sendora handles OAuth tokens and email-send access. Please report vulnerabilities privately
rather than in a public issue: see [SECURITY.md](./SECURITY.md).

## License

Released under the [MIT License](./LICENSE).
