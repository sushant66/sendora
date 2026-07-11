import { describe, it, expect } from "vitest";
import { runImportPipeline } from "@/lib/import/pipeline";
import type { RawImportRow } from "@/lib/import/types";

/** T019 [US1] — validation + dedup + import summary (valid / duplicate / invalid rows). */

describe("runImportPipeline", () => {
  it("accepts valid rows and defaults missing optionals to null", () => {
    const rows: RawImportRow[] = [
      { name: "Ada Lovelace", email: "ada@analytical.io", company: "Analytical Engines", role: "Lead" },
      { name: "Alan Turing", email: "alan@bletchley.uk" },
    ];
    const summary = runImportPipeline(rows, []);

    expect(summary.duplicates).toEqual([]);
    expect(summary.invalid).toEqual([]);
    expect(summary.valid).toEqual([
      {
        name: "Ada Lovelace",
        email: "ada@analytical.io",
        emailNormalized: "ada@analytical.io",
        company: "Analytical Engines",
        role: "Lead",
      },
      { name: "Alan Turing", email: "alan@bletchley.uk", emailNormalized: "alan@bletchley.uk", company: null, role: null },
    ]);
  });

  it("reports invalid rows with row numbers instead of dropping them (FR-004/006)", () => {
    const rows: RawImportRow[] = [
      { name: "Valid Person", email: "valid@x.com" },
      { name: "No Email" },
      { name: "Bad Email", email: "not-an-email" },
      { email: "no-name@x.com" },
    ];
    const summary = runImportPipeline(rows, []);

    expect(summary.valid).toHaveLength(1);
    expect(summary.invalid).toEqual([
      { row: 2, reason: "missing/invalid email" },
      { row: 3, reason: "missing/invalid email" },
      { row: 4, reason: "name is required" },
    ]);
  });

  it("flags duplicates against existing contacts and within the same batch (FR-005)", () => {
    const rows: RawImportRow[] = [
      { name: "Existing", email: "Dup@Existing.com" },
      { name: "First Batch", email: "batch@x.com" },
      { name: "Second Batch", email: "BATCH@x.com" },
    ];
    const summary = runImportPipeline(rows, ["dup@existing.com"]);

    expect(summary.valid.map((v) => v.email)).toEqual(["batch@x.com"]);
    expect(summary.duplicates).toEqual([
      { row: 1, email: "Dup@Existing.com" },
      { row: 3, email: "BATCH@x.com" },
    ]);
  });
});
