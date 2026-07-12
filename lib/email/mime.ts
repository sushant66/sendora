import type { OutgoingMessage } from "./provider";

/**
 * RFC 5322 message assembly for the Gmail API (User Story 2, research §4).
 * Pure and framework-free so it can be unit-tested without network access.
 */

function b64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

function isAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 127) return false;
  return true;
}

/** Encode a header value as an RFC 2047 encoded-word when it contains non-ASCII. */
function encodeHeaderWord(s: string): string {
  return isAscii(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
}

function formatFrom(fromEmail: string, fromName?: string): string {
  return fromName ? `${encodeHeaderWord(fromName)} <${fromEmail}>` : fromEmail;
}

/** The multipart/alternative sub-message (text + HTML), used standalone or nested. */
function alternativeLines(message: OutgoingMessage, boundary: string): string[] {
  return [
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(message.bodyText),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(message.bodyHtml),
    `--${boundary}--`,
    "",
  ];
}

/**
 * Build a base64url-encoded MIME message for `users.messages.send`: `multipart/alternative`
 * (text + HTML) when there's no attachment, or that same part nested inside an outer
 * `multipart/mixed` alongside the attachment when there is one (003-resume-attachments,
 * contracts/email-provider.md). `boundary`/`outerBoundary` are injectable for deterministic
 * tests.
 */
export function buildRawMessage(
  message: OutgoingMessage,
  boundary = "sendora-boundary",
  outerBoundary = "sendora-outer-boundary",
): string {
  const headers = [
    `From: ${formatFrom(message.fromEmail, message.fromName)}`,
    `To: ${message.to}`,
    `Subject: ${encodeHeaderWord(message.subject)}`,
    "MIME-Version: 1.0",
  ];

  if (!message.attachment) {
    const lines = [...headers, ...alternativeLines(message, boundary)];
    return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
  }

  const { attachment } = message;
  const lines = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${outerBoundary}"`,
    "",
    `--${outerBoundary}`,
    ...alternativeLines(message, boundary),
    `--${outerBoundary}`,
    `Content-Type: ${attachment.contentType}; name="${attachment.fileName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${attachment.fileName}"`,
    "",
    attachment.content.toString("base64"),
    `--${outerBoundary}--`,
    "",
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

/** Safely under Gmail's ~25MB raw-message limit (FR-011, research.md §6). */
export const MAX_RAW_MESSAGE_BYTES = 20 * 1024 * 1024;

/** Encoded byte length of the assembled message — the same string `sendEmail` transmits. */
export function rawMessageByteLength(message: OutgoingMessage): number {
  return Buffer.byteLength(buildRawMessage(message), "utf8");
}
