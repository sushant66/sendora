import { describe, it, expect } from "vitest";
import { runSendLoop, streamToBuffer, type Recipient } from "@/lib/send/service";
import { FakeEmailProvider } from "@/lib/email/fake-provider";
import { FakeResumeStorage } from "@/lib/storage/fake-r2-client";

/**
 * 003-resume-attachments T005 — the DB-free pieces of attachment support: the
 * resume-stream-to-Buffer helper and runSendLoop threading the same attachment to every
 * recipient (FR-004). `sendEmails`'s own ownership/active-status wiring is DB-dependent
 * and covered by e2e (T007) instead, matching this repo's existing convention (see
 * 002-resume-storage's tasks.md notes).
 */

const BASE = { subject: "Hi {{first_name}}", bodyHtml: "<p>Hi {{first_name}}</p>", bodyText: "Hi {{first_name}}" };
const FROM = { email: "seeker@gmail.com", name: "Job Seeker" };
const CREDS = { accessToken: "a", refreshToken: "r" };

function recipient(id: string, email: string, name = "Ada Lovelace"): Recipient {
  return { id, name, email, company: "Acme", role: "Recruiter" };
}

describe("streamToBuffer", () => {
  it("drains a ReadableStream into an equivalent Buffer", async () => {
    const storage = new FakeResumeStorage();
    await storage.uploadObject("u1/r1.pdf", Buffer.from("%PDF-1.7\nhello"), "application/pdf");
    const object = await storage.getObjectStream("u1/r1.pdf");
    const buffer = await streamToBuffer(object!.body);
    expect(buffer.toString("utf8")).toBe("%PDF-1.7\nhello");
  });
});

describe("runSendLoop with an attachment", () => {
  it("passes the identical attachment to every recipient's sendEmail call (FR-003/FR-004)", async () => {
    const provider = new FakeEmailProvider();
    const attachment = { fileName: "backend-engineer.pdf", contentType: "application/pdf" as const, content: Buffer.from("%PDF-1.7\nfake") };
    await runSendLoop(
      [recipient("a", "ada@x.com"), recipient("b", "bo@x.com")],
      BASE,
      FROM,
      provider,
      CREDS,
      undefined,
      undefined,
      attachment,
    );
    expect(provider.sent).toHaveLength(2);
    expect(provider.sent[0]!.message.attachment).toBe(attachment);
    expect(provider.sent[1]!.message.attachment).toBe(attachment);
  });

  it("omits attachment entirely when none is given (unchanged behavior)", async () => {
    const provider = new FakeEmailProvider();
    await runSendLoop([recipient("a", "ada@x.com")], BASE, FROM, provider, CREDS);
    expect(provider.sent[0]!.message.attachment).toBeUndefined();
  });
});
