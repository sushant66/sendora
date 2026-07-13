# Contracts: Resume Attachments

**Feature**: `003-resume-attachments` | **Date**: 2026-07-12

This feature extends two existing contracts rather than introducing new endpoints or a new
provider seam:

1. **[http-api.md](./http-api.md)** — deltas to the existing internal HTTP surface:
   `POST /api/send` gains an optional `resumeId`; the History endpoints gain an
   `attachedResume` field; the resume upload/replace endpoints gain an optional `fileName`
   field. Endpoints and shapes not listed here are unchanged from
   `001-recruiter-outreach/contracts/http-api.md` and
   `002-resume-storage/contracts/http-api.md`.
2. **[email-provider.md](./email-provider.md)** — deltas to the existing `EmailProvider`
   seam (`001-recruiter-outreach/contracts/email-provider.md`): `OutgoingMessage` gains an
   optional `attachment`, and the Gmail implementation's MIME assembly gains a
   `multipart/mixed` shape used only when one is present.

Conventions (unchanged from 001/002): JSON responses except the resume file-stream
endpoint; `401` unauthenticated; `404` for a scoped resource not found or not owned; `422`
for Zod validation failures; `409` for conflicts. Timestamps are ISO-8601 UTC.
