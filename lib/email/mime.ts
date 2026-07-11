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

/**
 * Build a base64url-encoded `multipart/alternative` MIME message (text + HTML) for
 * `users.messages.send`. `boundary` is injectable for deterministic tests.
 */
export function buildRawMessage(message: OutgoingMessage, boundary = "sendora-boundary"): string {
  const lines = [
    `From: ${formatFrom(message.fromEmail, message.fromName)}`,
    `To: ${message.to}`,
    `Subject: ${encodeHeaderWord(message.subject)}`,
    "MIME-Version: 1.0",
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
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}
