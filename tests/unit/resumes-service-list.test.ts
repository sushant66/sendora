import { describe, it, expect } from "vitest";
import { toResume } from "@/lib/resumes/service";
import type { ResumeRow } from "@/lib/db/schema";

/**
 * T016 [US2] — the pure row-to-DTO mapping used by `listResumes`/`getResumeFile`: derives
 * `status` from `deletedAt`. The query behavior itself (active-only default, ordering,
 * ownership scoping) is DB-dependent and covered by contract tests + e2e, matching this
 * repo's existing convention (see T008's note).
 */

function row(overrides: Partial<ResumeRow> = {}): ResumeRow {
  return {
    id: "r1",
    userId: "u1",
    label: "Backend Engineer",
    version: 1,
    fileName: "resume.pdf",
    storageKey: "u1/r1.pdf",
    fileSize: 12345,
    deletedAt: null,
    createdAt: new Date("2026-07-11T00:00:00.000Z"),
    updatedAt: new Date("2026-07-11T00:00:00.000Z"),
    ...overrides,
  };
}

describe("toResume", () => {
  it("maps an active row (deletedAt null) to status 'active'", () => {
    expect(toResume(row()).status).toBe("active");
  });

  it("maps an archived row (deletedAt set) to status 'archived'", () => {
    expect(toResume(row({ deletedAt: new Date("2026-07-12T00:00:00.000Z") })).status).toBe("archived");
  });

  it("never leaks the internal storageKey to the DTO", () => {
    expect(toResume(row())).not.toHaveProperty("storageKey");
  });

  it("serializes createdAt as an ISO string", () => {
    expect(toResume(row()).createdAt).toBe("2026-07-11T00:00:00.000Z");
  });
});
