import { describe, it, expect } from "vitest";
import {
  renderString,
  renderTemplate,
  SENDER_TOKENS,
  MERGE_TOKENS,
  extractTokens,
} from "@/lib/templates/merge";
import { makeProfile, makeEmptyProfile } from "@/tests/factories/profile";

/**
 * T003 [Foundational] — sender (`my_*`) merge fields resolve from the profile, each empty
 * value drops with a per-field warning (never a literal placeholder), and both namespaces
 * render in one pass (research §1/§2, SC-002).
 */

const CONTACT = { name: "Ada Lovelace", company: "Analytical Engines", role: "Lead Recruiter" };

describe("sender namespace vocabulary", () => {
  it("declares the seven `my_*` tokens, disjoint from recipient tokens", () => {
    expect([...SENDER_TOKENS]).toEqual([
      "my_name",
      "my_title",
      "my_pitch",
      "my_skills",
      "my_link",
      "my_location",
      "my_work_preference",
    ]);
    for (const t of SENDER_TOKENS) expect(MERGE_TOKENS).not.toContain(t as never);
  });
});

describe("renderString with a sender context", () => {
  it("resolves recipient and sender tokens in one pass", () => {
    const { text, warnings } = renderString(
      "Hi {{first_name}}, I'm {{my_name}}, a {{my_title}} ({{my_link}}).",
      { contact: CONTACT, sender: makeProfile() },
    );
    expect(text).toBe("Hi Ada, I'm Ada Lovelace, a Senior Frontend Engineer (https://ada.dev).");
    expect(warnings).toEqual([]);
  });

  it("drops an empty sender field with a warning and never emits a literal placeholder (SC-002)", () => {
    const { text, warnings } = renderString(
      "I'm a {{my_title}} focused on {{my_skills}}.",
      { contact: CONTACT, sender: makeProfile({ title: null, skills: null }) },
    );
    expect(text).toBe("I'm a  focused on .");
    expect(text).not.toMatch(/\{\{.*\}\}/);
    expect(warnings.map((w) => w.field).sort()).toEqual(["my_skills", "my_title"]);
  });

  it("warns for every used sender token when there is no profile at all", () => {
    const { text, warnings } = renderString(
      "{{my_name}} / {{my_title}} / {{my_pitch}}",
      { contact: CONTACT, sender: makeEmptyProfile() },
    );
    expect(text).not.toMatch(/\{\{.*\}\}/);
    expect(warnings.map((w) => w.field).sort()).toEqual(["my_name", "my_pitch", "my_title"]);
  });

  it("resolves sender tokens to blank (with warnings) when the sender context is omitted entirely", () => {
    const { text, warnings } = renderString("Hi {{first_name}} from {{my_name}}", { contact: CONTACT });
    expect(text).toBe("Hi Ada from ");
    expect(text).not.toMatch(/\{\{.*\}\}/);
    expect(warnings.map((w) => w.field)).toContain("my_name");
  });
});

describe("renderTemplate with both namespaces", () => {
  it("renders subject + body against contact and sender, merging warnings", () => {
    const out = renderTemplate(
      {
        subject: "{{full_name}}, a note from {{my_name}}",
        bodyHtml: "<p>I'm a {{my_title}} at {{my_location}}. {{my_pitch}}</p>",
        bodyText: "I'm a {{my_title}}.",
      },
      { contact: CONTACT, sender: makeProfile({ location: null }) },
    );
    expect(out.subject).toBe("Ada Lovelace, a note from Ada Lovelace");
    expect(out.bodyHtml).toContain("Senior Frontend Engineer");
    expect(out.bodyHtml).not.toMatch(/\{\{.*\}\}/);
    expect(out.warnings.map((w) => w.field)).toContain("my_location");
  });

  it("HTML-escapes merged sender values in the HTML body (stored-XSS guard)", () => {
    const out = renderTemplate(
      { subject: "x", bodyHtml: "<p>{{my_pitch}}</p>", bodyText: "x" },
      { contact: CONTACT, sender: makeProfile({ pitch: '<img src=x onerror="alert(1)">' }) },
    );
    expect(out.bodyHtml).not.toContain("<img");
    expect(out.bodyHtml).toContain("&lt;img");
  });
});

describe("extractTokens still sees both namespaces", () => {
  it("extracts recipient and sender tokens alike", () => {
    expect(extractTokens("{{first_name}} {{my_title}}").sort()).toEqual(["first_name", "my_title"]);
  });
});
