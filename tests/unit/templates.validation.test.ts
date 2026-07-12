import { describe, it, expect } from "vitest";
import { unsupportedTemplateTokens } from "@/lib/validation/templates";
import { findUnsupportedTokens } from "@/lib/templates/merge";

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
