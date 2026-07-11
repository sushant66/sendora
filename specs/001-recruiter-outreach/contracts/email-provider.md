# Contract: EmailProvider seam

**Feature**: `001-recruiter-outreach` | **Date**: 2026-07-11

The `EmailProvider` interface isolates all provider-specific sending so the send flow,
bulk batching, and per-recipient result handling are provider-independent (FR-019c).
Gmail is the only implementation in v1. A future provider (Outlook via Microsoft Graph,
or generic SMTP) is added by implementing this interface and registering it in the
factory — with no change to contacts, templates, or the send flow.

## Interface (conceptual)

```ts
// lib/email/provider.ts
export type ProviderKey = "gmail"; // future: | "outlook" | "smtp"

export interface OutgoingMessage {
  fromEmail: string;      // the connected account's address
  fromName?: string;
  to: string;             // one recipient (one message per recruiter — FR-015)
  subject: string;        // already merge-resolved, no literal {{token}} (SC-004)
  bodyHtml: string;       // sanitized rich-text HTML
  bodyText: string;       // plain-text alternative (multipart/alternative)
}

export interface ProviderCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt?: Date;
}

export type SendResult =
  | { status: "sent"; providerMessageId: string }
  | { status: "failed"; reason: string; retryable: boolean };

export interface EmailProvider {
  readonly key: ProviderKey;
  /** Send exactly one message to one recipient. MUST NOT throw for a normal
   *  delivery failure — return { status: "failed", reason }. MUST refresh the
   *  access token from the refresh token when expired, or return a failure whose
   *  reason indicates re-authorization is required (maps to account status
   *  `expired`/`revoked`, FR-019b). */
  sendEmail(message: OutgoingMessage, creds: ProviderCredentials): Promise<SendResult>;
}
```

## Contract obligations

- **One recipient per call** — enforces FR-015 (each recruiter gets a separate email; no
  recipient disclosure). Bulk is the caller iterating, not the provider fanning out.
- **No throwing on delivery failure** — ordinary failures (bad address, quota exceeded,
  transient provider error) return `{ status: "failed", reason, retryable }` so the batch
  can record per-recipient outcomes and continue (FR-017, FR-018). Only programmer errors
  (invalid arguments) may throw.
- **Token lifecycle** — the provider refreshes an expired access token using the refresh
  token; if refresh fails (revoked/expired), it returns a failure whose `reason` signals
  re-authorization, which the caller maps to `ConnectedEmailAccount.status` (FR-019b).
- **Content is pre-rendered and pre-sanitized** — the provider does not do merge
  resolution or sanitization; it receives final `subject`/`bodyHtml`/`bodyText` and
  assembles the transport message (for Gmail: a base64url MIME `multipart/alternative`).
- **`retryable`** — advisory flag distinguishing transient failures (e.g. rate limit)
  from permanent ones (e.g. invalid address). v1 does not auto-retry; the flag informs
  future queue/retry work.

## Gmail implementation notes (v1)

- Uses the Gmail API `users.messages.send` with the `gmail.send` scope only.
- Builds an RFC 5322 `multipart/alternative` message (text + sanitized HTML),
  base64url-encoded per the API.
- Maps Gmail API errors → `SendResult.reason`; `401/invalid_grant` → non-retryable
  re-authorization failure (account → `expired`/`revoked`).

## Test contract

- A **fake `EmailProvider`** is used in unit/integration tests to exercise the send flow,
  batching, dedup, and per-recipient result handling without network access.
- One **format contract test** asserts the Gmail implementation produces a valid
  base64url `multipart/alternative` MIME message with the expected headers and both parts.
