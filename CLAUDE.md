# CLAUDE.md

Guidance for Claude Code (and any AI agent) working in this repository. Read this first,
then the specific `specs/<feature>/` docs for the area you are changing.

## Overview

Sendora is recruiter-outreach software for job seekers: import recruiter contacts, author
rich-text email templates with merge fields, attach a resume, and send personalized emails
(individually or in bulk) from the user's own Gmail or Yahoo account. It is a single Next.js
(App Router) app with no separate backend: route handlers and server components are the API
surface, and framework-free `lib/` modules hold the business logic.

The project is governed by a constitution (`.specify/memory/constitution.md`). When any
convention here conflicts with a principle there, the constitution wins.

## Commands

```bash
pnpm dev            # dev server at http://localhost:3000
pnpm build          # production build
pnpm typecheck      # tsc --noEmit, strict, must be zero errors
pnpm test           # Vitest: unit + contract + integration
pnpm test:watch     # Vitest in watch mode
pnpm test:e2e       # Playwright user-journey tests (needs the app + DB running)
pnpm test:a11y      # Playwright accessibility checks (@a11y-tagged)
pnpm lint           # ESLint incl. design-system usage rules
pnpm format         # Prettier

pnpm db:generate    # generate a Drizzle SQL migration from schema changes
pnpm db:migrate     # apply migrations
pnpm db:seed        # seed starter email templates
pnpm theme:build    # regenerate lib/theme/neutral.{css,js} from neutralTheme.ts
```

Before opening a PR: `pnpm typecheck && pnpm lint && pnpm test` must be green (plus
`pnpm test:e2e` for user-facing changes). CI runs lint and typecheck on every push and PR.

## Architecture

```
app/
  (auth)/         sign-in shell (unauthenticated)
  (app)/          authenticated app: contacts, templates, compose, history, resumes, settings
  (marketing)/    public landing
  api/            route handlers (thin: auth -> Zod -> service -> response)
  actions/        server actions
lib/               framework-free, independently unit-testable modules:
  db/             Drizzle schema + client (typed layer over NeonDB)
  auth/           Auth.js config + session helpers (per-user scoping)
  validation/     Zod schemas, incl. env.ts (EnvSchema, validated at startup)
  http/           route.ts wrapper that maps domain errors to the HTTP contract
  import/         CSV/xlsx/paste parsers -> one normalize -> validate -> dedup pipeline
  contacts/ templates/ compose/ send/ history/ profile/ resumes/   feature services
  email/          EmailProvider seam (provider.ts) + Gmail and Yahoo implementations
  storage/        Cloudflare R2 object storage
  crypto/         encryption of provider secrets at rest
  sanitize/       server-side rich-text HTML sanitizer (strict allow-list)
  errors.ts       domain error types
components/         shared UI built from Astryx components + theme tokens
drizzle/           generated SQL migrations
specs/             spec-first design docs, one directory per feature
```

## Conventions (non-negotiable)

- **Type safety.** End-to-end TypeScript `strict`. No `any`: use `unknown` and narrow. Every
  trust boundary (request bodies, query params, uploaded/pasted rows, OAuth data, env vars,
  provider responses) is validated at runtime with **Zod**, and the validated type flows
  through. Build the smallest thing that satisfies the requirement.
- **Test-first (mandatory).** Write the test, watch it fail for the right reason, then
  implement. Product logic ships with tests; every user-facing flow has integration coverage
  in addition to unit tests. Never weaken a test to make code pass.
- **Thin route handlers.** `app/api/**` handlers authenticate, validate with Zod, delegate to
  a `lib/` service, and map the result. Business logic lives in `lib/`, free of framework or
  UI coupling. Services accept an optional `db`/`provider` for testability.
- **Data access** goes through the typed Drizzle layer (`lib/db`). Every user-owned query is
  scoped to the authenticated `userId`. Schema changes ship with a generated migration.
- **Sending** goes through the `EmailProvider` seam (`lib/email/provider.ts`). Add a provider
  by implementing the interface and a factory case; never call a provider API from the send
  flow directly.
