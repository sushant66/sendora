/**
 * Provider-agnostic sending seam (User Story 2, FR-019c).
 * See specs/001-recruiter-outreach/contracts/email-provider.md.
 *
 * Gmail is the only implementation in v1. A future provider (Outlook/Graph, SMTP) is a
 * new file implementing this interface plus a factory case — the send flow, batching, and
 * per-recipient result handling stay provider-independent.
 */

export type ProviderKey = "gmail"; // future: | "outlook" | "smtp"

export interface OutgoingMessage {
  fromEmail: string; // the connected account's address
  fromName?: string;
  to: string; // one recipient (one message per recruiter — FR-015)
  subject: string; // already merge-resolved, no literal {{token}} (SC-004)
  bodyHtml: string; // sanitized rich-text HTML
  bodyText: string; // plain-text alternative (multipart/alternative)
  /** 003-resume-attachments: identical for every recipient in a batch (FR-003/FR-004). */
  attachment?: {
    fileName: string;
    contentType: "application/pdf"; // only PDFs are in scope (spec: out of scope for other types)
    content: Buffer;
  };
}

export interface ProviderCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt?: Date;
}

export type SendResult =
  | { status: "sent"; providerMessageId: string }
  | { status: "failed"; reason: string; retryable: boolean };

/** Sentinel reason meaning the account must be re-authorized (maps to status expired/revoked). */
export const REAUTH_REQUIRED = "reauthorization_required";

export interface EmailProvider {
  readonly key: ProviderKey;
  /**
   * Send exactly one message to one recipient. MUST NOT throw for a normal delivery
   * failure — return { status: "failed", reason }. MUST refresh the access token from the
   * refresh token when expired, or return a failure whose reason is {@link REAUTH_REQUIRED}
   * (FR-019b).
   */
  sendEmail(message: OutgoingMessage, creds: ProviderCredentials): Promise<SendResult>;
}
