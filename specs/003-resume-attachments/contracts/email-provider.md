# Contract Deltas: EmailProvider seam (attachment support)

**Feature**: `003-resume-attachments` | **Date**: 2026-07-12

Extends `001-recruiter-outreach/contracts/email-provider.md`. The seam stays
provider-agnostic and one-recipient-per-call; this feature adds an optional attachment
that every implementation must be able to carry.

## Interface delta (conceptual)

```ts
// lib/email/provider.ts
export interface OutgoingMessage {
  fromEmail: string;
  fromName?: string;
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  attachment?: {                 // NEW — optional, identical for every recipient in a batch
    fileName: string;
    contentType: "application/pdf"; // this feature only ever sends PDFs (out of scope: other types)
    content: Buffer;
  };
}
```

No other part of the `EmailProvider` interface changes: `sendEmail`'s signature, `SendResult`,
`ProviderCredentials`, and the "never throw on ordinary delivery failure" obligation are all
unchanged from 001.

## Contract obligations (delta)

- **Identical attachment per call in a batch** — the caller (`lib/send/service.ts`) passes
  the same `attachment` value to every `sendEmail` call for a given batch; the provider
  seam itself has no batch concept and does not need to know that.
- **No attachment present → byte-for-byte unchanged message** — when `attachment` is
  `undefined`, the assembled message MUST be identical to what today's implementation
  produces; this feature must not regress the existing MIME contract test.
- **Attachment present → nested `multipart/mixed`** — the assembled message wraps the
  existing `multipart/alternative` (text + HTML) part as one part of an outer
  `multipart/mixed`, with the attachment as a second part carrying
  `Content-Disposition: attachment; filename="<fileName>"` and
  `Content-Transfer-Encoding: base64`. See `research.md` §3 for why nesting (not a flat
  three-part `mixed`) is required.
- **Size is the caller's concern, not the provider's** — `sendEmail` itself does not
  enforce a size limit; `lib/send/service.ts` checks the assembled message size against
  the provider's known limit before calling `sendEmail` for any recipient (FR-011,
  research.md §6). A provider implementation is not required to pre-validate size itself,
  but MUST surface a provider-side rejection (if one occurs despite the pre-check) as an
  ordinary `SendResult` failure, never a thrown exception.

## Gmail implementation notes (delta)

- `buildRawMessage` (lib/email/mime.ts) gains the `multipart/mixed` branch described above,
  gated purely on whether `message.attachment` is present.
- No change to how `gmail-provider.ts` calls `users.messages.send` — it still passes
  whatever `buildRawMessage` returns as `requestBody.raw`; the attachment is entirely a
  MIME-assembly concern, invisible to the Gmail API call site.

## Test contract (delta)

- The existing MIME format contract test (no-attachment case) MUST continue to pass
  unmodified.
- A new unit test asserts: given `attachment` is present, `buildRawMessage` produces a
  valid base64url `multipart/mixed` message containing both the original
  `multipart/alternative` sub-message and a correctly-encoded attachment part with the
  expected headers.
- The fake `EmailProvider` used in send/resend unit and integration tests is extended to
  record the `attachment` it received per call, so tests can assert it was passed
  identically to every recipient in a batch (FR-003/FR-004).
