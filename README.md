# Sendora

Recruiter outreach for job seekers. Import recruiter contacts, pick or author rich-text
email templates with merge fields, and send personalized emails — individually or in bulk
— **from your own connected Gmail account**, so replies come back to your inbox. Every
send is recorded with a per-recipient outcome, and you're warned before re-contacting
someone.

> Sending is from your real address via the narrow `gmail.send` scope only — Sendora never
> reads your mail, and refresh tokens are encrypted at rest.

## Features

- **Import contacts** from CSV, Excel (`.xlsx`), or pasted rows — with column auto-mapping,
  per-user dedup, and a summary that reports duplicates and invalid rows (never silently
  dropped).
- **Templates** — a starter library plus your own rich-text templates (bold/italic/lists/
  links) with a fixed, validated merge-field vocabulary.
- **Compose** — pick recruiters and a template, personalize, and preview the merge-resolved
  email live before sending. No delivered email ever contains a literal `{{placeholder}}`.
- **Bulk send** — each recruiter gets a separate, individually personalized email; a
  per-recipient result summary shows successes and failures (partial failures never hide
  successful sends).
- **History** — every send with recipient, template, time, and outcome; a re-contact
  warning before you email someone again.

## Tech stack

- **Next.js** (App Router, React 19) + **TypeScript** (`strict`)
- **[Astryx](https://astryx.design)** design system (all UI + theming; see `DESIGN.md`)
- **NeonDB** (serverless Postgres) via **Drizzle ORM**
- **Auth.js** (NextAuth v5) + Google OAuth for login and the `gmail.send` grant
- **Gmail API** behind a provider-agnostic `EmailProvider` seam
- **Zod** at every trust boundary · **Tiptap** rich-text · **Vitest** + **Playwright** tests

## Getting started

Requires Node.js 20 LTS, [pnpm](https://pnpm.io), a NeonDB database, and a Google Cloud
OAuth 2.0 client with the Gmail API enabled.

```bash
pnpm install
cp .env.example .env            # fill in the values (see below)
pnpm db:generate                # generate SQL migrations from the schema
pnpm db:migrate                 # apply migrations to NeonDB
pnpm db:seed                    # seed the starter email templates
pnpm dev                        # http://localhost:3000
```

### Environment

All variables are validated at startup by `EnvSchema` (the app fails fast if any are
missing or malformed). See `.env.example` for the full list: `DATABASE_URL`, `AUTH_SECRET`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `APP_URL`.

Configure the Google OAuth client's authorized redirect URIs to include:

- `${APP_URL}/api/auth/callback/google` (login)
- `${APP_URL}/api/email-account/callback` (the `gmail.send` connection)

## Scripts & quality gates

```bash
pnpm typecheck      # TypeScript strict — zero errors (Constitution I)
pnpm test           # Vitest unit + contract + integration
pnpm test:e2e       # Playwright user-journey tests (needs the app + DB running)
pnpm test:a11y      # accessibility checks (Playwright, @a11y-tagged)
pnpm lint           # ESLint incl. design-system usage (Constitution IV)
```

## Documentation

- `PRODUCT.md` — who it's for, product purpose, design principles.
- `DESIGN.md` — how the Astryx design system is used (the enforced visual system).
- `docs/architecture.md` — how the code is organized and why.
- `specs/001-recruiter-outreach/` — the full spec, plan, data model, and API contracts.
- `.specify/memory/constitution.md` — the engineering principles that govern the build.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). In short: test-first is non-negotiable, all UI is
built from Astryx components + tokens, and every trust boundary is validated with Zod.
