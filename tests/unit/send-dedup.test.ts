import { describe, it, expect } from "vitest";
import { dedupeRecipients, type Recipient } from "@/lib/send/service";

/** T060 [US4] — recipient dedup within a send (FR-016). */

function contact(id: string, email: string): Recipient {
  return { id, name: `Person ${id}`, email, company: null, role: null };
}

describe("dedupeRecipients", () => {
  it("keeps a single copy of a recruiter selected twice (case-insensitive)", () => {
    const result = dedupeRecipients([
      contact("a", "ada@x.com"),
      contact("b", "alan@x.com"),
      contact("c", "ADA@x.com"),
    ]);
    expect(result.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("preserves the first-seen order", () => {
    const result = dedupeRecipients([contact("1", "c@x.com"), contact("2", "a@x.com"), contact("3", "b@x.com")]);
    expect(result.map((r) => r.email)).toEqual(["c@x.com", "a@x.com", "b@x.com"]);
  });

  it("returns an empty array for no recipients", () => {
    expect(dedupeRecipients([])).toEqual([]);
  });
});
