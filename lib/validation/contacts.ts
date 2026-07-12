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

/** Max explicit ids accepted in one bulk-delete request (matchAll has no such bound). */
export const MAX_BULK_DELETE_IDS = 1000;

/**
 * Bulk-delete request (feature 002, US4, FR-020). Exactly one of `ids` (loaded-row selection)
 * or `matchAll` (everything matching the current search) is required.
 */
export const BulkDeleteRequestSchema = z
  .object({
    ids: z.array(z.string().min(1)).max(MAX_BULK_DELETE_IDS, "too many contacts in one delete").optional(),
    matchAll: z.boolean().optional(),
    query: z.string().optional(),
    excludedIds: z.array(z.string().min(1)).optional(),
  })
  .refine((d) => (Array.isArray(d.ids) && d.ids.length > 0) || d.matchAll === true, {
    message: "Provide ids or matchAll.",
    path: ["ids"],
  });
export type BulkDeleteRequest = z.infer<typeof BulkDeleteRequestSchema>;

/** Undo request: restore one soft-deleted batch (FR-023). */
export const RestoreRequestSchema = z.object({ deletedBatch: z.string().min(1) });
export type RestoreRequest = z.infer<typeof RestoreRequestSchema>;

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
