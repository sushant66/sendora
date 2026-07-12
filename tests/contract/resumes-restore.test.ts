import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";

/**
 * T028 [US4] — Contract test for POST /api/resumes/:id/restore and the
 * ?includeArchived=true grouping per contracts/http-api.md. The restore-swap transaction
 * and version-numbering-across-cycles guarantees are DB-dependent (see tasks.md's note on
 * T028) — verified by e2e + quickstart, not here.
 */

vi.mock("@/lib/resumes/service", () => ({
  uploadResume: vi.fn(),
  listResumes: vi.fn(),
  getResumeFile: vi.fn(),
  deleteResume: vi.fn(),
  restoreResume: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(), getCurrentUser: vi.fn() }));

import * as service from "@/lib/resumes/service";
import { requireUser } from "@/lib/auth/session";
import { GET } from "@/app/api/resumes/route";
import { POST as RESTORE } from "@/app/api/resumes/[id]/restore/route";

const USER = { id: "u1", email: "u1@x.com", name: null, image: null };

function req(url: string, method: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"), { method });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(USER);
});

describe("GET /api/resumes?includeArchived=true", () => {
  it("returns both active and archived rows for grouping into version history", async () => {
    const items = [
      { id: "r1", label: "Backend Engineer", version: 1, fileName: "v1.pdf", fileSize: 100, status: "archived" as const, createdAt: "2026-07-01T00:00:00.000Z" },
      { id: "r2", label: "Backend Engineer", version: 2, fileName: "v2.pdf", fileSize: 100, status: "active" as const, createdAt: "2026-07-10T00:00:00.000Z" },
    ];
    vi.mocked(service.listResumes).mockResolvedValue({ items });
    const res = await GET(req("/api/resumes?includeArchived=true", "GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items });
    expect(service.listResumes).toHaveBeenCalledWith("u1", { includeArchived: true });
  });
});

describe("POST /api/resumes/:id/restore", () => {
  const ctx = { params: Promise.resolve({ id: "r1" }) };

  it("restores an archived version → 200 with the reactivated resume", async () => {
    const restored = { id: "r1", label: "Backend Engineer", version: 1, fileName: "v1.pdf", fileSize: 100, status: "active" as const, createdAt: "2026-07-01T00:00:00.000Z" };
    vi.mocked(service.restoreResume).mockResolvedValue(restored);
    const res = await RESTORE(req("/api/resumes/r1/restore", "POST"), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(restored);
    expect(service.restoreResume).toHaveBeenCalledWith("u1", "r1");
  });

  it("returns 404 if the id doesn't exist or isn't owned", async () => {
    vi.mocked(service.restoreResume).mockRejectedValue(new NotFoundError());
    const res = await RESTORE(req("/api/resumes/r1/restore", "POST"), ctx);
    expect(res.status).toBe(404);
  });

  it("restoring an already-active version is a no-op → 200 with it unchanged (spec Edge Cases)", async () => {
    const alreadyActive = { id: "r1", label: "Backend Engineer", version: 2, fileName: "v2.pdf", fileSize: 100, status: "active" as const, createdAt: "2026-07-05T00:00:00.000Z" };
    vi.mocked(service.restoreResume).mockResolvedValue(alreadyActive);
    const res = await RESTORE(req("/api/resumes/r1/restore", "POST"), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(alreadyActive);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError());
    const res = await RESTORE(req("/api/resumes/r1/restore", "POST"), ctx);
    expect(res.status).toBe(401);
  });
});