- **Secrets** come from env vars only (validated by `EnvSchema` in `lib/validation/env.ts`)
  and are never committed. Stored OAuth refresh tokens are encrypted at rest and never
  returned to the client.
- **Errors.** Services throw domain errors (`lib/errors.ts`); the `route()` wrapper
  (`lib/http/route.ts`) maps them to the HTTP contract in `specs/**/contracts/`.
- **Accessibility.** WCAG 2.1 AA at build time: keyboard operability, visible focus, at
  least 4.5:1 contrast, correct roles and accessible names. Use Astryx's accessible
  primitives; custom interactive surfaces (e.g. the rich-text editor) meet the same bar.
- **Copy.** All user-facing text and sent email content is plain, human, and honest. Do not
  use the em-dash (`—`) in rendered copy or email bodies: rewrite with a period, comma, plain
  connective, colon, or parentheses. This is a voice rule for product text, not code comments.

## Workflows

### Feature development: use Spec Kit

All feature work is spec-first through Spec Kit (`/speckit.specify` -> `/speckit.plan` ->
`/speckit.tasks` -> `/speckit.implement`). Design docs live in `specs/<feature>/` (spec,
plan, research, data-model, contracts, quickstart). A change without a corresponding
`specs/<feature>/` entry is not ready for review.

### UI work: use impeccable

Every UI change (screens, components, layout, spacing, color, typography, motion, empty and
error states, responsive behavior, accessibility, copy polish) goes through the `impeccable`
skill and is verified in the live app. Do not hand-roll or eyeball styling. See `DESIGN.md`.

### Shipped features

`001-recruiter-outreach` (auth, import, templates, compose, bulk send, history) ·
`002-sender-profile-merge-polish` (sender profile, `my_*` merge fields, slash-menu chips,
soft-delete/undo, test-send, pre-send gate) · `002-resume-storage` (labeled PDF resume
variants in R2) · `003-resume-attachments` (a resume per send batch) · Yahoo Mail (a second
`EmailProvider` over SMTP).

<!-- ASTRYX:START -->

Astryx v0.1.4 · 149 components
CLI: run every command as `pnpm exec astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in your app entry e.g. main.tsx) — without these, components render unstyled:
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";

WORKFLOW — discover, don't guess. Before writing UI:

1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:

- No <div> — components do all layout/spacing. Full page → AppShell; sidebar nav → SideNav.
- Frame first: pick the shell (AppShell / Layout+LayoutPanel) and budget regions in px BEFORE writing content (`astryx docs layout`).
- Dense data = rows (Table, List/Item) edge-to-edge — never Card-wrapped list items. Card = dashboard widgets, galleries, settings groups only.
- Status → StatusDot/Token; Badge only for counts and enumerated states, never decoration.
- Custom styling: component props first; else style/className with tokens — var(--color-_|--spacing-_|--radius-*). No raw hex/px. (No StyleX/Tailwind compiler here — don't use xstyle/utility classes.)
- Tokens for every value (`astryx docs tokens`). Brand/accent live in our own theme at `lib/theme/neutralTheme.ts` (accent = warm gold). Edit that file, then `pnpm theme:build` to regenerate `lib/theme/neutral.{css,js}` (the app imports the built file; the source is client-only). Never override --color-* in :root.
- Copy: no em-dashes (`—`) in any user-facing text or sent email content (Constitution V). Rewrite with a period, comma, connective, colon, or parentheses. Plain and human, never hype. (Applies to rendered copy and email bodies, not code comments.)

MORE CLI:
search "<query>" find any component / hook / doc / template / block
component --list 149 components by category
template --list page + block recipes
docs <topic> color, elevation, icons, illustrations, layout, migration, motion, principles, shape, spacing, styling, theme, tokens, typography
swizzle <Name> eject component source for deep customization
upgrade --apply run after any @astryxdesign/core bump
<!-- ASTRYX:END -->
