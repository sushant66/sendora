import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { HistoryDetail, HistoryEvent, HistoryRecord } from "@/lib/history/types";

/** T066 [US5] — Contract tests for the history endpoints (list, detail, batch, resend, recontact). */

vi.mock("@/lib/history/service", () => ({
  listHistory: vi.fn(),
  getRecontactInfo: vi.fn(),
  getHistoryDetail: vi.fn(),
  getBatchRecords: vi.fn(),
}));
vi.mock("@/lib/send/service", () => ({ resendRecord: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(), getCurrentUser: vi.fn() }));

import { listHistory, getRecontactInfo, getHistoryDetail, getBatchRecords } from "@/lib/history/service";
import { resendRecord } from "@/lib/send/service";
import { requireUser } from "@/lib/auth/session";
import { GET as HISTORY } from "@/app/api/history/route";
import { GET as RECONTACT } from "@/app/api/history/recontact/route";
import { GET as DETAIL } from "@/app/api/history/[id]/route";
import { POST as RESEND } from "@/app/api/history/[id]/resend/route";
import { GET as BATCH } from "@/app/api/history/batch/[batchId]/route";

const USER = { id: "u1", email: "u1@x.com", name: null, image: null };

const RECORD: HistoryRecord = {
  id: "s1",
  recipientName: "Ada Lovelace",
  recipientEmail: "ada@x.com",
  contactId: "c1",
  subject: "Hi",
  status: "sent",
  failureReason: null,
  sentAt: "2026-07-11T00:00:00.000Z",
  createdAt: "2026-07-11T00:00:00.000Z",
};

function req(url: string, method = "GET"): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"), { method });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(USER);
});

describe("GET /api/history", () => {
  it("returns send events with a nextCursor", async () => {
    const event: HistoryEvent = { id: "b1", kind: "single", when: RECORD.createdAt, total: 1, sent: 1, failed: 0, record: RECORD };
    vi.mocked(listHistory).mockResolvedValue({ items: [event], nextCursor: "cur2" });
    const res = await HISTORY(req("/api/history"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).toBe("cur2");
    expect(body.items[0]).toMatchObject({ id: "b1", kind: "single" });
    expect(body.items[0].record).toMatchObject({ recipientEmail: "ada@x.com", status: "sent" });
  });

  it("passes the cursor through", async () => {
    vi.mocked(listHistory).mockResolvedValue({ items: [], nextCursor: null });
    await HISTORY(req("/api/history?cursor=abc"));
    expect(listHistory).toHaveBeenCalledWith("u1", { cursor: "abc" });
  });
});

describe("GET /api/history/:id", () => {
  it("returns the full snapshot", async () => {
    const detail: HistoryDetail = {
      ...RECORD,
      bodyHtml: "<p>Hello</p>",
      bodyText: "Hello",
      fromEmail: "u1@gmail.com",
      batch: { id: "b1", kind: "single", total: 1, sent: 1, failed: 0 },
    };
    vi.mocked(getHistoryDetail).mockResolvedValue(detail);
    const res = await DETAIL(req("/api/history/s1"), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: "s1", bodyHtml: "<p>Hello</p>", fromEmail: "u1@gmail.com" });
    expect(getHistoryDetail).toHaveBeenCalledWith("u1", "s1");
  });

  it("404s when the record isn't the caller's", async () => {
    vi.mocked(getHistoryDetail).mockResolvedValue(null);
    const res = await DETAIL(req("/api/history/nope"), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/history/batch/:batchId", () => {
  it("returns the per-recipient records", async () => {
    vi.mocked(getBatchRecords).mockResolvedValue({ records: [RECORD] });
    const res = await BATCH(req("/api/history/batch/b1"), { params: Promise.resolve({ batchId: "b1" }) });
    expect(res.status).toBe(200);
    expect((await res.json()).records).toHaveLength(1);
    expect(getBatchRecords).toHaveBeenCalledWith("u1", "b1");
  });
});

describe("POST /api/history/:id/resend", () => {
  it("resends and returns the new record outcome", async () => {
    vi.mocked(resendRecord).mockResolvedValue({ recordId: "s2", status: "sent", reason: null });
    const res = await RESEND(req("/api/history/s1/resend", "POST"), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recordId: "s2", status: "sent", reason: null });
    expect(resendRecord).toHaveBeenCalledWith("u1", "s1", null);
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
