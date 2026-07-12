import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError, UnauthorizedError } from "@/lib/errors";

/**
 * T030 [US3] — Contract test for POST /api/send/test per contracts/http-api.md. The service
 * and auth layers are mocked; this checks status codes, response shape, the no_active_account
 * conflict, and validation mapping (no DB).
 */

vi.mock("@/lib/send/test-send", () => ({ sendTestEmail: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(), getCurrentUser: vi.fn() }));

import { sendTestEmail } from "@/lib/send/test-send";
import { requireUser } from "@/lib/auth/session";
import { POST } from "@/app/api/send/test/route";

const USER = { id: "u1", email: "u1@x.com", name: "Ada", image: null };

function jsonRequest(body?: unknown): NextRequest {
  return new NextRequest(new URL("/api/send/test", "http://localhost"), {
    method: "POST",
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(USER);
});

describe("POST /api/send/test", () => {
  it("returns 200 with { status, toEmail } on success", async () => {
    vi.mocked(sendTestEmail).mockResolvedValue({ status: "sent", toEmail: "ada@ada.dev" });
    const res = await POST(jsonRequest({ override: { subject: "Hi {{first_name}}", bodyHtml: "<p>Hi</p>" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "sent", toEmail: "ada@ada.dev" });
  });

  it("returns 200 with a failure reason when the provider rejects", async () => {
    vi.mocked(sendTestEmail).mockResolvedValue({ status: "failed", reason: "The provider rejected the message." });
    const res = await POST(jsonRequest({ templateId: "t1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "failed", reason: "The provider rejected the message." });
  });

  it("returns 409 no_active_account when no inbox is connected", async () => {
    vi.mocked(sendTestEmail).mockRejectedValue(new ConflictError("no_active_account"));
    const res = await POST(jsonRequest({ templateId: "t1" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "no_active_account" });
  });

  it("returns 422 when neither a template nor edited content is provided", async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("validation");
    expect(sendTestEmail).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError());
    const res = await POST(jsonRequest({ templateId: "t1" }));
    expect(res.status).toBe(401);
  });
});
