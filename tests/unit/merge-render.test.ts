import { describe, it, expect } from "vitest";
import {
  renderString,
  renderTemplate,
  findUnsupportedTokens,
  extractTokens,
} from "@/lib/templates/merge";

/** T033 [US2] — merge-field rendering resolves tokens, applies fallbacks, never emits a literal {{token}}. */

const ADA = { name: "Ada Lovelace", company: "Analytical Engines", role: "Lead Recruiter" };

describe("renderString", () => {
  it("resolves identity + optional tokens from the contact", () => {
    const { text, warnings } = renderString("Hi {{first_name}} at {{company}} ({{role}})", ADA);
    expect(text).toBe("Hi Ada at Analytical Engines (Lead Recruiter)");
    expect(warnings).toEqual([]);
  });

  it("derives first/last/full name from the single name field", () => {
    expect(renderString("{{first_name}}|{{last_name}}|{{full_name}}", ADA).text).toBe(
      "Ada|Lovelace|Ada Lovelace",
    );
  });

  it("never leaves a literal placeholder and warns on empty optional fields (FR-012, SC-004)", () => {
    const { text, warnings } = renderString("Hi {{first_name}}, saw the {{role}} role at {{company}}.", {
      name: "Grace Hopper",
      company: null,
      role: null,
    });
    expect(text).toBe("Hi Grace, saw the  role at .");
    expect(text).not.toMatch(/\{\{.*\}\}/);
    expect(warnings.map((w) => w.field).sort()).toEqual(["company", "role"]);
  });

  it("falls back to a greeting word when the name is blank", () => {
    expect(renderString("Hi {{first_name}}", { name: "" }).text).toBe("Hi there");
  });

  it("drops unknown tokens with a warning (defense in depth)", () => {
    const { text, warnings } = renderString("Hi {{first_name}} {{salary}}", ADA);
    expect(text).toBe("Hi Ada ");
    expect(text).not.toMatch(/\{\{.*\}\}/);
    expect(warnings[0]?.field).toBe("salary");
  });
});

describe("renderTemplate HTML escaping (stored-XSS guard)", () => {
  it("HTML-escapes merged contact values in the HTML body, but not in subject/plain-text", () => {
    const evil = { name: '<img src=x onerror="alert(1)">', company: "A & B <script>", role: null };
    const out = renderTemplate(
      { subject: "Hi {{full_name}}", bodyHtml: "<p>Hi {{full_name}} at {{company}}</p>", bodyText: "Hi {{full_name}}" },
      evil,
    );
    // HTML body: markup from the contact is neutralized.
    expect(out.bodyHtml).not.toContain("<img");
    expect(out.bodyHtml).not.toContain("<script>");
    expect(out.bodyHtml).toContain("&lt;img");
    expect(out.bodyHtml).toContain("A &amp; B");
    // The template's own markup survives.
    expect(out.bodyHtml.startsWith("<p>Hi ")).toBe(true);
    // Subject and plain-text are not HTML contexts — values pass through literally.
    expect(out.subject).toBe('Hi <img src=x onerror="alert(1)">');
    expect(out.bodyText).toBe('Hi <img src=x onerror="alert(1)">');
  });
});

describe("renderTemplate", () => {
  it("renders subject + both body parts and merges warnings", () => {
    const out = renderTemplate(
      { subject: "Role at {{company}}", bodyHtml: "<p>Hi {{first_name}}</p>", bodyText: "Hi {{first_name}}" },
      { name: "Ada Lovelace", company: null, role: null },
    );
    expect(out.subject).toBe("Role at ");
    expect(out.bodyHtml).toBe("<p>Hi Ada</p>");
    expect(out.bodyText).toBe("Hi Ada");
    expect(out.warnings.map((w) => w.field)).toContain("company");
  });
});

describe("token validation helpers", () => {
  it("extracts distinct tokens", () => {
    expect(extractTokens("{{first_name}} {{first_name}} {{company}}").sort()).toEqual(["company", "first_name"]);
  });

  it("flags unsupported tokens for save-time validation (FR-011)", () => {
    expect(findUnsupportedTokens("Hi {{first_name}} — {{salary}} {{start_date}}").sort()).toEqual([
      "salary",
      "start_date",
    ]);
    expect(findUnsupportedTokens("Hi {{first_name}} at {{company}}")).toEqual([]);
  });
});
