import { describe, it, expect } from "vitest";
import { computeMissingValues } from "@/lib/compose/missing-values";
import { makeProfile, makeEmptyProfile } from "@/tests/factories/profile";

/**
 * T031 [US3] — the pre-send missing-value computation over a selection (FR-016). It reports
 * which used recipient tokens are empty per contact and which used sender tokens are empty
 * (for everyone), and picks a representative affected recipient for the "how it reads" sample.
 */

const CONTACTS = [
  { id: "c1", name: "Ada Lovelace", email: "ada@x.com", company: "Acme", role: "Recruiter" },
  { id: "c2", name: "Bo North", email: "bo@x.com", company: null, role: "Lead" },
  { id: "c3", name: "Cy West", email: "cy@x.com", company: "Globex", role: null },
];

describe("computeMissingValues", () => {
  it("reports no missing values when every used field resolves", () => {
    const r = computeMissingValues({
      subject: "Hi {{first_name}}",
      bodyHtml: "<p>I'm {{my_name}} at {{my_title}}</p>",
      contacts: [CONTACTS[0]!],
      profile: makeProfile(),
    });
    expect(r.hasMissing).toBe(false);
    expect(r.affectedCount).toBe(0);
    expect(r.usedTokens.sort()).toEqual(["first_name", "my_name", "my_title"]);
  });

  it("ignores identity tokens (they fall back to a greeting, never 'missing')", () => {
    const r = computeMissingValues({
      subject: "Hi {{first_name}} {{last_name}} {{full_name}}",
      bodyHtml: "<p></p>",
      contacts: [{ id: "c", name: "", email: "e@x.com", company: "A", role: "R" }],
      profile: makeProfile(),
    });
    expect(r.hasMissing).toBe(false);
  });

  it("flags recipients missing a used recipient token (company/role)", () => {
    const r = computeMissingValues({
      subject: "Role at {{company}}",
      bodyHtml: "<p>the {{role}} position</p>",
      contacts: CONTACTS,
      profile: makeProfile(),
    });
    expect(r.hasMissing).toBe(true);
    // c2 missing company, c3 missing role.
    const byId = Object.fromEntries(r.affected.map((a) => [a.contactId, a.missing.sort()]));
    expect(byId.c2).toEqual(["company"]);
    expect(byId.c3).toEqual(["role"]);
    expect(byId.c1).toBeUndefined();
    expect(r.affectedCount).toBe(2);
    expect(r.representativeContactId).toBe("c2");
  });

  it("flags empty sender tokens as affecting every recipient", () => {
    const r = computeMissingValues({
      subject: "A note from {{my_name}}",
      bodyHtml: "<p>I'm a {{my_title}} focused on {{my_skills}}</p>",
      contacts: CONTACTS,
      profile: makeEmptyProfile(),
    });
    expect(r.senderMissing.sort()).toEqual(["my_name", "my_skills", "my_title"]);
    // Sender fields appear in every email, so all recipients are affected.
    expect(r.affectedCount).toBe(3);
    expect(r.representativeContactId).toBe("c1");
  });

  it("does not flag {{my_name}} when it resolves via the account-name fallback (FR-001)", () => {
    const r = computeMissingValues({
      subject: "A note from {{my_name}}",
      bodyHtml: "<p>I'm a {{my_title}}</p>",
      contacts: [CONTACTS[0]!],
      profile: makeEmptyProfile(),
      accountName: "Sushant Kadam",
    });
    // my_name falls back to the account name, so it is not missing; my_title still is.
    expect(r.senderMissing).toEqual(["my_title"]);
  });

  it("returns no missing when the selection is empty", () => {
    const r = computeMissingValues({ subject: "{{company}}", bodyHtml: "", contacts: [], profile: makeProfile() });
    expect(r.hasMissing).toBe(false);
    expect(r.representativeContactId).toBeNull();
  });
});
