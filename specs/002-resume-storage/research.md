# Phase 0 Research: Resume Storage

**Feature**: `002-resume-storage` | **Date**: 2026-07-11

This document resolves the technical unknowns for the plan. Each decision records what was
chosen, why, and the alternatives considered. Decisions are constrained by the Sendora
Constitution v1.1.0 (type safety, simplicity, test-first, accessibility, Astryx design-
system consistency, plain copy) and the ratified stack (Next.js + Astryx + NeonDB).

## 1. Object storage for PDF bytes

- **Decision**: Cloudflare R2 (S3-compatible object storage), accessed through a small
  wrapper module (`lib/storage/r2-client.ts`) exposing `uploadObject` / `getObjectStream` /
  `deleteObject`. Objects are keyed `${userId}/${resumeId}.pdf`.
- **Rationale**: FR-010 requires retaining replaced resumes as archived history, and the
  spec's Assumptions explicitly defer any purge policy — so stored file volume grows
  unbounded per user over time. Keeping that growth off the primary NeonDB Postgres
  instance (used by every other feature) avoids bloating the OLTP database and its
  backups. R2 is S3-API-compatible, so a standard, well-understood client library applies
  without a Cloudflare-specific SDK.
- **Alternatives considered**: Postgres `bytea` column on the existing `resume` table
  (zero new infra) — rejected because unbounded archived history has no size ceiling and
  would degrade the shared database; a generic AWS S3 or another S3-compatible bucket —
  functionally equivalent, R2 chosen as the explicit product decision for this feature (see
  Complexity Tracking in `plan.md` for the stack-change justification either way).

## 2. Storage abstraction scope

- **Decision**: `lib/storage/r2-client.ts` is a plain wrapper, not a multi-provider seam
  (unlike `lib/email/provider.ts`). `lib/resumes/service.ts` is the only caller of the
  storage wrapper; a future feature (attaching a resume to an outreach email) depends on
  the service's `getResumeFile(userId, id)`, never on R2 directly.
- **Rationale**: Only one storage backend is in scope for this feature (Constitution
  Principle I: build the smallest thing that satisfies the requirement). A swappable
  provider interface would add indirection with no present benefit. The real seam this
  feature needs is future email attachment, not storage-provider portability — and that
  seam is the service function, not a storage interface.
- **Alternatives considered**: An `EmailProvider`-style `StorageProvider` interface with a
  factory — rejected as premature abstraction (YAGNI); nothing in the spec anticipates a
  second storage backend.

## 3. Content-based PDF validation

- **Decision**: Reject an upload unless its declared content-type is `application/pdf`
  **and** its first bytes match the PDF magic header (`%PDF-`). Enforced in the Zod schema
  for the upload (`lib/validation/resumes.ts`) via a custom refinement reading the file's
  leading bytes.
- **Rationale**: FR-002 requires content to be checked "regardless of the file's name or
  declared type." A client-supplied MIME type or a renamed `.pdf` extension is trivially
  spoofable; checking the actual byte signature is the standard, lightweight way to verify
  file type without a full PDF parse.
- **Alternatives considered**: Trusting the browser-supplied `content-type` alone
  (rejected — exactly what FR-002 rules out); full PDF structural parsing (rejected as
  disproportionate — this feature stores and serves files verbatim, it never reads or
  processes their contents).

## 4. Soft delete, version numbering, and label uniqueness

- **Decision**: The `resume` table carries `deletedAt` (null = active) and a `version`
  integer, monotonically increasing per `(userId, label)` and never reused, even across a
  full archive-then-reupload cycle. Label uniqueness is enforced with a **partial** unique
  index on `(userId, label)` scoped to `WHERE deleted_at IS NULL` — so an archived row never
  blocks a new upload reusing its label, but two simultaneously-active resumes can never
  share a label.
- **Rationale**: FR-005 requires uniqueness only among currently-active resumes; FR-010/
  FR-011 require retrievable, ordered history per label. A partial unique index enforces
  the active-only constraint at the database level (not just in application code), which
  is the more reliable and race-safe place for it (Edge Case: two near-simultaneous uploads
  of the same new label — the database index guarantees exactly one wins). The `version`
  column gives the history a stable, human-displayable ordinal independent of timestamp
  precision, satisfying FR-011's "in the order they were saved."
