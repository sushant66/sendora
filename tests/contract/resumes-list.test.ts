import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";

/**
 * T015 [US2] — Contract test for GET /api/resumes (list) and GET /api/resumes/:id
 * (stream) per contracts/http-api.md. Service and auth are mocked — no database.
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
import { GET as GET_ONE } from "@/app/api/resumes/[id]/route";

const USER = { id: "u1", email: "u1@x.com", name: null, image: null };

function getRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"), { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(USER);
});

describe("GET /api/resumes", () => {
  it("returns 200 with active resumes by default", async () => {
    const items = [{ id: "r1", label: "Backend Engineer", version: 1, fileName: "r.pdf", fileSize: 100, status: "active" as const, createdAt: "2026-07-11T00:00:00.000Z" }];
    vi.mocked(service.listResumes).mockResolvedValue({ items });
    const res = await GET(getRequest("/api/resumes"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items });
    expect(service.listResumes).toHaveBeenCalledWith("u1", { includeArchived: false });
  });

  it("passes includeArchived=true through to the service", async () => {
    vi.mocked(service.listResumes).mockResolvedValue({ items: [] });
    await GET(getRequest("/api/resumes?includeArchived=true"));
    expect(service.listResumes).toHaveBeenCalledWith("u1", { includeArchived: true });
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError());
    const res = await GET(getRequest("/api/resumes"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/resumes/:id", () => {
  const ctx = { params: Promise.resolve({ id: "r1" }) };

  it("streams the PDF with the right headers", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });
    vi.mocked(service.getResumeFile).mockResolvedValue({ body, contentLength: 3, fileName: "resume.pdf" });
    const res = await GET_ONE(getRequest("/api/resumes/r1"), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe('inline; filename="resume.pdf"');
  });

  it("returns 404 when not found or not owned", async () => {
    vi.mocked(service.getResumeFile).mockRejectedValue(new NotFoundError());
    const res = await GET_ONE(getRequest("/api/resumes/r1"), ctx);
    expect(res.status).toBe(404);
  });
});
