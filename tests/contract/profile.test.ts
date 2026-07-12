import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { UnauthorizedError } from "@/lib/errors";
import { makeProfile } from "@/tests/factories/profile";

/**
 * T009 [US1] — Contract test for GET/PUT /api/profile per contracts/http-api.md. The service
 * and auth layers are mocked so this exercises the HTTP contract only (status codes, shapes,
 * validation-error mapping) — no database.
 */

vi.mock("@/lib/profile/service", () => ({ getProfile: vi.fn(), saveProfile: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn(), getCurrentUser: vi.fn() }));

import * as service from "@/lib/profile/service";
import { requireUser } from "@/lib/auth/session";
import { GET, PUT } from "@/app/api/profile/route";

const USER = { id: "u1", email: "u1@x.com", name: "Ada", image: null };

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

describe("GET /api/profile", () => {
  it("returns 200 with the profile shape", async () => {
    vi.mocked(service.getProfile).mockResolvedValue(makeProfile());
    const res = await GET(jsonRequest("/api/profile", "GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(makeProfile());
    expect(service.getProfile).toHaveBeenCalledWith("u1");
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireUser).mockRejectedValue(new UnauthorizedError());
    const res = await GET(jsonRequest("/api/profile", "GET"));
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/profile", () => {
  it("upserts and returns 200 with the saved profile", async () => {
    const saved = makeProfile({ title: "Staff Engineer" });
    vi.mocked(service.saveProfile).mockResolvedValue(saved);
    const res = await PUT(jsonRequest("/api/profile", "PUT", { title: "Staff Engineer" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(saved);
    expect(service.saveProfile).toHaveBeenCalledWith("u1", expect.objectContaining({ title: "Staff Engineer" }));
  });

  it("returns 422 with per-field messages for an invalid URL", async () => {
    const res = await PUT(jsonRequest("/api/profile", "PUT", { link: "not-a-url" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("validation");
    expect(body.fields).toHaveProperty("link");
    expect(service.saveProfile).not.toHaveBeenCalled();
  });

  it("returns 422 for an invalid work preference", async () => {
    const res = await PUT(jsonRequest("/api/profile", "PUT", { workPreference: "flexible" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fields).toHaveProperty("workPreference");
  });

  it("accepts an empty body (all fields optional) and normalizes blanks", async () => {
    vi.mocked(service.saveProfile).mockResolvedValue(makeProfile());
    const res = await PUT(jsonRequest("/api/profile", "PUT", { title: "   " }));
    expect(res.status).toBe(200);
    // Blank strings normalize to null before reaching the service.
    expect(service.saveProfile).toHaveBeenCalledWith("u1", expect.objectContaining({ title: null }));
  });
});
