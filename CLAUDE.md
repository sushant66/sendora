<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/001-recruiter-outreach/plan.md`

Active feature: **Recruiter Outreach** (`001-recruiter-outreach`).
Stack: Next.js (App Router, TS strict) + Astryx (React/StyleX) + NeonDB (Drizzle ORM);
Auth.js + Google OAuth (`gmail.send`); sending behind a provider-agnostic seam.
Design docs live in `specs/001-recruiter-outreach/` (spec, plan, research, data-model,
contracts/, quickstart). Constitution: `.specify/memory/constitution.md`.
<!-- SPECKIT END -->

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
- Custom styling: component props first; else style/className with tokens — var(--color-*|--spacing-*|--radius-*). No raw hex/px. (No StyleX/Tailwind compiler here — don't use xstyle/utility classes.)
- Tokens for every value (`astryx docs tokens`). Brand/accent live in our own theme at `lib/theme/neutralTheme.ts` (accent = warm gold). Edit that file, then `pnpm theme:build` to regenerate `lib/theme/neutral.{css,js}` (the app imports the built file; the source is client-only). Never override --color-* in :root.
- Copy: no em-dashes (`—`) in any user-facing text or sent email content (Constitution V). Rewrite with a period, comma, connective, colon, or parentheses. Plain and human, never hype. (Applies to rendered copy and email bodies, not code comments.)

MORE CLI:
  search "<query>"   find any component / hook / doc / template / block
  component --list   149 components by category
  template --list    page + block recipes
  docs <topic>       color, elevation, icons, illustrations, layout, migration, motion, principles, shape, spacing, styling, theme, tokens, typography
  swizzle <Name>     eject component source for deep customization
  upgrade --apply    run after any @astryxdesign/core bump
<!-- ASTRYX:END -->
