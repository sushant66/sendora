import { z } from "zod";

/**
 * Zod contracts for recruiter contacts (User Story 1).
 *
 * Constitution Principle I: every row crossing a trust boundary (uploaded file,
 * pasted text, manual form, API body) is validated here, and the validated type flows
 * through the import pipeline and contacts service.
 */

/** Provenance of a contact (data-model.md → RecruiterContact.source). */
export const CONTACT_SOURCES = ["csv", "xlsx", "paste", "manual"] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];

/** Import methods that produce a batch of rows (excludes "manual"). */
export const IMPORT_SOURCES = ["csv", "xlsx", "paste"] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];

/** Case-insensitive normalization used for dedup and the unique index. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Coerce blank/whitespace strings to undefined so optional text is truly optional. */
const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim().length === 0 ? undefined : v),
  z.string().trim().min(1).optional(),
);

/**
 * A single import row (shared by CSV / xlsx / paste). A missing or malformed email
 * rejects the row (FR-004) — the message is surfaced verbatim in the import summary.
 */
export const ImportRowSchema = z.object({
  name: z.string({ error: "name is required" }).trim().min(1, "name is required"),
  email: z
    .string({ error: "missing/invalid email" })
    .trim()
    .pipe(z.email("missing/invalid email")),
  company: optionalText,
  role: optionalText,
});
export type ImportRow = z.infer<typeof ImportRowSchema>;

/** Manual add / edit of a single contact (FR-002). */
export const ContactInputSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  email: z.string().trim().pipe(z.email("a valid email is required")),
  company: optionalText,
  role: optionalText,
});
export type ContactInput = z.infer<typeof ContactInputSchema>;

/** Max rows accepted in a single import. Shared by the client-side guard (fail fast, before
 *  parsing/POSTing a huge file) and the server validation below (authoritative boundary). */
export const MAX_IMPORT_ROWS = 5000;

/** Body of POST /api/contacts/import — the server re-validates the parsed rows. */
export const ImportRequestSchema = z.object({
  source: z.enum(IMPORT_SOURCES),
  rows: z
    .array(
      z.object({
        name: z.string().optional(),
        email: z.string().optional(),
        company: z.string().optional(),
        role: z.string().optional(),
      }),
    )
    .min(1, "no rows to import")
    .max(MAX_IMPORT_ROWS, "too many rows in one import"),
});
export type ImportRequest = z.infer<typeof ImportRequestSchema>;
