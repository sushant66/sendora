import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/** T059 [US4] — Contract test for bulk POST /api/send (per-recipient results, partial failure). */

vi.mock("@/lib/send/service", () => ({ sendEmails: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(), getCurrentUser: vi.fn() }));

import { sendEmails } from "@/lib/send/service";
import { requireUser } from "@/lib/auth/session";
import { POST as SEND } from "@/app/api/send/route";

const USER = { id: "u1", email: "u1@x.com", name: "Job Seeker", image: null };

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest(new URL("/api/send", "http://localhost"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(USER);
});

describe("POST /api/send (bulk)", () => {
  it("returns an aggregate + per-recipient summary with a partial failure", async () => {
    vi.mocked(sendEmails).mockResolvedValue({
      batchId: "b1",
      total: 3,
      sent: 2,
      failed: 1,
      results: [
        { contactId: "c1", recipientEmail: "a@x.com", status: "sent" },
        { contactId: "c2", recipientEmail: "b@x.com", status: "failed", reason: "invalid address" },
        { contactId: "c3", recipientEmail: "c@x.com", status: "sent" },
      ],
    });
    const res = await SEND(jsonRequest({ contactIds: ["c1", "c2", "c3", "c3"], templateId: "t1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ batchId: "b1", total: 3, sent: 2, failed: 1 });
    expect(body.results).toHaveLength(3);
    expect(body.results[1]).toMatchObject({ status: "failed", reason: "invalid address" });
    expect(sendEmails).toHaveBeenCalledWith("u1", { contactIds: ["c1", "c2", "c3", "c3"], templateId: "t1" }, "Job Seeker");
  });

  it("422 when more than 200 recipients are provided", async () => {
    const tooMany = Array.from({ length: 201 }, (_, i) => `c${i}`);
    const res = await SEND(jsonRequest({ contactIds: tooMany, templateId: "t1" }));
    expect(res.status).toBe(422);
  });
});
