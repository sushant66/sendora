# Contracts: Recruiter Outreach

**Feature**: `001-recruiter-outreach` | **Date**: 2026-07-11

This feature is a web application. It exposes two kinds of contract:

1. **[http-api.md](./http-api.md)** — the internal HTTP surface (Next.js route handlers /
   server actions) consumed by the app's own UI. These are not a public API, but they are
   contract-tested (request/response shapes, status codes, auth requirements) so the UI
   and server stay in agreement. All inputs are validated with Zod (see data-model.md);
   all endpoints require an authenticated session and operate only on the caller's data
   (FR-022).

2. **[email-provider.md](./email-provider.md)** — the `EmailProvider` seam that isolates
   provider specifics (FR-019c). Gmail is the only implementation in v1; this contract is
   what a future provider must satisfy.

Conventions for the HTTP API:
- JSON request/response bodies.
- `401` when unauthenticated; `403` when acting on another user's resource; `404` when a
  scoped resource is not found; `422` for Zod validation failures (with field errors);
  `409` for duplicate conflicts where relevant.
- Timestamps are ISO-8601 UTC.
