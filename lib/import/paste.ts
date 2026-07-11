import Papa from "papaparse";
import { autoMapColumns, applyMapping } from "./columns";
import type { ParseResult } from "./types";

/**
 * Parse pasted spreadsheet content (User Story 1, FR-001). Spreadsheet copy-paste is
 * tab-separated; hand-typed lists are usually comma-separated — detect from the header
 * line so both work without the user choosing a format.
 */
function detectDelimiter(input: string): string {
  const firstLine = input.trim().split(/\r?\n/, 1)[0] ?? "";
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs >= commas && tabs > 0 ? "\t" : ",";
}

export function parsePaste(input: string): ParseResult {
  const trimmed = input.trim();
  const result = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    delimiter: detectDelimiter(trimmed),
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const columns = (result.meta.fields ?? []).filter((c) => c.length > 0);
  const mapping = autoMapColumns(columns);
  const records = result.data;
  const rows = records.map((record) => applyMapping(record, mapping));
  return { columns, mapping, records, rows };
}
