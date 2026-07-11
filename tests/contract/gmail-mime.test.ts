import { describe, it, expect } from "vitest";
import { buildRawMessage } from "@/lib/email/mime";
import type { OutgoingMessage } from "@/lib/email/provider";

/**
 * T034 [US2] — Gmail provider builds valid base64url multipart/alternative MIME
 * (per contracts/email-provider.md).
 */

function decode(raw: string): string {
  return Buffer.from(raw, "base64url").toString("utf8");
}

const MESSAGE: OutgoingMessage = {
  fromEmail: "seeker@gmail.com",
  fromName: "Job Seeker",
  to: "ada@analytical.io",
  subject: "Following up on the Lead Recruiter role",
  bodyHtml: "<p>Hi Ada,</p><p>Thanks for your time.</p>",
  bodyText: "Hi Ada,\n\nThanks for your time.",
};

describe("buildRawMessage", () => {
  it("produces base64url (no +/= characters)", () => {
    const raw = buildRawMessage(MESSAGE);
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("assembles the expected headers and both MIME parts", () => {
    const mime = decode(buildRawMessage(MESSAGE, "BOUND"));
    expect(mime).toContain("From: Job Seeker <seeker@gmail.com>");
    expect(mime).toContain("To: ada@analytical.io");
    expect(mime).toContain("Subject: Following up on the Lead Recruiter role");
    expect(mime).toContain('Content-Type: multipart/alternative; boundary="BOUND"');
    expect(mime).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(mime).toContain("Content-Type: text/html; charset=UTF-8");
    expect(mime).toContain("--BOUND--");
    expect(mime.split("\r\n").length).toBeGreaterThan(1); // CRLF line endings
  });

  it("base64-encodes each part so the content round-trips", () => {
    const mime = decode(buildRawMessage(MESSAGE, "BOUND"));
    const parts = mime.split("--BOUND");
    const textPart = parts.find((p) => p.includes("text/plain"))!;
    const htmlPart = parts.find((p) => p.includes("text/html"))!;
    const textPayload = textPart.trim().split("\r\n").pop()!;
    const htmlPayload = htmlPart.trim().split("\r\n").pop()!;
    expect(Buffer.from(textPayload, "base64").toString("utf8")).toBe(MESSAGE.bodyText);
    expect(Buffer.from(htmlPayload, "base64").toString("utf8")).toBe(MESSAGE.bodyHtml);
  });

  it("RFC 2047-encodes a non-ASCII subject", () => {
    const mime = decode(buildRawMessage({ ...MESSAGE, subject: "Café résumé" }, "BOUND"));
    expect(mime).toContain("Subject: =?UTF-8?B?");
  });
});
