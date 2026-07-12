import { describe, it, expect } from "vitest";
import { unsupportedTemplateTokens, TemplateInputSchema } from "@/lib/validation/templates";
import { findUnsupportedTokens, hasMalformedMergeSyntax } from "@/lib/templates/merge";

/**
 * T004 [Foundational] — template save-time validation accepts BOTH namespaces (recipient +
 * sender) and still rejects tokens outside the closed vocabulary (FR-007).
 */

describe("unsupportedTemplateTokens", () => {
  it("accepts recipient tokens", () => {
    expect(
      unsupportedTemplateTokens({ subject: "Hi {{first_name}} at {{company}}", bodyHtml: "<p>{{role}}</p>" }),
    ).toEqual([]);
  });

  it("accepts sender (`my_*`) tokens (FR-007)", () => {
    expect(
      unsupportedTemplateTokens({
        subject: "A note from {{my_name}}",
        bodyHtml: "<p>I'm a {{my_title}} focused on {{my_skills}} — {{my_link}}, {{my_location}}, {{my_work_preference}}</p>",
      }),
    ).toEqual([]);
  });

  it("still rejects tokens outside the vocabulary", () => {
    expect(
      unsupportedTemplateTokens({ subject: "{{salary}}", bodyHtml: "<p>{{my_middle_name}} {{start_date}}</p>" }).sort(),
    ).toEqual(["my_middle_name", "salary", "start_date"]);
  });
});

describe("findUnsupportedTokens (shared vocabulary check)", () => {
  it("treats both namespaces as supported", () => {
    expect(findUnsupportedTokens("{{first_name}} {{my_pitch}}")).toEqual([]);
    expect(findUnsupportedTokens("{{my_unknown}}")).toEqual(["my_unknown"]);
  });
});

describe("hasMalformedMergeSyntax (unclosed / malformed braces, SC-002)", () => {
  it("passes well-formed content (complete tokens and plain text)", () => {
    expect(hasMalformedMergeSyntax("Hi {{first_name}} at {{company}}")).toBe(false);
    expect(hasMalformedMergeSyntax("No merge fields here")).toBe(false);
    // A single (non-doubled) brace is allowed literal text.
    expect(hasMalformedMergeSyntax("Save { and } are fine")).toBe(false);
  });

  it("flags an unclosed opener", () => {
    expect(hasMalformedMergeSyntax("Hi {{first_name")).toBe(true);
    expect(hasMalformedMergeSyntax("Hi {{")).toBe(true);
  });

  it("flags a stray closer, empty braces, and spaced tokens", () => {
    expect(hasMalformedMergeSyntax("Hi first_name}}")).toBe(true);
    expect(hasMalformedMergeSyntax("Hi {{}}")).toBe(true);
    expect(hasMalformedMergeSyntax("Hi {{first name}}")).toBe(true);
  });

  it("ignores a complete-but-unsupported token (that's a separate error)", () => {
    expect(hasMalformedMergeSyntax("Hi {{salary}}")).toBe(false);
  });
});

describe("TemplateInputSchema rejects malformed merge syntax", () => {
  it("rejects an unclosed token in the subject with a field error", () => {
    const r = TemplateInputSchema.safeParse({ name: "T", subject: "Hi {{first_name", bodyHtml: "<p>ok</p>" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path.join(".") === "subject")).toBe(true);
  });

  it("rejects an unclosed token in the body with a field error", () => {
    const r = TemplateInputSchema.safeParse({ name: "T", subject: "Hi {{first_name}}", bodyHtml: "<p>{{compan</p>" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path.join(".") === "bodyHtml")).toBe(true);
  });

  it("accepts well-formed content", () => {
    const r = TemplateInputSchema.safeParse({ name: "T", subject: "Hi {{first_name}}", bodyHtml: "<p>{{company}}</p>" });
    expect(r.success).toBe(true);
  });
});
