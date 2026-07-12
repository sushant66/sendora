import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";

/**
 * T041 [US4] — Contract test for POST /api/contacts/bulk-delete and /restore per
 * contracts/http-api.md. Service + auth mocked; checks status, shapes, and validation.
 */

vi.mock("@/lib/contacts/soft-delete", () => ({ softDeleteContacts: vi.fn(), restoreBatch: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(), getCurrentUser: vi.fn() }));

import { softDeleteContacts, restoreBatch } from "@/lib/contacts/soft-delete";
import { requireUser } from "@/lib/auth/session";
import { POST as BULK_DELETE } from "@/app/api/contacts/bulk-delete/route";
import { POST as RESTORE } from "@/app/api/contacts/restore/route";

const USER = { id: "u1", email: "u1@x.com", name: null, image: null };

function jsonRequest(url: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"), {
    method: "POST",
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(USER);
});

describe("POST /api/contacts/bulk-delete", () => {
  it("soft-deletes by ids → 200 { deletedBatch, count }", async () => {
    vi.mocked(softDeleteContacts).mockResolvedValue({ deletedBatch: "b_abc", count: 3 });
    const res = await BULK_DELETE(jsonRequest("/api/contacts/bulk-delete", { ids: ["c1", "c2", "c3"] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deletedBatch: "b_abc", count: 3 });
    expect(softDeleteContacts).toHaveBeenCalledWith("u1", { ids: ["c1", "c2", "c3"] });
  });

  it("soft-deletes by matchAll → 200", async () => {
    vi.mocked(softDeleteContacts).mockResolvedValue({ deletedBatch: "b_xyz", count: 42 });
    const res = await BULK_DELETE(jsonRequest("/api/contacts/bulk-delete", { matchAll: true, query: "acme", excludedIds: ["c9"] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deletedBatch: "b_xyz", count: 42 });
  });

  it("returns 422 when neither ids nor matchAll is provided", async () => {
    const res = await BULK_DELETE(jsonRequest("/api/contacts/bulk-delete", {}));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("validation");
    expect(body.fields).toHaveProperty("ids");
    expect(softDeleteContacts).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError());
    const res = await BULK_DELETE(jsonRequest("/api/contacts/bulk-delete", { ids: ["c1"] }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/contacts/restore", () => {
  it("restores a batch → 200 { restored, skipped }", async () => {
    vi.mocked(restoreBatch).mockResolvedValue({ restored: 41, skipped: 1 });
    const res = await RESTORE(jsonRequest("/api/contacts/restore", { deletedBatch: "b_abc" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ restored: 41, skipped: 1 });
    expect(restoreBatch).toHaveBeenCalledWith("u1", "b_abc");
  });

  it("returns 404 when the batch is unknown/committed", async () => {
    vi.mocked(restoreBatch).mockRejectedValue(new NotFoundError());
    const res = await RESTORE(jsonRequest("/api/contacts/restore", { deletedBatch: "gone" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("returns 422 when deletedBatch is missing", async () => {
    const res = await RESTORE(jsonRequest("/api/contacts/restore", {}));
    expect(res.status).toBe(422);
  });
});
