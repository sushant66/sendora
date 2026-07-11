import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError, UnsupportedMergeFieldsError } from "@/lib/errors";

/** T050 [US3] — Contract test for /api/templates CRUD incl. 422 unsupported_merge_fields. */

vi.mock("@/lib/templates/service", () => ({
  listTemplates: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(), getCurrentUser: vi.fn() }));

import * as service from "@/lib/templates/service";
import { requireUser } from "@/lib/auth/session";
import { GET, POST } from "@/app/api/templates/route";
import { PATCH, DELETE } from "@/app/api/templates/[id]/route";

const USER = { id: "u1", email: "u1@x.com", name: null, image: null };
const TEMPLATE = {
  id: "t1", kind: "custom" as const, name: "Intro", subject: "Hi {{first_name}}",
  bodyHtml: "<p>Hello</p>", bodyText: "Hello", mergeFields: ["first_name"], createdAt: "2026-07-11T00:00:00.000Z",
};

function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"), {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(USER);
});

describe("GET /api/templates", () => {
  it("returns starter + custom templates", async () => {
    vi.mocked(service.listTemplates).mockResolvedValue([TEMPLATE]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [TEMPLATE] });
  });
});

describe("POST /api/templates", () => {
  it("creates a custom template → 201", async () => {
    vi.mocked(service.createTemplate).mockResolvedValue(TEMPLATE);
    const res = await POST(jsonRequest("/api/templates", "POST", { name: "Intro", subject: "Hi {{first_name}}", bodyHtml: "<p>Hello</p>" }));
    expect(res.status).toBe(201);
  });

  it("422 unsupported_merge_fields with the offending tokens (FR-011)", async () => {
    vi.mocked(service.createTemplate).mockRejectedValue(new UnsupportedMergeFieldsError(["salary"]));
    const res = await POST(jsonRequest("/api/templates", "POST", { name: "X", subject: "{{salary}}", bodyHtml: "<p>x</p>" }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "unsupported_merge_fields", fields: ["{{salary}}"] });
  });

  it("422 validation when required fields are missing", async () => {
    const res = await POST(jsonRequest("/api/templates", "POST", { name: "", subject: "", bodyHtml: "" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("validation");
  });
});

describe("PATCH / DELETE /api/templates/:id", () => {
  const ctx = { params: Promise.resolve({ id: "t1" }) };

  it("edits a custom template → 200", async () => {
    vi.mocked(service.updateTemplate).mockResolvedValue(TEMPLATE);
    const res = await PATCH(jsonRequest("/api/templates/t1", "PATCH", { name: "Intro", subject: "Hi {{first_name}}", bodyHtml: "<p>Hello</p>" }), ctx);
    expect(res.status).toBe(200);
  });

  it("403 when trying to edit a system template", async () => {
    vi.mocked(service.updateTemplate).mockRejectedValue(new ForbiddenError());
    const res = await PATCH(jsonRequest("/api/templates/sys", "PATCH", { name: "x", subject: "x", bodyHtml: "<p>x</p>" }), ctx);
    expect(res.status).toBe(403);
  });

  it("deletes → 204", async () => {
    vi.mocked(service.deleteTemplate).mockResolvedValue(undefined);
    const res = await DELETE(jsonRequest("/api/templates/t1", "DELETE"), ctx);
    expect(res.status).toBe(204);
  });
});