- **Alternatives considered**: Enforcing uniqueness only in application code (race-prone —
  two concurrent requests could both pass a check-then-insert); ordering history by
  `createdAt` alone with no `version` column (works, but gives the UI nothing better than a
  raw timestamp to display, which is a worse fit for the browsing experience in FR-011).

## 5. Restore semantics

- **Decision**: Restoring an archived resume clears its `deletedAt` and, in the same
  database transaction, archives whatever resume is currently active for that label (if
  any) by setting that row's `deletedAt`. Restoring never mints a new `version` — it
  reactivates the same row.
- **Rationale**: FR-012/FR-013 require that restoring a past version makes it active again
  while guaranteeing exactly one active resume per label at all times. Performing both
  writes in one transaction avoids a window where either zero or two resumes are active for
  the label. Because it's the same physical file being reactivated rather than a new
  upload, no new version number applies.
- **Alternatives considered**: Rejecting restore with a conflict error if a label
  currently has an active resume, forcing the user to delete it first — rejected as worse
  UX for a "revert to this version" action the spec explicitly wants to feel like a single
  step (US4).

## 6. Serving stored files (view/download)

- **Decision**: The PDF is streamed back through an authenticated route handler
  (`GET /api/resumes/[id]`) that checks ownership before reading from R2, rather than
  exposing a public bucket URL or a client-facing pre-signed URL.
- **Rationale**: FR-008 (open/download one's own resumes) and FR-014 (resumes are private)
  both require an ownership check on every access. A public or even briefly pre-signed URL
  would need its own expiry/security model and could leak if shared; proxying through the
  existing session-authenticated route reuses the auth check every other endpoint already
  has, for a feature at personal-utility scale where the extra hop's cost is negligible.
- **Alternatives considered**: Pre-signed R2 URLs handed to the client — rejected as
  unnecessary complexity (expiry handling, URL leakage surface) for this scale; a public
  bucket — rejected outright, violates FR-014.

## 7. Multipart upload handling

- **Decision**: The upload route reads the incoming request via the Web Platform
  `request.formData()` API (label field + file field), already supported by Next.js App
  Router route handlers with no extra multipart-parsing dependency.
- **Rationale**: Keeps the upload path dependency-free (Constitution Principle I:
  simplicity) — no third-party multipart parser needed for a single file + one text field.
- **Alternatives considered**: A dedicated multipart-parsing library — rejected as
  redundant; the platform API already covers this shape of request.

## 8. Environment & validation strategy

- **Decision**: New environment variables (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) are added to the existing `EnvSchema`
  (`lib/validation/env.ts`) and validated at startup exactly like the current Google OAuth
  and token-encryption variables. Label and file-metadata validation live in
  `lib/validation/resumes.ts`, following the existing per-domain Zod schema convention.
- **Rationale**: Directly continues Constitution Principle I's "every trust boundary is
  validated at runtime" with one source of truth per boundary; no new validation pattern is
  introduced.
- **Alternatives considered**: None — this is a direct extension of the existing pattern.

## 9. Testing tooling

- **Decision**: Vitest for unit tests (`lib/resumes/service.ts` against a fake storage
  client implementing the same three-function shape as `lib/storage/r2-client.ts`) and
  contract tests (request/response shapes vs `contracts/http-api.md`); Playwright for the
  integration user journeys (upload → list → download → delete → restore) and `@a11y`-
  tagged accessibility coverage of the `/resumes` page.
- **Rationale**: Principle II mandates test-first with integration coverage of every
  user-facing flow. The fake-storage-client pattern mirrors `lib/email/fake-provider.ts`
  exactly, so `lib/resumes/service.ts` is fully unit-testable without any real R2 calls.
- **Alternatives considered**: Hitting a real (test) R2 bucket in unit tests — rejected as
  slow, network-dependent, and unnecessary given the fake-client pattern already proven
  for the email provider seam.

## Open items intentionally deferred (not blocking)

- Attaching a saved resume to an outreach email (compose/send integration) — explicitly
  future work; this feature only keeps `getResumeFile` as the seam it will need.
- A data-retention or permanent-purge policy for archived resume history — accepted as
  unbounded for this version per the spec's Assumptions; revisit if storage growth becomes
  an operational concern.
- A predefined/curated label taxonomy — labels remain free text created by the user; no
  seeded list.
