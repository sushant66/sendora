import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeEmailProvider } from "@/lib/email/fake-provider";
import { buildStarterTemplates } from "@/lib/templates/starters";
import { makeProfile } from "@/tests/factories/profile";

/**
 * T032 [US3] — a test send creates NO send_batch / send_record rows (FR-015), renders with a
 * clear test marker, and resolves sender fields; and the starter templates no longer promise
 * an attachment (FR-017). Collaborators are mocked; a db spy proves nothing is persisted.
 */

vi.mock("@/lib/email/account-service", () => ({ getActiveAccount: vi.fn() }));
vi.mock("@/lib/templates/preview", () => ({ resolveContent: vi.fn() }));
vi.mock("@/lib/profile/service", () => ({ getProfile: vi.fn() }));
vi.mock("@/lib/send/service", () => ({ resolveAttachment: vi.fn() }));

import { getActiveAccount } from "@/lib/email/account-service";
import { resolveContent } from "@/lib/templates/preview";
import { getProfile } from "@/lib/profile/service";
import { resolveAttachment } from "@/lib/send/service";
import { sendTestEmail } from "@/lib/send/test-send";

const ACCOUNT = {
  row: { id: "acc1", emailAddress: "seeker@gmail.com" },
  providerKey: "fake",
  credentials: { accessToken: "a", refreshToken: "r" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveAccount).mockResolvedValue(ACCOUNT as any);
  vi.mocked(resolveContent).mockResolvedValue({
    subject: "Hi {{first_name}}, I'm {{my_name}}",
    bodyHtml: "<p>Hi {{first_name}}</p>",
    bodyText: "Hi {{first_name}}",
  });
  vi.mocked(getProfile).mockResolvedValue(makeProfile());
});

describe("sendTestEmail", () => {
  it("sends to the user's own address, marks the subject as a test, and persists nothing", async () => {
    const provider = new FakeEmailProvider();
    const insert = vi.fn(() => {
      throw new Error("a test send must not write records");
    });
    const result = await sendTestEmail(
      "u1",
      { override: { subject: "Hi {{first_name}}, I'm {{my_name}}", bodyHtml: "<p>Hi {{first_name}}</p>" } },
      "Ada",
      { provider, db: { insert } as any },
    );

    expect(result).toEqual({ status: "sent", toEmail: "seeker@gmail.com" });
    expect(insert).not.toHaveBeenCalled();
    expect(provider.sent).toHaveLength(1);
    const sent = provider.sent[0]!.message;
    expect(sent.to).toBe("seeker@gmail.com");
    // Clear test marker in the delivered subject; sender field resolved.
    expect(sent.subject).toMatch(/test/i);
    expect(sent.subject).toContain("Ada Lovelace");
    expect(sent.subject).not.toMatch(/\{\{/);
  });

  it("attaches the selected resume so a test mirrors the real send (003-resume-attachments)", async () => {
    const provider = new FakeEmailProvider();
    const attachment = { fileName: "Ada - Backend.pdf", contentType: "application/pdf" as const, content: Buffer.from("%PDF-1.7") };
    vi.mocked(resolveAttachment).mockResolvedValue(attachment);

    await sendTestEmail(
      "u1",
      { override: { subject: "Hi {{first_name}}", bodyHtml: "<p>Hi</p>" }, resumeId: "r1" },
      "Ada",
      { provider, db: { insert: vi.fn() } as any },
    );

    expect(resolveAttachment).toHaveBeenCalledWith("u1", "r1", expect.anything(), undefined);
    expect(provider.sent[0]!.message.attachment).toEqual(attachment);
  });

  it("sends no attachment when no resume is selected", async () => {
    const provider = new FakeEmailProvider();
    await sendTestEmail(
      "u1",
      { override: { subject: "Hi", bodyHtml: "<p>Hi</p>" } },
      "Ada",
      { provider, db: { insert: vi.fn() } as any },
    );
    expect(resolveAttachment).not.toHaveBeenCalled();
    expect(provider.sent[0]!.message.attachment).toBeUndefined();
  });

  it("returns a failure reason when the provider rejects (still no records)", async () => {
    const provider = new FakeEmailProvider(() => ({ status: "failed", reason: "nope", retryable: false }));
    const insert = vi.fn();
    const result = await sendTestEmail(
      "u1",
      { templateId: "t1" },
      "Ada",
      { provider, db: { insert } as any },
    );
    expect(result.status).toBe("failed");
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("starter templates (FR-017)", () => {
  it("no starter promises an attachment", () => {
    for (const t of buildStarterTemplates()) {
      expect(t.bodyHtml.toLowerCase()).not.toContain("attach");
      expect(t.bodyText.toLowerCase()).not.toContain("attach");
    }
  });
});
