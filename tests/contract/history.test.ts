import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/** T066 [US5] — Contract test for GET /api/history and /api/history/recontact. */

vi.mock("@/lib/history/service", () => ({ listHistory: vi.fn(), getRecontactInfo: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(), getCurrentUser: vi.fn() }));

import { listHistory, getRecontactInfo } from "@/lib/history/service";
import { requireUser } from "@/lib/auth/session";
import { GET as HISTORY } from "@/app/api/history/route";
import { GET as RECONTACT } from "@/app/api/history/recontact/route";

const USER = { id: "u1", email: "u1@x.com", name: null, image: null };

function req(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"), { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(USER);
});

describe("GET /api/history", () => {
  it("returns send records with a nextCursor", async () => {
    vi.mocked(listHistory).mockResolvedValue({
      items: [
        {
          id: "s1", recipientEmail: "ada@x.com", contactId: "c1", subject: "Hi", templateName: "Intro",
          status: "sent", failureReason: null, sentAt: "2026-07-11T00:00:00.000Z", createdAt: "2026-07-11T00:00:00.000Z", batchId: "b1",
        },
      ],
      nextCursor: "cur2",
    });
    const res = await HISTORY(req("/api/history"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).toBe("cur2");
    expect(body.items[0]).toMatchObject({ recipientEmail: "ada@x.com", status: "sent", templateName: "Intro" });
  });

  it("passes the cursor through", async () => {
    vi.mocked(listHistory).mockResolvedValue({ items: [], nextCursor: null });
    await HISTORY(req("/api/history?cursor=abc"));
    expect(listHistory).toHaveBeenCalledWith("u1", { cursor: "abc" });
  });
});

describe("GET /api/history/recontact", () => {
  it("returns the previously-contacted subset", async () => {
    vi.mocked(getRecontactInfo).mockResolvedValue({
      previouslyContacted: [{ contactId: "c1", lastSentAt: "2026-07-10T00:00:00.000Z" }],
    });
    const res = await RECONTACT(req("/api/history/recontact?contactIds=c1,c2"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ previouslyContacted: [{ contactId: "c1", lastSentAt: "2026-07-10T00:00:00.000Z" }] });
    expect(getRecontactInfo).toHaveBeenCalledWith("u1", ["c1", "c2"]);
  });

  it("handles an empty contactIds param", async () => {
    vi.mocked(getRecontactInfo).mockResolvedValue({ previouslyContacted: [] });
    const res = await RECONTACT(req("/api/history/recontact?contactIds="));
    expect(res.status).toBe(200);
    expect(getRecontactInfo).toHaveBeenCalledWith("u1", []);
  });
});
