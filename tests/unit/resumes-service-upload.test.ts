import { describe, it, expect } from "vitest";
import { nextResumeVersion } from "@/lib/resumes/service";

/**
 * T008 [US1] — the pure version-numbering helper extracted from `uploadResume`. Label
 * uniqueness and the 20-active-resume cap are DB constraints/queries (see the partial
 * unique index in the migration and `contracts/http-api.md`'s 409 responses), verified
 * by contract tests + e2e, not a DB-free unit test — this repo doesn't unit-test
 * DB-touching CRUD directly (see `lib/contacts/service.ts`, which has no direct unit
 * test either).
 */
describe("nextResumeVersion", () => {
  it("starts at 1 when a label has no existing versions", () => {
    expect(nextResumeVersion([])).toBe(1);
  });

  it("is one past the current maximum", () => {
    expect(nextResumeVersion([1, 2, 3])).toBe(4);
  });

  it("ignores order and gaps, using the true maximum", () => {
    expect(nextResumeVersion([1, 5, 2])).toBe(6);
  });

  it("continues from the prior max even if every version has since been archived", () => {
    // A label fully archived then reused must not restart at 1 (FR-011: never reused/reset).
    expect(nextResumeVersion([1, 2])).toBe(3);
  });
});
