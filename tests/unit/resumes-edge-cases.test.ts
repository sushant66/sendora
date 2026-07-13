import { describe, it, expect } from "vitest";
import { MAX_RESUME_FILE_SIZE, ResumeFileSchema } from "@/lib/validation/resumes";

/**
 * T035 — Edge-case coverage not already exercised by T007/T008. Most of the spec's Edge
 * Cases section (the 20-active cap, cross-user access as not-found, the race for a new
 * label, restoring an already-active version as a no-op) are DB-dependent and are
 * verified by contract tests (see resumes-restore.test.ts's dedicated no-op case) plus
 * e2e/quickstart, not a DB-free unit test — this file only adds what's genuinely pure.
 */

const PDF_MAGIC = Buffer.from("%PDF-1.7\n");

function fileOfSize(size: number) {
  return {
    name: "resume.pdf",
    type: "application/pdf",
    size,
    buffer: Buffer.concat([PDF_MAGIC, Buffer.alloc(Math.max(size - PDF_MAGIC.byteLength, 0), 1)]).subarray(0, size),
  };
}

describe("ResumeFileSchema — size boundary", () => {
  it("accepts a file at exactly the 10MB limit", () => {
    expect(() => ResumeFileSchema.parse(fileOfSize(MAX_RESUME_FILE_SIZE))).not.toThrow();
  });

  it("rejects a file one byte over the 10MB limit", () => {
    expect(() => ResumeFileSchema.parse(fileOfSize(MAX_RESUME_FILE_SIZE + 1))).toThrow();
  });
});
