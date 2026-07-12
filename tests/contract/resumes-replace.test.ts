// @vitest-environment node
//
// jsdom's FormData/File polyfills don't correctly interop with NextRequest's
// (undici-backed) formData() parsing — see tests/contract/resumes-upload.test.ts for the
// full explanation. Route handlers that parse multipart bodies need the real Node env.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";

/**
 * Contract test for POST /api/resumes/:id/replace per contracts/http-api.md. Replaces the
 * active resume identified by :id with a new file, archiving the old one — a dedicated
 * action distinct from POST /api/resumes (which still rejects a duplicate label
 * unconditionally, per spec.md's US1/FR-005 — see the design plan for why these are two
 * separate endpoints rather than one context-dependent one).
 */

vi.mock("@/lib/resumes/service", () => ({
  uploadResume: vi.fn(),
  listResumes: vi.fn(),
  getResumeFile: vi.fn(),
  deleteResume: vi.fn(),
  restoreResume: vi.fn(),
  replaceResume: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(), getCurrentUser: vi.fn() }));

import * as service from "@/lib/resumes/service";
import { requireUser } from "@/lib/auth/session";
import { POST } from "@/app/api/resumes/[id]/replace/route";

const USER = { id: "u1", email: "u1@x.com", name: null, image: null };
const PDF_BYTES = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(100, 1)]);

function replaceRequest(url: string, file?: { name: string; type: string; bytes: Buffer } | null): NextRequest {
  const form = new FormData();
  if (file) form.set("file", new File([new Uint8Array(file.bytes)], file.name, { type: file.type }));
  return new NextRequest(new URL(url, "http://localhost"), { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(USER);
});

describe("POST /api/resumes/:id/replace", () => {
  const ctx = { params: Promise.resolve({ id: "r1" }) };

  it("replaces the active resume with a new file → 200 with the new active resume", async () => {
    const replaced = { id: "r2", label: "Backend Engineer", version: 2, fileName: "v2.pdf", fileSize: PDF_BYTES.byteLength, status: "active" as const, createdAt: "2026-07-12T00:00:00.000Z" };
    vi.mocked(service.replaceResume).mockResolvedValue(replaced);

    const res = await POST(replaceRequest("/api/resumes/r1/replace", { name: "v2.pdf", type: "application/pdf", bytes: PDF_BYTES }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(replaced);
    expect(service.replaceResume).toHaveBeenCalledWith("u1", "r1", expect.objectContaining({ name: "v2.pdf", type: "application/pdf" }));
  });

  it("returns 422 when no file is provided", async () => {
    const res = await POST(replaceRequest("/api/resumes/r1/replace"), ctx);
    expect(res.status).toBe(422);
  });

  it("returns 422 for a non-PDF file", async () => {
    const res = await POST(
      replaceRequest("/api/resumes/r1/replace", { name: "notes.txt", type: "text/plain", bytes: Buffer.from("not a pdf") }),
      ctx,
    );
    expect(res.status).toBe(422);
  });

  it("returns 404 if the target doesn't exist, isn't owned, or isn't currently active", async () => {
    vi.mocked(service.replaceResume).mockRejectedValue(new NotFoundError());
    const res = await POST(replaceRequest("/api/resumes/r1/replace", { name: "v2.pdf", type: "application/pdf", bytes: PDF_BYTES }), ctx);
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError());
    const res = await POST(replaceRequest("/api/resumes/r1/replace", { name: "v2.pdf", type: "application/pdf", bytes: PDF_BYTES }), ctx);
    expect(res.status).toBe(401);
  });
});
