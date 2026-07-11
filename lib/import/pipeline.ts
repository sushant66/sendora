import { ZodError } from "zod";
import { ImportRowSchema, normalizeEmail } from "@/lib/validation/contacts";
import type { RawImportRow } from "./types";

/**
 * The single normalize → validate → dedup → summarize pipeline shared by every import
 * method (User Story 1, FR-004/005/006). It is pure: given rows and the set of emails
 * that already exist for the user, it partitions rows into valid / duplicate / invalid
 * without touching the database, so it is fully unit-testable.
 */

export type ValidContact = {
  name: string;
  email: string;
  emailNormalized: string;
  company: string | null;
  role: string | null;
};

export type ImportSummary = {
  /** New, valid, non-duplicate contacts ready to insert. */
  valid: ValidContact[];
  /** Rows skipped because the email already exists (in the DB or earlier in the batch). */
  duplicates: { row: number; email: string }[];
  /** Rows rejected by validation, each with a human-readable reason (never dropped silently). */
  invalid: { row: number; reason: string }[];
};

/** Pick the clearest reason from a validation error, preferring the email issue. */
function reasonFor(error: ZodError): string {
  const issues = error.issues;
  const emailIssue = issues.find((i) => i.path[0] === "email");
  return (emailIssue ?? issues[0])?.message ?? "invalid row";
}

export function runImportPipeline(
  rows: RawImportRow[],
  existingNormalizedEmails: Iterable<string>,
): ImportSummary {
  const existing = new Set(existingNormalizedEmails);
  const seenInBatch = new Set<string>();
  const summary: ImportSummary = { valid: [], duplicates: [], invalid: [] };

  rows.forEach((raw, index) => {
    const row = index + 1;
    const parsed = ImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      summary.invalid.push({ row, reason: reasonFor(parsed.error) });
      return;
    }

    const { name, email, company, role } = parsed.data;
    const emailNormalized = normalizeEmail(email);
    if (existing.has(emailNormalized) || seenInBatch.has(emailNormalized)) {
      summary.duplicates.push({ row, email });
      return;
    }

    seenInBatch.add(emailNormalized);
    summary.valid.push({
      name,
      email,
      emailNormalized,
      company: company ?? null,
      role: role ?? null,
    });
  });

  return summary;
}
