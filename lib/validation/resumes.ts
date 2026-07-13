import { z } from "zod";

/**
 * Zod contracts for resumes (002-resume-storage). Constitution Principle I: every value
 * crossing a trust boundary — the label text and the uploaded file — is validated here.
 */

export const MAX_RESUME_FILE_SIZE = 10 * 1024 * 1024; // 10MB (FR-003)
export const MAX_ACTIVE_RESUMES = 20; // FR-006

/** The PDF magic header — checked against actual bytes, never the declared type alone (FR-002). */
const PDF_MAGIC = Buffer.from("%PDF-", "ascii");

export const ResumeLabelSchema = z
  .string({ error: "a label is required" })
  .trim()
  .min(1, "a label is required")
  .max(150, "label must be 150 characters or fewer");

/** Characters unsafe in a file name: path separators, quotes, and ASCII control characters. */
const UNSAFE_FILENAME_CHARS = /[/\\\x00-\x1f<>:"|?*]/g;

/** Fallback used when a source file name is empty or all-unsafe after stripping. */
const DEFAULT_FILE_NAME = "resume.pdf";

/**
 * Strip characters that are unsafe in a file name and would break the MIME
 * `Content-Disposition`/`Content-Type` headers (and the download route's HTTP header) this
 * name is later interpolated into, then guarantee a `.pdf` extension. Returns `undefined`
 * when nothing usable survives, so callers can fall back deliberately.
 */
export function sanitizeFileName(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const stripped = trimmed.replace(UNSAFE_FILENAME_CHARS, "").trim();
  if (!stripped) return undefined;
  return /\.pdf$/i.test(stripped) ? stripped : `${stripped}.pdf`;
}

/** Normalized file metadata the route handler builds from the multipart upload. */
export const ResumeFileSchema = z
  .object({
    // The uploaded file's own name is attacker-controlled and is the fallback display name
    // when no custom `fileName` is given, so sanitize it here at the trust boundary: it is
    // interpolated unescaped into MIME/HTTP headers downstream and must never carry a quote,
    // control char, or separator (matches how the custom `fileName` is already treated).
    name: z.string().transform((n) => sanitizeFileName(n) ?? DEFAULT_FILE_NAME),
    type: z.string(),
    size: z.number(),
    buffer: z.instanceof(Buffer),
  })
  .refine((f) => f.size > 0, { message: "a file is required", path: ["file"] })
  .refine((f) => f.size <= MAX_RESUME_FILE_SIZE, { message: "file must be 10MB or smaller", path: ["file"] })
  .refine((f) => f.type === "application/pdf", { message: "file must be a PDF", path: ["file"] })
  .refine((f) => f.buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC), {
    message: "file must be a valid PDF",
    path: ["file"],
  });
export type ResumeFile = z.infer<typeof ResumeFileSchema>;

/**
 * An optional custom file name (003-resume-attachments, research.md §7). Never rejects:
 * omitted, empty, whitespace-only, or unusable-after-stripping input all resolve to
 * `undefined`, so the caller falls back to the (already sanitized) source file's own name.
 */
export const ResumeFileNameSchema = z
  .string()
  .optional()
  .transform((raw) => sanitizeFileName(raw));

export const ResumeUploadSchema = z.object({
  label: ResumeLabelSchema,
  file: ResumeFileSchema,
  fileName: ResumeFileNameSchema,
});
export type ResumeUploadInput = z.infer<typeof ResumeUploadSchema>;
