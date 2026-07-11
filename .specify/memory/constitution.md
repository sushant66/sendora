<!--
Sync Impact Report
==================
Version change: [TEMPLATE / unversioned] → 1.0.0
Bump rationale: Initial ratification — first concrete constitution replacing the
                unfilled template. MAJOR baseline established.

Principles defined (4):
  - I.   Type Safety & Simplicity (new)
  - II.  Test-First (NON-NEGOTIABLE) (new)
  - III. Accessibility by Default (new)
  - IV.  UX Consistency via Design System (new)

Sections defined:
  - Technology Stack & Constraints (new)
  - Development Workflow & Quality Gates (new)
  - Governance (filled)

Templates reviewed:
  - .specify/templates/plan-template.md ....... ✅ aligned (Constitution Check gate
                                                  references constitution generically)
  - .specify/templates/spec-template.md ....... ✅ aligned (no principle-specific references)
  - .specify/templates/tasks-template.md ...... ✅ aligned (no principle-specific references)

Deferred / follow-up TODOs:
  - Deliverability & anti-spam compliance (CAN-SPAM/GDPR) and Data Privacy & PII
    protection were intentionally NOT ratified as principles at this time. Recommend
    revisiting before the first production sending feature ships — see Governance.
-->

# Sendora Constitution

Sendora is a cold-email outreach SaaS for job seekers: bulk contact import, email
sending, email templating, and resume versioning. This constitution defines the
non-negotiable engineering principles that govern how the product is built.

## Core Principles

### I. Type Safety & Simplicity

The codebase MUST be end-to-end TypeScript with `strict` mode enabled. Code MUST NOT
use `any` to bypass the type system; where a type is genuinely unknown, use `unknown`
and narrow explicitly. Data crossing a trust boundary (HTTP request bodies, query
params, environment variables, third-party API responses, database rows) MUST be
validated at runtime, and the validated type MUST flow through the rest of the code.

Simplicity is a feature. Build the smallest thing that satisfies the current
requirement (YAGNI); do not add abstraction, configuration, or indirection for
hypothetical future needs. Any deviation that adds structural complexity MUST be
justified in the plan's Complexity Tracking table.

**Rationale**: Contact lists and resumes flow through the system as structured data;
type errors here become silent data corruption or send failures. Simple code is
cheaper to test, audit, and change as the feature set grows.

### II. Test-First (NON-NEGOTIABLE)

Test-Driven Development is mandatory for all product logic. The cycle is strict:
write the test → confirm it fails for the right reason → implement until it passes →
refactor. Tests MUST be authored before the implementation they cover, and MUST NOT
be written or weakened after the fact to make failing code pass.

Every user-facing flow (import, send, template rendering, resume versioning) MUST
have integration coverage in addition to unit tests. A feature is not "done" until
its tests exist, pass, and meaningfully exercise its behavior — not merely its happy
path.

**Rationale**: Sending email is irreversible and user-visible. Tests written first
force the contract to be defined before the implementation, and guard against
regressions in flows that directly touch a job seeker's reputation.

### III. Accessibility by Default

Every user-facing interface MUST meet WCAG 2.1 AA. Accessibility is a build-time
requirement, not a later remediation: keyboard operability, visible focus, sufficient
color contrast, correct semantic roles, and accessible names MUST be present when a
component ships. Astryx's accessible primitives MUST be used as the default building
blocks; custom interactive elements MUST replicate the same accessibility guarantees
and are held to the same bar in review.

**Rationale**: Sendora's users are job seekers under stress, on varied devices and
assistive technologies. An inaccessible flow is a broken flow. Building on Astryx's
accessible components makes the compliant path the path of least resistance.

### IV. UX Consistency via Design System

All UI MUST be composed from Astryx components and its theme tokens. Ad-hoc one-off
styling, hard-coded colors, spacing, or typography that bypass the design system are
NOT permitted; spacing, color, dark-mode, and typographic decisions MUST come from
Astryx tokens. When a needed pattern does not exist in the system, extend the system
(a shared, themed, reusable component) rather than introducing a local exception.

**Rationale**: A consistent, themeable surface keeps the product coherent as features
multiply, makes dark mode and rebranding trivial, and prevents the visual drift that
one-off styles accumulate over time.

## Technology Stack & Constraints

The ratified stack is fixed unless amended through Governance:

- **Framework**: Next.js (React, TypeScript).
- **UI / Design System**: Astryx (React + StyleX). All UI is built from its
  components and themes (see Principle IV).
- **Database**: NeonDB (serverless PostgreSQL). Schema access MUST go through a typed
  data layer; raw, unvalidated query results MUST NOT leak into application code.

Additional constraints:

- Secrets and connection strings MUST be provided via environment variables and MUST
  NOT be committed to the repository.
- Introducing a new runtime dependency, external service, or datastore is a stack
  change and requires an amendment (or, at minimum, explicit justification in the
  feature plan) rather than an ad-hoc addition.

## Development Workflow & Quality Gates

- **Spec-driven flow**: Features proceed through specify → plan → tasks →
  implement. The plan's Constitution Check gate MUST pass before implementation
  begins and be re-checked after design.
- **Quality gates before merge**: TypeScript type-check passes with zero errors;
  all tests (unit + integration) pass; the change conforms to the four Core
  Principles. A change that violates a principle MUST NOT merge until the violation
  is removed or justified in Complexity Tracking.
- **Reviews**: Every change is reviewed against this constitution. Reviewers MUST
  reject work that ships product logic without tests-first, that bypasses the design
  system, or that fails the accessibility bar.

## Governance

This constitution supersedes all other engineering practices for Sendora. Where a
convention conflicts with a principle here, the principle wins.

- **Amendments**: Changes to this constitution MUST be proposed as a documented
  change, reviewed, and merged deliberately. Each amendment MUST update the version
  and the Sync Impact Report, and propagate any required changes to dependent
  templates (`plan`, `spec`, `tasks`).
- **Versioning policy** (semantic):
  - **MAJOR**: Backward-incompatible governance changes — removing or redefining a
    principle.
  - **MINOR**: Adding a new principle or section, or materially expanding guidance.
  - **PATCH**: Clarifications and wording fixes with no semantic change.
- **Compliance review**: The Constitution Check in the plan template is the routine
  enforcement point; all PRs are expected to verify compliance. Complexity that
  deviates from Principle I MUST be justified, not hidden.
- **Recommended review trigger**: Before the first production email-sending feature
  ships, formally evaluate ratifying Deliverability & Anti-Spam Compliance
  (CAN-SPAM/GDPR, unsubscribe handling, sending-rate/reputation safeguards) and Data
  Privacy & PII Protection (encryption, least-privilege access, retention limits) as
  first-class principles.

**Version**: 1.0.0 | **Ratified**: 2026-07-11 | **Last Amended**: 2026-07-11
