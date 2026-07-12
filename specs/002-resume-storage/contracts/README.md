# Contracts: Resume Storage

**Feature**: `002-resume-storage` | **Date**: 2026-07-11

This feature adds to the existing web application. It exposes one contract:

1. **[http-api.md](./http-api.md)** — the internal HTTP surface (Next.js route handlers)
   consumed by the app's own UI. Not a public API, but contract-tested (request/response
   shapes, status codes, auth requirements) so the UI and server stay in agreement. All
   inputs are validated with Zod (see `../data-model.md`); all endpoints require an
   authenticated session and operate only on the caller's own resumes (FR-014).

There is no separate provider-seam contract here (unlike `001-recruiter-outreach`'s
`email-provider.md`) — `lib/storage/r2-client.ts` is a plain wrapper, not a swappable
interface, since only one storage backend is in scope (see `../research.md` §2).

Conventions for the HTTP API:
- JSON responses, except the file-stream endpoint (`application/pdf`).
- `401` when unauthenticated; `404` when a scoped resource is not found or not owned;
  `422` for Zod validation failures (with field errors); `409` for conflicts
  (`label_taken`, `resume_limit_reached`).
- Timestamps are ISO-8601 UTC.
