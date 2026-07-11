import type { ColumnMapping, RawImportRow } from "./types";

/**
 * Header auto-detection for contact imports. Maps common spreadsheet headers to the
 * four supported fields; the import UI lets the user confirm/override before importing.
 */

const IMPORT_FIELDS = ["name", "email", "company", "role"] as const;
type ImportField = (typeof IMPORT_FIELDS)[number];

const HEADER_ALIASES: Record<ImportField, readonly string[]> = {
  name: ["name", "full name", "fullname", "contact", "contact name", "recruiter", "recruiter name"],
  email: ["email", "email address", "e-mail", "mail", "emailaddress"],
  company: ["company", "organization", "organisation", "employer", "company name"],
  role: ["role", "title", "position", "job title", "jobtitle"],
};

/** Detect which source column feeds each supported field. First match wins per field. */
export function autoMapColumns(columns: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const col of columns) {
    const key = col.trim().toLowerCase();
    for (const field of IMPORT_FIELDS) {
      if (!mapping[field] && HEADER_ALIASES[field].includes(key)) {
        mapping[field] = col;
        break;
      }
    }
  }
  return mapping;
}

/** Project a raw record onto the shared row shape using a column mapping. */
export function applyMapping(
  record: Record<string, unknown>,
  mapping: ColumnMapping,
): RawImportRow {
  const read = (col: string | undefined): string | undefined => {
    if (!col) return undefined;
    const value = record[col];
    if (value === null || value === undefined) return undefined;
    const trimmed = String(value).trim();
    return trimmed.length ? trimmed : undefined;
  };
  return {
    name: read(mapping.name),
    email: read(mapping.email),
    company: read(mapping.company),
    role: read(mapping.role),
  };
}
