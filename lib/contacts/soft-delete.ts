import { and, eq, ilike, inArray, isNull, isNotNull, notInArray, or } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/lib/db/client";
import { recruiterContacts } from "@/lib/db/schema";
import { NotFoundError } from "@/lib/errors";

/**
 * Soft-delete + restore (feature 002, US4, FR-022/FR-023/FR-024). A delete tags rows with one
 * `deletedBatch` and a `deletedAt`; undo clears both for that batch. Every query is scoped to
 * the owner, so a user can never delete or restore another user's contacts (FR-024). Restore
 * skips any row whose email now collides with a live contact (the partial unique index would
 * otherwise reject it) and reports that honestly.
 */

export type BulkDeleteInput = {
  ids?: string[];
  matchAll?: boolean;
  query?: string;
  excludedIds?: string[];
};

/** The single client-side undo slot only ever holds the latest delete; starting a new delete
 *  commits (drops) the prior one (FR-023). Pure so the UI's slot logic is directly testable. */
export type UndoSlot = { deletedBatch: string; count: number };
export function replaceUndoSlot(_prev: UndoSlot | null, next: UndoSlot): UndoSlot {
  return next;
}

/**
 * Decide which soft-deleted rows can be restored: skip any whose email is already taken by a
 * live contact, or claimed by an earlier row in the same batch (two rows can't restore to one
 * unique email). Pure — the collision rule is unit-tested here, independent of the DB.
 */
export function selectRestorable<T extends { id: string; emailNormalized: string }>(
  rows: T[],
  liveEmails: Iterable<string>,
): { restore: T[]; skipped: number } {
  const live = new Set(liveEmails);
  const claimed = new Set<string>();
  const restore: T[] = [];
  let skipped = 0;
  for (const r of rows) {
    if (live.has(r.emailNormalized) || claimed.has(r.emailNormalized)) {
      skipped++;
      continue;
    }
    claimed.add(r.emailNormalized);
    restore.push(r);
  }
  return { restore, skipped };
}

/** Soft-delete live contacts by ids or by the current search, in one batch (US4, FR-020). */
export async function softDeleteContacts(
  userId: string,
  input: BulkDeleteInput,
  db: Db = defaultDb,
): Promise<{ deletedBatch: string; count: number }> {
  const deletedBatch = crypto.randomUUID();
  const now = new Date();

  // Only ever touch live rows owned by the caller.
  const filters = [eq(recruiterContacts.userId, userId), isNull(recruiterContacts.deletedAt)];

  if (input.ids && input.ids.length > 0) {
    filters.push(inArray(recruiterContacts.id, input.ids));
  } else if (input.matchAll) {
    const q = input.query?.trim();
    if (q) {
      const like = `%${q}%`;
      filters.push(
        or(
          ilike(recruiterContacts.name, like),
          ilike(recruiterContacts.email, like),
          ilike(recruiterContacts.company, like),
        )!,
      );
    }
    if (input.excludedIds && input.excludedIds.length > 0) {
      filters.push(notInArray(recruiterContacts.id, input.excludedIds));
    }
  } else {
    return { deletedBatch, count: 0 };
  }

  const updated = await db
    .update(recruiterContacts)
    .set({ deletedAt: now, deletedBatch, updatedAt: now })
    .where(and(...filters))
    .returning({ id: recruiterContacts.id });

  return { deletedBatch, count: updated.length };
}

/** Undo one delete batch (US4, FR-023). 404 if the batch is unknown/committed for this user. */
export async function restoreBatch(
  userId: string,
  deletedBatch: string,
  db: Db = defaultDb,
): Promise<{ restored: number; skipped: number }> {
  const rows = await db
    .select({ id: recruiterContacts.id, emailNormalized: recruiterContacts.emailNormalized })
    .from(recruiterContacts)
    .where(
      and(
        eq(recruiterContacts.userId, userId),
        eq(recruiterContacts.deletedBatch, deletedBatch),
        isNotNull(recruiterContacts.deletedAt),
      ),
    );
  if (rows.length === 0) throw new NotFoundError("delete batch not found");

  const live = await db
    .select({ emailNormalized: recruiterContacts.emailNormalized })
    .from(recruiterContacts)
    .where(and(eq(recruiterContacts.userId, userId), isNull(recruiterContacts.deletedAt)));

  const { restore, skipped } = selectRestorable(rows, live.map((r) => r.emailNormalized));

  if (restore.length > 0) {
    await db
      .update(recruiterContacts)
      .set({ deletedAt: null, deletedBatch: null, updatedAt: new Date() })
      .where(
        and(
          eq(recruiterContacts.userId, userId),
          inArray(
            recruiterContacts.id,
            restore.map((r) => r.id),
          ),
        ),
      );
  }

  return { restored: restore.length, skipped };
}
