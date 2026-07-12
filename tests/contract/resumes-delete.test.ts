import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";

/**
 * T022 [US3] — Contract test for DELETE /api/resumes/:id per contracts/http-api.md.
 * Deleting has no DB-free pure logic to extract, unlike US1/US2/US4 — file retention
 * (FR-009/010, the storage client's deleteObject must never be called) is a service/DB
 * concern verified here (via the mocked service never needing storage at all) plus by
 * e2e + quickstart, not a standalone unit test.
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
import { DELETE } from "@/app/api/resumes/[id]/route";

const USER = { id: "u1", email: "u1@x.com", name: null, image: null };

function deleteRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"), { method: "DELETE" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(USER);
});

describe("DELETE /api/resumes/:id", () => {
  const ctx = { params: Promise.resolve({ id: "r1" }) };

  it("deletes → 204", async () => {
    vi.mocked(service.deleteResume).mockResolvedValue(undefined);
    const res = await DELETE(deleteRequest("/api/resumes/r1"), ctx);
    expect(res.status).toBe(204);
    expect(service.deleteResume).toHaveBeenCalledWith("u1", "r1");
  });

  it("returns 404 when not found, not owned, or already archived", async () => {
    vi.mocked(service.deleteResume).mockRejectedValue(new NotFoundError());
    const res = await DELETE(deleteRequest("/api/resumes/r1"), ctx);
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError());
    const res = await DELETE(deleteRequest("/api/resumes/r1"), ctx);
    expect(res.status).toBe(401);
  });
});
