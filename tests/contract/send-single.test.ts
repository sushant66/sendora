import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError, NotFoundError } from "@/lib/errors";

/** T032 [US2] — Contract test for /api/templates/preview and single POST /api/send. */

vi.mock("@/lib/templates/preview", () => ({ previewTemplate: vi.fn() }));
vi.mock("@/lib/send/service", () => ({ sendEmails: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(), getCurrentUser: vi.fn() }));

import { previewTemplate } from "@/lib/templates/preview";
import { sendEmails } from "@/lib/send/service";
import { requireUser } from "@/lib/auth/session";
import { POST as PREVIEW } from "@/app/api/templates/preview/route";
import { POST as SEND } from "@/app/api/send/route";

const USER = { id: "u1", email: "u1@x.com", name: "Job Seeker", image: null };

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(USER);
});

describe("POST /api/templates/preview", () => {
  it("returns rendered subject/body/warnings", async () => {
    vi.mocked(previewTemplate).mockResolvedValue({
      subject: "Role at Acme",
      bodyHtml: "<p>Hi Ada</p>",
      bodyText: "Hi Ada",
      warnings: [{ field: "role", message: "No role on this contact." }],
    });
    const res = await PREVIEW(jsonRequest("/api/templates/preview", { templateId: "t1", contactId: "c1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subject).toBe("Role at Acme");
    expect(body.warnings).toHaveLength(1);
  });

  it("422 when neither templateId nor inline is provided", async () => {
    const res = await PREVIEW(jsonRequest("/api/templates/preview", { contactId: "c1" }));
    expect(res.status).toBe(422);
  });

  it("404 when the contact isn't owned", async () => {
    vi.mocked(previewTemplate).mockRejectedValue(new NotFoundError());
    const res = await PREVIEW(jsonRequest("/api/templates/preview", { templateId: "t1", contactId: "missing" }));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/send (single)", () => {
  it("returns a per-recipient summary", async () => {
    vi.mocked(sendEmails).mockResolvedValue({
      batchId: "b1",
      total: 1,
      sent: 1,
      failed: 0,
      results: [{ contactId: "c1", recipientEmail: "ada@x.com", status: "sent" }],
    });
    const res = await SEND(jsonRequest("/api/send", { contactIds: ["c1"], templateId: "t1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ batchId: "b1", total: 1, sent: 1, failed: 0 });
    expect(sendEmails).toHaveBeenCalledWith("u1", { contactIds: ["c1"], templateId: "t1" }, "Job Seeker");
  });

  it("409 no_active_account when no account is connected (FR-019a)", async () => {
    vi.mocked(sendEmails).mockRejectedValue(new ConflictError("no_active_account"));
    const res = await SEND(jsonRequest("/api/send", { contactIds: ["c1"], templateId: "t1" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "no_active_account" });
  });

  it("422 when no recipients are provided", async () => {
    const res = await SEND(jsonRequest("/api/send", { contactIds: [], templateId: "t1" }));
    expect(res.status).toBe(422);
  });

  it("404 when resumeId is unknown or not owned (003-resume-attachments)", async () => {
    vi.mocked(sendEmails).mockRejectedValue(new NotFoundError());
    const res = await SEND(jsonRequest("/api/send", { contactIds: ["c1"], templateId: "t1", resumeId: "not-mine" }));
    expect(res.status).toBe(404);
  });

  it("409 resume_unavailable when the selected resume is no longer active", async () => {
    vi.mocked(sendEmails).mockRejectedValue(new ConflictError("resume_unavailable"));
    const res = await SEND(jsonRequest("/api/send", { contactIds: ["c1"], templateId: "t1", resumeId: "r1" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "resume_unavailable" });
  });
});
