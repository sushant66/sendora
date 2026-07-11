import * as XLSX from "xlsx";
import { autoMapColumns, applyMapping } from "./columns";
import type { ParseResult } from "./types";

/**
 * Parse the first sheet of an `.xlsx` workbook into normalized import rows
 * (User Story 1, FR-001). Values are read as text so numeric-looking cells (e.g. phone
 * columns that get ignored) never surprise validation.
 */
export function parseXlsx(data: ArrayBuffer | Uint8Array): ParseResult {
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { columns: [], mapping: {}, records: [], rows: [] };
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { columns: [], mapping: {}, records: [], rows: [] };

  const records = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  });
  // Keep the ORIGINAL header keys — the record objects are keyed by them, so a trimmed
  // copy here would make applyMapping's lookups miss. autoMapColumns trims internally
  // only for alias comparison and returns the original column name.
  const columns = records.length ? Object.keys(records[0]!) : [];
  const mapping = autoMapColumns(columns);
  const rows = records.map((record) => applyMapping(record, mapping));
  return { columns, mapping, records, rows };
}
