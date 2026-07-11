import { describe, it, expect } from "vitest";
import { TemplateInputSchema, unsupportedTemplateTokens } from "@/lib/validation/templates";

/** T051 [US3] — template token validation at save (FR-011). */

describe("TemplateInputSchema", () => {
  it("requires a name, subject, and body", () => {
    const r = TemplateInputSchema.safeParse({ name: "", subject: "", bodyHtml: "" });
    expect(r.success).toBe(false);
    const fields = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["name", "subject", "bodyHtml"]));
  });

  it("accepts valid input", () => {
    expect(
      TemplateInputSchema.safeParse({ name: "Intro", subject: "Hi {{first_name}}", bodyHtml: "<p>Hello</p>" }).success,
    ).toBe(true);
  });
});

describe("unsupportedTemplateTokens", () => {
  it("returns [] when only supported merge fields are used", () => {
    expect(
      unsupportedTemplateTokens({ subject: "Role at {{company}}", bodyHtml: "<p>Hi {{first_name}} ({{role}})</p>" }),
    ).toEqual([]);
  });

  it("flags unsupported tokens in subject and body (FR-011)", () => {
    expect(
      unsupportedTemplateTokens({ subject: "Hi {{first_name}} {{salary}}", bodyHtml: "<p>{{start_date}}</p>" }).sort(),
    ).toEqual(["salary", "start_date"]);
  });
});
