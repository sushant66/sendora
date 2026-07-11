import Papa from "papaparse";
import { autoMapColumns, applyMapping } from "./columns";
import type { ParseResult } from "./types";

/**
 * Parse CSV file text into normalized import rows (User Story 1, FR-001).
 * PapaParse handles real-world quoting/delimiters; headers are auto-mapped to fields.
 */
export function parseCsv(input: string): ParseResult {
  const result = Papa.parse<Record<string, string>>(input.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const columns = (result.meta.fields ?? []).filter((c) => c.length > 0);
  const mapping = autoMapColumns(columns);
  const records = result.data;
  const rows = records.map((record) => applyMapping(record, mapping));
  return { columns, mapping, records, rows };
}
