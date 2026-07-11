import { describe, it, expect } from "vitest";
import { runSendLoop, type Recipient } from "@/lib/send/service";
import { FakeEmailProvider, fakeProviderFailing } from "@/lib/email/fake-provider";
import { REAUTH_REQUIRED } from "@/lib/email/provider";

/**
 * T061 [US4] — partial failure preserves successful sends (fake provider, FR-018), and a
 * mid-batch reauth failure fails the remaining recipients (FR-019b). Exercises the pure
 * send loop directly, no DB/network.
 */

const BASE = { subject: "Hi {{first_name}} at {{company}}", bodyHtml: "<p>Hi {{first_name}}</p>", bodyText: "Hi {{first_name}}" };
const FROM = { email: "seeker@gmail.com", name: "Job Seeker" };
const CREDS = { accessToken: "a", refreshToken: "r" };

function recipient(id: string, email: string, name = "Ada Lovelace", company = "Acme"): Recipient {
  return { id, name, email, company, role: "Recruiter" };
}

describe("runSendLoop", () => {
  it("renders per recipient and sends one message each (merge resolved, no literal token)", async () => {
    const provider = new FakeEmailProvider();
    const out = await runSendLoop(
      [recipient("a", "ada@x.com", "Ada Lovelace", "Acme"), recipient("b", "bo@x.com", "Bo North", "Globex")],
      BASE,
      FROM,
      provider,
      CREDS,
    );
    expect(out.every((r) => r.status === "sent")).toBe(true);
    expect(provider.sent).toHaveLength(2);
    expect(provider.sent[0]!.message.subject).toBe("Hi Ada at Acme");
    expect(provider.sent[0]!.message.to).toBe("ada@x.com");
    expect(out.some((r) => /\{\{/.test(r.bodyHtml))).toBe(false);
  });

  it("keeps successful sends when one recipient fails (FR-018)", async () => {
    const provider = fakeProviderFailing((to) => to === "bad@x.com", "invalid address");
    const out = await runSendLoop(
      [recipient("a", "ok@x.com"), recipient("b", "bad@x.com"), recipient("c", "ok2@x.com")],
      BASE,
      FROM,
      provider,
      CREDS,
    );
    expect(out.map((r) => r.status)).toEqual(["sent", "failed", "sent"]);
    expect(out[1]!.reason).toBe("invalid address");
    expect(out.filter((r) => r.status === "sent")).toHaveLength(2);
  });

  it("fails remaining recipients and triggers reauth handling after a reauth failure (FR-019b)", async () => {
    let reauthCalls = 0;
    const provider = new FakeEmailProvider((_m, i) =>
      i === 1 ? { status: "failed", reason: REAUTH_REQUIRED, retryable: false } : { status: "sent", providerMessageId: `id-${i}` },
    );
    const out = await runSendLoop(
      [recipient("a", "1@x.com"), recipient("b", "2@x.com"), recipient("c", "3@x.com")],
      BASE,
      FROM,
      provider,
      CREDS,
      () => { reauthCalls++; },
    );
    expect(out.map((r) => r.status)).toEqual(["sent", "failed", "failed"]);
    expect(out[1]!.reason).toBe(REAUTH_REQUIRED);
    expect(out[2]!.reason).toBe(REAUTH_REQUIRED);
    // No provider call for the 3rd recipient once the account is disabled.
    expect(provider.sent).toHaveLength(2);
    expect(reauthCalls).toBe(1);
  });
});
