/**
 * Shared shapes for the contact-import pipeline (User Story 1).
 *
 * The three parsers (CSV / xlsx / paste) all normalize their input to the same
 * {@link RawImportRow} shape so validation, dedup, and summary reporting live in one
 * tested place (see specs/001-recruiter-outreach/research.md §6).
 */

/** A field-name → source-column mapping produced by header auto-detection. */
export type ColumnMapping = {
  name?: string;
  email?: string;
  company?: string;
  role?: string;
};

/** One row as extracted by a parser, before validation. Fields may be missing. */
export type RawImportRow = {
  name?: string;
  email?: string;
  company?: string;
  role?: string;
};

/** The normalized result every parser returns. */
export type ParseResult = {
  /** Source column headers, in order, for the confirm-mapping UI. */
  columns: string[];
  /** Auto-detected field → column mapping (user can override in the UI). */
  mapping: ColumnMapping;
  /** Raw records keyed by source column — lets the UI re-map without re-parsing. */
  records: Record<string, string>[];
  /** Rows normalized to the shared shape via {@link mapping}. */
  rows: RawImportRow[];
};
