import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/import/csv";
import { parsePaste } from "@/lib/import/paste";
import { runImportPipeline } from "@/lib/import/pipeline";
import { ImportRequestSchema } from "@/lib/validation/contacts";
import type { RawImportRow } from "@/lib/import/types";

/** T072 — import edge cases: empty / oversized / unrecognized input, malformed emails. */

describe("empty input", () => {
  it("an empty CSV yields no rows", () => {
    expect(parseCsv("").rows).toEqual([]);
    expect(parsePaste("   ").rows).toEqual([]);
  });

  it("the import request schema rejects an empty row set (422 reason)", () => {
    const r = ImportRequestSchema.safeParse({ source: "csv", rows: [] });
    expect(r.success).toBe(false);
    expect(r.success ? "" : r.error.issues[0]?.message).toMatch(/no rows/i);
  });
});

describe("oversized input", () => {
  it("rejects more than the per-import row cap", () => {
    const rows = Array.from({ length: 5001 }, (_, i) => ({ name: `n${i}`, email: `n${i}@x.com` }));
    const r = ImportRequestSchema.safeParse({ source: "csv", rows });
    expect(r.success).toBe(false);
    expect(r.success ? "" : r.error.issues[0]?.message).toMatch(/too many/i);
  });
});

describe("unrecognized / headerless content", () => {
  it("content with no recognizable columns produces invalid rows, not a crash", () => {
    // No name/email headers → every field unmapped → rows fail validation, none dropped.
    const { rows } = parseCsv("foo,bar\n1,2\n3,4");
    const summary = runImportPipeline(rows, []);
    expect(summary.valid).toEqual([]);
    expect(summary.invalid).toHaveLength(2);
    expect(summary.invalid.every((i) => /email/.test(i.reason))).toBe(true);
  });
});

describe("malformed emails", () => {
  it("flags malformed emails as invalid with row numbers, keeping valid rows", () => {
    const rows: RawImportRow[] = [
      { name: "Good", email: "good@x.com" },
      { name: "Bad1", email: "no-at-sign" },
      { name: "Bad2", email: "spaces in@x.com" },
      { name: "Bad3", email: "trailing@" },
    ];
    const summary = runImportPipeline(rows, []);
    expect(summary.valid.map((v) => v.email)).toEqual(["good@x.com"]);
    expect(summary.invalid.map((i) => i.row)).toEqual([2, 3, 4]);
  });

  it("trims surrounding whitespace before validating an email", () => {
    const summary = runImportPipeline([{ name: "Padded", email: "  ada@x.com  " }], []);
    expect(summary.valid[0]?.email).toBe("ada@x.com");
  });
});
