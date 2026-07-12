# Quickstart: Sender profile, merge fields, and outreach polish (002)

How to build, run, and verify this feature locally. Assumes the 001 setup already works
(Neon connection string, Google OAuth client, Astryx theme built).

## Prerequisites

- Node 20 LTS, pnpm.
- `.env` with the existing 001 variables (Neon `DATABASE_URL`, Auth.js / Google OAuth, token
  encryption key). No new environment variables are introduced by this feature.
- A connected Gmail account in the app (needed to verify the test-send story).

## Install and migrate

```bash
pnpm install                 # adds @tiptap/suggestion
pnpm drizzle-kit generate    # sender_profile table + recruiter_contact soft-delete + partial index
pnpm drizzle-kit migrate
pnpm theme:build             # only if theme tokens changed
pnpm dev
```

## Test-first workflow (Constitution II)

Write the failing test before each slice, then implement. Suggested order follows the story
priorities.

```bash
pnpm test           # Vitest unit + component + contract (watch during development)
pnpm test:e2e       # Playwright journeys (one per user story)
pnpm typecheck      # zero errors required before merge
pnpm lint
```

Key unit specs to author first:

- `merge`: sender tokens resolve from the profile; each empty sender field drops with a warning;
  0 literal `{{token}}` for either namespace (SC-002).
- `missing-value`: given a selection + used tokens + profile, returns correct per-field counts
  and the affected recipients (SC-005).
- `soft-delete/undo`: delete sets `deleted_at`/`deleted_batch`; reads hide deleted; restore by
  batch re-activates; a row colliding with a live email is skipped; a new delete commits the
  prior batch (FR-022/023).
- `token insertion`: the merge chip serializes to the exact `{{token}}`; a chip deletes as one
  unit and cannot be split into a malformed token (SC-003).

## Manual verification per story

1. **Profile (US1)**: open `/profile`, confirm display name is prefilled from Google and
   editable; save a title/pitch/skills/link; in a template use a "Your details" field; preview
   for a contact and confirm both sender and recipient values fill in. Leave a sender field blank
   and confirm the preview warns rather than leaking a placeholder. Confirm sending is NOT blocked
   with an empty profile.
2. **Slash menu (US2)**: in the template editor and in compose, type "/", confirm a searchable,
   keyboard-navigable menu grouped Recipient / Your details; insert fields; confirm they appear as
   chips that delete as a unit; confirm the subject "insert field" menu drops a raw token; confirm
   Escape dismisses and typing "/" as ordinary text is not trapped.
3. **Confidence (US3)**: compose an email, "send test to myself", confirm it arrives fully
   rendered and marked as a test, and that it does NOT appear in `/history`. Select several
   contacts where some lack a company; confirm one summary shows how an affected email reads and
   requires an explicit confirm. Confirm the "cold outreach" starter no longer mentions an
   attachment.
4. **Bulk contacts (US4)**: select several rows; use "select all N matching" on a search; bulk
   delete; confirm the count in the dialog; confirm they vanish and an undo appears; undo and
   confirm all return with history still attributed; repeat, let the window lapse, confirm the
   delete stands; start a second delete during a pending undo and confirm the first commits.
5. **Onboarding (US5)**: as a fresh account, confirm the setup guidance leads through importing
   contacts and seeing a rendered template before any Gmail prompt; confirm profile is an optional
   step; confirm the Gmail prompt appears at first send.

## Accessibility check (Constitution III)

- Slash menu: operable entirely by keyboard (open, filter, arrow, Enter, Escape), labelled, focus
  managed; chip has an accessible name (its field label) and is keyboard-deletable.
- Profile form, selection bar, and gate dialog use Astryx primitives; verify focus order and
  visible focus.

## Design with `/impeccable` (while building, not after)

Build each custom surface *through* `/impeccable` in the same task, so structure and craft land
together: the profile page, the slash menu + chip, the contacts selection bar + undo toast, and
the missing-value gate. Do not defer design to a later polish pass. Keep all styling on Astryx
tokens (no raw hex/px), no em-dash in copy, and hold the slash menu + chip to WCAG 2.1 AA as
they are built.
