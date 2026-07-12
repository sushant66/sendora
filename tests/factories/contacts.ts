import type { RecruiterContactRow } from "@/lib/db/schema";

/**
 * Test factory for a RecruiterContact row (feature 002, US4). Defaults are live (not
 * soft-deleted); pass `deletedAt`/`deletedBatch` to model a row removed by a delete action.
 */
export function makeContactRow(overrides: Partial<RecruiterContactRow> = {}): RecruiterContactRow {
  const email = overrides.email ?? "ada@analyticalengines.com";
  return {
    id: "c_1",
    userId: "u1",
    name: "Ada Lovelace",
    email,
    emailNormalized: email.trim().toLowerCase(),
    company: "Analytical Engines",
    role: "Lead Recruiter",
    source: "manual",
    createdAt: new Date("2026-07-11T00:00:00.000Z"),
    updatedAt: new Date("2026-07-11T00:00:00.000Z"),
    deletedAt: null,
    deletedBatch: null,
    ...overrides,
  };
}

/** A soft-deleted contact row tagged with a delete batch. */
export function makeDeletedContactRow(
  batch: string,
  overrides: Partial<RecruiterContactRow> = {},
): RecruiterContactRow {
  return makeContactRow({
    deletedAt: new Date("2026-07-12T00:00:00.000Z"),
    deletedBatch: batch,
    ...overrides,
  });
}
