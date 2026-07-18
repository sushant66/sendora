import { describe, it, expect, vi, beforeEach } from "vitest";

/** T031 [US2] — Contract test for /api/email-account (GET / connect / DELETE). */

vi.mock("@/lib/email/account-service", () => ({
  getAccountStatus: vi.fn(),
  disconnect: vi.fn(),
  buildConnectUrl: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(), getCurrentUser: vi.fn() }));

import type { NextRequest } from "next/server";
import * as accountService from "@/lib/email/account-service";
import { requireUser } from "@/lib/auth/session";
import { GET, DELETE } from "@/app/api/email-account/route";
import { POST as CONNECT } from "@/app/api/email-account/connect/route";

const USER = { id: "u1", email: "u1@x.com", name: null, image: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(USER);
});

describe("GET /api/email-account", () => {
  it("returns the connection status", async () => {
    vi.mocked(accountService.getAccountStatus).mockResolvedValue({
      connected: true,
      provider: "gmail",
      emailAddress: "u1@x.com",
      status: "active",
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      connected: true,
      provider: "gmail",
      emailAddress: "u1@x.com",
      status: "active",
    });
  });

  it("reports not connected when there is no account", async () => {
    vi.mocked(accountService.getAccountStatus).mockResolvedValue({ connected: false });
    const res = await GET();
    expect(await res.json()).toEqual({ connected: false });
  });
});

describe("POST /api/email-account/connect", () => {
  it("returns the Google authorize URL", async () => {
    vi.mocked(accountService.buildConnectUrl).mockReturnValue(
      "https://accounts.google.com/o/oauth2/auth?scope=gmail.send",
    );
    const req = new Request("http://x/api/email-account/connect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "gmail" }),
    }) as unknown as NextRequest;
    const res = await CONNECT(req);
    expect(res.status).toBe(200);
    expect((await res.json()).authorizeUrl).toContain("gmail.send");
    expect(accountService.buildConnectUrl).toHaveBeenCalledWith("u1", "gmail");
  });
});

describe("DELETE /api/email-account", () => {
  it("disconnects and returns 204", async () => {
    vi.mocked(accountService.disconnect).mockResolvedValue(undefined);
    const req = new Request("http://x/api/email-account?provider=gmail", {
      method: "DELETE",
    }) as unknown as NextRequest;
    const res = await DELETE(req);
    expect(res.status).toBe(204);
    expect(accountService.disconnect).toHaveBeenCalledWith("u1", "gmail");
  });
});
