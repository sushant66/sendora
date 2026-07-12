import { describe, it, expect } from "vitest";
import { ResumeLabelSchema, ResumeFileSchema } from "@/lib/validation/resumes";

/**
 * T007 [US1] — label + file validation, including the content-based (magic-byte) PDF
 * check that FR-002 requires (a renamed non-PDF must be rejected regardless of its
 * declared name/type).
 */

const PDF_BYTES = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(100, 1)]);

function file(overrides: Partial<{ name: string; type: string; size: number; buffer: Buffer }> = {}) {
  return {
    name: "resume.pdf",
    type: "application/pdf",
    size: PDF_BYTES.byteLength,
    buffer: PDF_BYTES,
    ...overrides,
  };
}

describe("ResumeLabelSchema", () => {
  it("accepts a trimmed, non-empty label", () => {
    expect(ResumeLabelSchema.parse("  Backend Engineer  ")).toBe("Backend Engineer");
  });

  it("rejects an empty or whitespace-only label", () => {
    expect(() => ResumeLabelSchema.parse("")).toThrow();
    expect(() => ResumeLabelSchema.parse("   ")).toThrow();
  });

  it("rejects a label longer than 150 characters", () => {
    expect(() => ResumeLabelSchema.parse("x".repeat(151))).toThrow();
  });

  it("accepts a label at exactly the 150 character limit", () => {
    expect(ResumeLabelSchema.parse("x".repeat(150))).toHaveLength(150);
  });
});

describe("ResumeFileSchema", () => {
  it("accepts a valid PDF within the size limit", () => {
    expect(() => ResumeFileSchema.parse(file())).not.toThrow();
  });

  it("rejects a file over 10MB", () => {
    expect(() => ResumeFileSchema.parse(file({ size: 10 * 1024 * 1024 + 1 }))).toThrow();
  });

  it("rejects a declared content-type that isn't application/pdf", () => {
    expect(() => ResumeFileSchema.parse(file({ type: "text/plain" }))).toThrow();
  });

  it("rejects a .pdf-renamed file whose bytes are not actually a PDF (FR-002)", () => {
    const notActuallyPdf = file({ buffer: Buffer.from("not a pdf at all"), type: "application/pdf" });
    expect(() => ResumeFileSchema.parse(notActuallyPdf)).toThrow();
  });

  it("rejects an empty file", () => {
    expect(() => ResumeFileSchema.parse(file({ size: 0, buffer: Buffer.alloc(0) }))).toThrow();
  });
});
