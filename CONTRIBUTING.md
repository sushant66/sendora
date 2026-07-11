# Contributing to Sendora

Sendora is built spec-first and governed by `.specify/memory/constitution.md`. Please read
the four core principles before contributing — reviewers enforce them.

## Non-negotiables

1. **Type safety & simplicity.** End-to-end TypeScript `strict`. No `any` — use `unknown` +
   narrowing. Every trust boundary (request bodies, query params, uploaded/pasted rows,
   OAuth data, env vars, provider responses) is validated at runtime with **Zod**, and the
   validated type flows through. Build the smallest thing that satisfies the requirement.
2. **Test-first (mandatory).** Write the test, watch it fail for the right reason, then
   implement. Product logic ships with tests; every user-facing flow has integration
   coverage in addition to unit tests. Do not weaken tests to make code pass.
3. **Accessibility by default.** WCAG 2.1 AA at build time — keyboard operability, visible
   focus, ≥4.5:1 contrast, correct roles and accessible names. Use Astryx's accessible
   primitives; custom interactive surfaces (e.g. the rich-text editor) meet the same bar.
4. **UX consistency via the design system.** All UI is composed from **Astryx** components
   and theme tokens — no ad-hoc colors, spacing, or typography. See `DESIGN.md`. When a
   pattern is missing, extend the system with a shared themed component, not a one-off.

## Workflow

Features follow specify → plan → tasks → implement (Spec Kit). Design docs live in
`specs/<feature>/`.

```bash
pnpm typecheck && pnpm lint && pnpm test    # must be green before a PR
pnpm test:e2e                               # for user-facing changes (needs app + DB)
```

## Conventions

- **Business logic in `lib/`**, free of framework/UI coupling and independently testable.
  Route handlers in `app/api/**` stay thin: authenticate, validate with Zod, delegate to a
  service, map the result. Services accept an optional `db`/`provider` for testability.
- **Data access** goes through the typed Drizzle layer (`lib/db`). Every user-owned query
  is scoped to the authenticated `userId` (FR-022). Schema changes ship with a generated
  migration (`pnpm db:generate`).
- **Sending** goes through the `EmailProvider` seam (`lib/email/provider.ts`). Add a
  provider by implementing the interface and a factory case — never call a provider API
  from the send flow directly.
- **Secrets** come from env vars only (validated by `EnvSchema`) and are never committed.
  Stored OAuth refresh tokens are encrypted at rest and never returned to the client.
- **Errors**: services throw domain errors (`lib/errors.ts`); the `route()` wrapper maps
  them to the HTTP contract in `specs/**/contracts/http-api.md`.

## Commit & PR

- Small, focused commits; reference the task id (e.g. `T047`) where relevant.
- A PR must pass the quality gates above and conform to the four principles. Reviewers will
  reject work that ships product logic without tests-first, bypasses the design system, or
  fails the accessibility bar.
