import { describe, it, expect } from "vitest";
import { renderTemplate } from "@/lib/templates/merge";
import { senderContextFromProfile } from "@/lib/profile/context";
import { makeProfile, makeEmptyProfile } from "@/tests/factories/profile";

/**
 * T010 [US1] — the profile → sender-context → render seam. A saved profile fills `my_*`
 * fields; empty sender values warn (never a literal placeholder); and a send is never blocked
 * by the absence of a profile (FR-006). Exercises the pure seam directly, no DB.
 */

const TEMPLATE = {
  subject: "{{full_name}}, a note from {{my_name}}",
  bodyHtml: "<p>I'm {{my_name}}, a {{my_title}}. {{my_pitch}} — {{my_link}}</p>",
  bodyText: "I'm {{my_name}}, a {{my_title}}.",
};
const CONTACT = { name: "Grace Hopper", company: "Navy", role: "Rear Admiral" };

describe("profile drives the sender merge fields", () => {
  it("resolves `my_*` from a saved profile", () => {
    const out = renderTemplate(TEMPLATE, {
      contact: CONTACT,
      sender: senderContextFromProfile(makeProfile(), "Account Name"),
    });
    expect(out.subject).toBe("Grace Hopper, a note from Ada Lovelace");
    expect(out.bodyHtml).toContain("Senior Frontend Engineer");
    expect(out.bodyHtml).not.toMatch(/\{\{.*\}\}/);
    expect(out.warnings).toEqual([]);
  });

  it("falls back the display name to the account name when the profile name is empty (FR-001)", () => {
    const ctx = senderContextFromProfile(makeProfile({ displayName: null }), "Ada from Google");
    expect(ctx.displayName).toBe("Ada from Google");
    const out = renderTemplate(TEMPLATE, { contact: CONTACT, sender: ctx });
    expect(out.subject).toContain("Ada from Google");
  });

  it("warns for empty sender fields but emits no literal placeholder", () => {
    const out = renderTemplate(TEMPLATE, {
      contact: CONTACT,
      sender: senderContextFromProfile(makeEmptyProfile(), null),
    });
    expect(out.bodyHtml).not.toMatch(/\{\{.*\}\}/);
    expect(out.warnings.map((w) => w.field).sort()).toEqual(
      expect.arrayContaining(["my_name", "my_pitch", "my_title"]),
    );
  });

  it("never blocks a send when there is no profile at all (sender omitted)", () => {
    expect(() => renderTemplate(TEMPLATE, { contact: CONTACT })).not.toThrow();
    const out = renderTemplate(TEMPLATE, { contact: CONTACT });
    expect(out.bodyHtml).not.toMatch(/\{\{.*\}\}/);
  });

  it("builds an empty-but-valid context from a null profile with a null fallback", () => {
    const ctx = senderContextFromProfile(null, null);
    expect(ctx.displayName).toBeNull();
    expect(ctx.title).toBeNull();
  });
});
