# Design

> **Enforced design system: Astryx.** This is not a from-scratch visual system. All UI is
> composed from [Astryx](https://astryx.design) components (`@astryxdesign/core`) and its
> theme tokens, per the Sendora Constitution (Principle IV) and `CLAUDE.md`. This document
> records **how we use Astryx** — the choices, constraints, and conventions that keep the
> product coherent. It does not invent colors, fonts, radii, or spacing; those come from
> Astryx tokens. When a value is needed, use a token. Never hard-code a hex/px.

## Theme

- **Base theme**: `@astryxdesign/theme-neutral` (`neutralTheme`), applied once in
  `app/layout.tsx` via `<Theme theme={neutralTheme} mode="system">`. Light + dark both
  ship; `mode="system"` follows the OS. Every color below is a `light-dark()` token, so
  dark mode is automatic — do not fork styles per mode.
- **Body background** `--color-background-body` (`#F1F4F7` light) is a cool neutral, not a
  warm cream — deliberately off the AI-cream default. **Surfaces** (`--color-background-surface`,
  `--color-background-card`, white) sit above it; the body/surface contrast is the primary
  way we separate the shell (nav, toolbars) from content.
- **Radius multiplier / density**: theme defaults. Do not override `--color-*` in `:root`;
  rebrand via `astryx theme` if ever needed.

## Color

Strategy: **Restrained** (product floor). A near-neutral surface, one accent, semantic
status colors used only to mean something.

- **Accent** `--color-accent` (`#0064E0`, a confident blue) is reserved for **primary
  actions, the current selection, and state indicators** — never decoration. Exactly one
  primary button per view.
- **Text**: `--color-text-primary` for body/headings, `--color-text-secondary` for
  supporting/metadata. Never drop body text below `--color-text-secondary` for contrast
  reasons (≥4.5:1 is required; secondary already meets it on our surfaces).
- **Status vocabulary** (standardized across the app):
  - `success` / `--color-*-green` → a `sent` email, a completed import.
  - `error` / `--color-*-red` → a `failed` send, a rejected import row.
  - `warning` / `--color-*-yellow` → re-contact warning, unresolved-merge-field warning,
    `expired` email account.
  - `--color-text-secondary` / gray → neutral/`pending` states.
- Use **StatusDot / Token** for status; **Badge** only for counts and enumerated states,
  never as decoration.

## Typography

- **One family.** `--font-family-body` (system sans stack) carries headings, labels,
  buttons, body, and data. No display/body pairing — this is product UI.
- **Fixed rem scale**, not fluid clamps. Base `--font-size-base` = 0.875rem (14px). Steps
  follow the theme's 1.2 geometric scale (`sm`/`base`/`lg`/`xl`/`2xl`/`3xl`). Use Astryx
  `Heading` (level 1–6) and `Text` — do not hand-size type.
- **Weights**: `--font-weight-normal` (400) body, `--font-weight-medium` (500) emphasis and
  UI labels, headings per component. Emphasis via weight/size, never color or gradient.
- Prose (help text, empty-state descriptions) stays ≤ ~70ch; tables and rows may run dense.

## Spacing & Layout

- **Spacing tokens only** (`--spacing-*`, 4px base). Astryx layout components take numeric
  `gap`/padding props that map to these — use them instead of raw margins.
- **No `<div>` for layout.** Compose with `AppShell`, `Layout`/`LayoutPanel`, `VStack`/
  `HStack`/`Stack`, `Grid`, `Section`, `FormLayout`, `Center`. (Constitution + CLAUDE.md.)
- **Frame**: authenticated app uses `AppShell` with `SideNav` (see `components/app-sidebar.tsx`);
  `contentPadding` budgeted on the shell, content regions sized in spacing tokens.
- **Density with air** (per PRODUCT.md principle 4):
  - Dense, edge-to-edge **rows** for scanning — contacts, sending history — via `Table`
    (`density="compact"`, `dividers="rows"`, `hasHover`). Never wrap list rows in Cards.
  - Spacious for decisions — compose, import confirm — more gap, `FormLayout`, room to read
    the preview.
- **Cards** only for genuine widgets/settings groups (e.g. the email-account panel). No
  nested cards. No identical card grids.

## Components (conventions)

Every interactive element ships all states Astryx provides — default, hover, focus, active,
disabled, loading, error — we don't hand-roll subsets.

- **Buttons**: one `variant="primary"` action per view; everything else `secondary`/
  `ghost`. Same button shape everywhere. Destructive actions confirm via `AlertDialog`.
- **Forms**: styled Astryx inputs (`TextInput`, `TextArea`, `Selector`, `FileInput`) carry
  their own label/description/validation — pass `status={{type:'error',message}}` for field
  errors; only use bare `Field` to wrap a custom control (e.g. the rich-text editor).
- **Empty states**: `EmptyState` with a specific title + a next-step action that **teaches
  the interface** ("No contacts yet — import a CSV or add one manually"), never "No data".
- **Loading**: `Skeleton` for content areas; `Spinner` only inside a control (button/input
  async). No spinner marooned in the middle of a page.
- **Feedback**: `Toast` for transient success ("Sent to 12 recruiters"); `Banner` for
  persistent, actionable conditions (no connected email account, import errors present).
- **Tables**: explicit column widths (`proportional()`/`pixel()`); rich cells (`Link` for
  emails, `StatusDot`/`Badge` for outcomes) via `renderCell` in a `"use client"` boundary.
- **Dialogs**: standard affordance for focused add/edit and confirmation. `purpose="form"`
  for input dialogs (no accidental backdrop dismiss). Not modal-first — prefer inline where
  the task allows; never nest dialogs.

## Motion

- Tokens only: `--duration-fast` (175ms) for most UI transitions, `--ease-standard`
  (`cubic-bezier(0.24,1,0.4,1)`, an ease-out — no bounce/elastic). Astryx components already
  animate on these; match them for any custom motion.
- Motion conveys **state** (open/close, selection, loading, per-recipient result landing),
  never decoration. No orchestrated page-load sequences — the app loads into a task.
- `prefers-reduced-motion: reduce` → crossfade/instant. Non-negotiable.

## Enforcement checklist (every UI change)

- [ ] Composed from Astryx components; no `<div>` doing layout, no raw hex/px.
- [ ] All values from tokens (`--color-*`, `--spacing-*`, `--radius-*`, `--duration-*`).
- [ ] Accent used only for primary/selected/state; one primary action per view.
- [ ] Full interactive states present; empty + error + loading states designed.
- [ ] Status uses the standardized vocabulary above.
- [ ] Keyboard-operable, labelled, ≥4.5:1 contrast, reduced-motion honored (WCAG 2.1 AA).
- [ ] `pnpm lint` (design-system rule) + `pnpm typecheck` clean.
