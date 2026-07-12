import { describe, it, expect } from "vitest";
import { selectRestorable, replaceUndoSlot } from "@/lib/contacts/soft-delete";

/**
 * T042 [US4] — pure soft-delete logic (T1, Constitution II): restore skips rows whose email
 * now collides with a live contact, and the single undo slot commits the prior batch when a
 * new delete starts.
 */

describe("selectRestorable (collision skip on restore)", () => {
  const rows = [
    { id: "a", emailNormalized: "ada@x.com" },
    { id: "b", emailNormalized: "bo@x.com" },
    { id: "c", emailNormalized: "cy@x.com" },
  ];

  it("restores every row when no email collides with a live contact", () => {
    const r = selectRestorable(rows, []);
    expect(r.restore.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(r.skipped).toBe(0);
  });

  it("skips a row whose email is now used by a live contact", () => {
    const r = selectRestorable(rows, ["bo@x.com"]);
    expect(r.restore.map((x) => x.id)).toEqual(["a", "c"]);
    expect(r.skipped).toBe(1);
  });

  it("skips later rows in the batch that would restore to the same unique email", () => {
    const dup = [
      { id: "a", emailNormalized: "same@x.com" },
      { id: "b", emailNormalized: "same@x.com" },
    ];
    const r = selectRestorable(dup, []);
    expect(r.restore.map((x) => x.id)).toEqual(["a"]);
    expect(r.skipped).toBe(1);
  });
});

describe("replaceUndoSlot (single-slot commit-on-new-delete)", () => {
  it("a new delete replaces (commits) the prior pending batch", () => {
    const prev = { deletedBatch: "b1", count: 2 };
    const next = { deletedBatch: "b2", count: 5 };
    expect(replaceUndoSlot(prev, next)).toEqual(next);
  });

  it("works from an empty slot", () => {
    expect(replaceUndoSlot(null, { deletedBatch: "b1", count: 1 })).toEqual({ deletedBatch: "b1", count: 1 });
  });
});
