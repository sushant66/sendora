// @vitest-environment node
//
// jsdom's FormData/File polyfills don't correctly interop with NextRequest's
// (undici-backed) formData() parsing — a jsdom File silently loses its name/type/content
// across the boundary. Route handlers that parse multipart bodies need the real Node
// environment; JSON-only route tests (e.g. contacts.test.ts) are unaffected and stay on
// the project default (jsdom).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError, UnauthorizedError } from "@/lib/errors";

/**
 * T006 [US1] — Contract test for POST /api/resumes per contracts/http-api.md.
 *
 * The service and auth layers are mocked so this exercises the HTTP contract only:
 * status codes, response shapes, and validation-error mapping — no database required.
 */

vi.mock("@/lib/resumes/service", () => ({
  uploadResume: vi.fn(),
  listResumes: vi.fn(),
  getResumeFile: vi.fn(),
  deleteResume: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(), getCurrentUser: vi.fn() }));

import * as service from "@/lib/resumes/service";
import { requireUser } from "@/lib/auth/session";
import { POST } from "@/app/api/resumes/route";

const USER = { id: "u1", email: "u1@x.com", name: null, image: null };
const PDF_BYTES = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(100, 1)]);

function uploadRequest(fields: { label?: string; file?: { name: string; type: string; bytes: Buffer } | null; fileName?: string }): NextRequest {
  const form = new FormData();
  if (fields.label !== undefined) form.set("label", fields.label);
  if (fields.file) {
    form.set("file", new File([new Uint8Array(fields.file.bytes)], fields.file.name, { type: fields.file.type }));
  }
  if (fields.fileName !== undefined) form.set("fileName", fields.fileName);
  return new NextRequest(new URL("/api/resumes", "http://localhost"), { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(USER);
});

describe("POST /api/resumes", () => {
  it("uploads a resume → 201", async () => {
    const resume = { id: "r1", label: "Backend Engineer", version: 1, fileName: "resume.pdf", fileSize: PDF_BYTES.byteLength, status: "active" as const, createdAt: "2026-07-11T00:00:00.000Z", updatedAt: "2026-07-11T00:00:00.000Z" };
    vi.mocked(service.uploadResume).mockResolvedValue(resume);

    const res = await POST(uploadRequest({ label: "Backend Engineer", file: { name: "resume.pdf", type: "application/pdf", bytes: PDF_BYTES } }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(resume);
  });

  it("returns 422 when the label is missing", async () => {
    const res = await POST(uploadRequest({ file: { name: "resume.pdf", type: "application/pdf", bytes: PDF_BYTES } }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("validation");
  });

  it("returns 422 when no file is provided", async () => {
    const res = await POST(uploadRequest({ label: "Backend Engineer" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 for a non-PDF file", async () => {
    const res = await POST(
      uploadRequest({ label: "Backend Engineer", file: { name: "resume.pdf", type: "text/plain", bytes: Buffer.from("not a pdf") } }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 409 label_taken when the service rejects a duplicate active label", async () => {
    vi.mocked(service.uploadResume).mockRejectedValue(new ConflictError("label_taken"));
    const res = await POST(uploadRequest({ label: "Backend Engineer", file: { name: "resume.pdf", type: "application/pdf", bytes: PDF_BYTES } }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "label_taken" });
  });

  it("returns 409 resume_limit_reached when the service rejects the 21st active resume", async () => {
    vi.mocked(service.uploadResume).mockRejectedValue(new ConflictError("resume_limit_reached"));
    const res = await POST(uploadRequest({ label: "DevOps", file: { name: "resume.pdf", type: "application/pdf", bytes: PDF_BYTES } }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "resume_limit_reached" });
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError());
    const res = await POST(uploadRequest({ label: "Backend Engineer", file: { name: "resume.pdf", type: "application/pdf", bytes: PDF_BYTES } }));
    expect(res.status).toBe(401);
  });

  it("passes an optional custom fileName through to uploadResume, normalized (003-resume-attachments)", async () => {
    const resume = { id: "r1", label: "Backend Engineer", version: 1, fileName: "My Resume.pdf", fileSize: PDF_BYTES.byteLength, status: "active" as const, createdAt: "2026-07-11T00:00:00.000Z", updatedAt: "2026-07-11T00:00:00.000Z" };
    vi.mocked(service.uploadResume).mockResolvedValue(resume);

    const res = await POST(
      uploadRequest({ label: "Backend Engineer", file: { name: "resume.pdf", type: "application/pdf", bytes: PDF_BYTES }, fileName: "My Resume" }),
    );
    expect(res.status).toBe(201);
    expect(service.uploadResume).toHaveBeenCalledWith("u1", expect.objectContaining({ fileName: "My Resume.pdf" }));
  });

  it("omitting fileName never causes a validation error (falls back to the source file's name)", async () => {
    const resume = { id: "r1", label: "Backend Engineer", version: 1, fileName: "resume.pdf", fileSize: PDF_BYTES.byteLength, status: "active" as const, createdAt: "2026-07-11T00:00:00.000Z", updatedAt: "2026-07-11T00:00:00.000Z" };
    vi.mocked(service.uploadResume).mockResolvedValue(resume);

    const res = await POST(uploadRequest({ label: "Backend Engineer", file: { name: "resume.pdf", type: "application/pdf", bytes: PDF_BYTES } }));
    expect(res.status).toBe(201);
    expect(service.uploadResume).toHaveBeenCalledWith("u1", expect.objectContaining({ fileName: undefined }));
  });
});
