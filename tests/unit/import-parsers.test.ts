import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseCsv } from "@/lib/import/csv";
import { parseXlsx } from "@/lib/import/xlsx";
import { parsePaste } from "@/lib/import/paste";

/** T018 [US1] — the three parsers all normalize to the shared row shape. */

describe("parseCsv", () => {
  it("maps common headers to the shared row shape", () => {
    const csv = [
      "Full Name,Email Address,Company,Title",
      "Ada Lovelace,ada@analytical.io,Analytical Engines,Lead Recruiter",
      "Alan Turing,alan@bletchley.uk,Bletchley,Talent",
    ].join("\n");

    const { columns, mapping, rows } = parseCsv(csv);

    expect(columns).toEqual(["Full Name", "Email Address", "Company", "Title"]);
    expect(mapping).toEqual({
      name: "Full Name",
      email: "Email Address",
      company: "Company",
      role: "Title",
    });
    expect(rows).toEqual([
      { name: "Ada Lovelace", email: "ada@analytical.io", company: "Analytical Engines", role: "Lead Recruiter" },
      { name: "Alan Turing", email: "alan@bletchley.uk", company: "Bletchley", role: "Talent" },
    ]);
  });

  it("handles quoted fields and leaves unmapped optionals undefined", () => {
    const csv = ['name,email', '"Grace, Hopper",grace@navy.mil'].join("\n");
    const { rows } = parseCsv(csv);
    expect(rows).toEqual([{ name: "Grace, Hopper", email: "grace@navy.mil", company: undefined, role: undefined }]);
  });
});

describe("parseXlsx", () => {
  it("reads the first sheet into the shared row shape", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Name", "Email", "Company"],
      ["Ada Lovelace", "ada@analytical.io", "Analytical Engines"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Sheet1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const { mapping, rows } = parseXlsx(new Uint8Array(buf));

    expect(mapping).toMatchObject({ name: "Name", email: "Email", company: "Company" });
    expect(rows).toEqual([
      { name: "Ada Lovelace", email: "ada@analytical.io", company: "Analytical Engines", role: undefined },
    ]);
  });
});

describe("parsePaste", () => {
  it("parses tab-separated spreadsheet paste", () => {
    const pasted = ["Name\tEmail\tCompany", "Ada Lovelace\tada@analytical.io\tAnalytical Engines"].join("\n");
    const { rows } = parsePaste(pasted);
    expect(rows).toEqual([
      { name: "Ada Lovelace", email: "ada@analytical.io", company: "Analytical Engines", role: undefined },
    ]);
  });

  it("parses comma-separated pasted text", () => {
    const pasted = ["name,email", "Alan Turing,alan@bletchley.uk"].join("\n");
    const { rows } = parsePaste(pasted);
    expect(rows).toEqual([{ name: "Alan Turing", email: "alan@bletchley.uk", company: undefined, role: undefined }]);
  });
});
