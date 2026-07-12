import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ConflictError, NotFoundError, UnauthorizedError } from "@/lib/errors";

/**
 * T017 [US1] — Contract test for /api/contacts (+ /import) per contracts/http-api.md.
 *
 * The service and auth layers are mocked so this exercises the HTTP contract only:
 * status codes, response shapes, and validation-error mapping — no database required.
 */

vi.mock("@/lib/contacts/service", () => ({
  listContacts: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  importContacts: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(), getCurrentUser: vi.fn() }));

import * as service from "@/lib/contacts/service";
import { requireUser } from "@/lib/auth/session";
import { GET, POST } from "@/app/api/contacts/route";
import { PATCH, DELETE } from "@/app/api/contacts/[id]/route";
import { POST as IMPORT } from "@/app/api/contacts/import/route";

const USER = { id: "u1", email: "u1@x.com", name: null, image: null };

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

describe("GET /api/contacts", () => {
  it("returns 200 with items + nextCursor", async () => {
    vi.mocked(service.listContacts).mockResolvedValue({ items: [], nextCursor: null });
    const res = await GET(jsonRequest("/api/contacts?query=ada", "GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], nextCursor: null });
    expect(service.listContacts).toHaveBeenCalledWith("u1", { query: "ada", cursor: undefined, all: false });
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError());
    const res = await GET(jsonRequest("/api/contacts", "GET"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/contacts", () => {
  it("creates a contact → 201", async () => {
    const contact = { id: "c1", name: "Ada", email: "ada@x.com", company: null, role: null, source: "manual", createdAt: "2026-07-11T00:00:00.000Z" };
    vi.mocked(service.createContact).mockResolvedValue(contact);
    const res = await POST(jsonRequest("/api/contacts", "POST", { name: "Ada", email: "ada@x.com" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(contact);
  });

  it("returns 422 with per-field messages on invalid input", async () => {
    const res = await POST(jsonRequest("/api/contacts", "POST", { name: "", email: "nope" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("validation");
    expect(body.fields).toHaveProperty("name");
    expect(body.fields).toHaveProperty("email");
  });

  it("returns 409 when the email already exists", async () => {
    vi.mocked(service.createContact).mockRejectedValue(new ConflictError("email_exists"));
    const res = await POST(jsonRequest("/api/contacts", "POST", { name: "Ada", email: "ada@x.com" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "email_exists" });
  });
});

describe("PATCH / DELETE /api/contacts/:id", () => {
  const ctx = { params: Promise.resolve({ id: "c1" }) };

  it("edits → 200", async () => {
    const contact = { id: "c1", name: "Ada B", email: "ada@x.com", company: null, role: null, source: "manual", createdAt: "2026-07-11T00:00:00.000Z" };
    vi.mocked(service.updateContact).mockResolvedValue(contact);
    const res = await PATCH(jsonRequest("/api/contacts/c1", "PATCH", { name: "Ada B", email: "ada@x.com" }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(contact);
  });

  it("returns 404 when not owned", async () => {
    vi.mocked(service.deleteContact).mockRejectedValue(new NotFoundError());
    const res = await DELETE(jsonRequest("/api/contacts/c1", "DELETE"), ctx);
    expect(res.status).toBe(404);
  });

  it("deletes → 204", async () => {
    vi.mocked(service.deleteContact).mockResolvedValue(undefined);
    const res = await DELETE(jsonRequest("/api/contacts/c1", "DELETE"), ctx);
    expect(res.status).toBe(204);
  });
});

describe("POST /api/contacts/import", () => {
  it("returns 200 with the import summary shape", async () => {
    vi.mocked(service.importContacts).mockResolvedValue({
      imported: 2,
      duplicates: [{ row: 3, email: "dup@x.com" }],
      invalid: [{ row: 4, reason: "missing/invalid email" }],
      contactIds: ["c1", "c2"],
    });
    const res = await IMPORT(
      jsonRequest("/api/contacts/import", "POST", {
        source: "csv",
        rows: [{ name: "Ada", email: "ada@x.com" }],
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      imported: 2,
      duplicates: [{ row: 3, email: "dup@x.com" }],
      invalid: [{ row: 4, reason: "missing/invalid email" }],
      contactIds: ["c1", "c2"],
    });
  });

  it("returns 422 on an empty/unrecognized payload", async () => {
    const res = await IMPORT(jsonRequest("/api/contacts/import", "POST", { source: "csv", rows: [] }));
    expect(res.status).toBe(422);
  });
});
