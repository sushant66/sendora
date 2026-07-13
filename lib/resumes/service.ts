import { and, asc, eq, isNull } from "drizzle-orm";
import { db as defaultDb, runAtomic, type Db } from "@/lib/db/client";
import { resumes, sendBatches, type ResumeRow } from "@/lib/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { r2Storage } from "@/lib/storage/r2-client";
import type { ResumeStorage } from "@/lib/storage/types";
import { MAX_ACTIVE_RESUMES, type ResumeFile, type ResumeUploadInput } from "@/lib/validation/resumes";
import type { Resume } from "./types";

/**
 * Resumes service (User Story 1). All queries are scoped to `userId` (FR-014). The DB's
 * partial unique index on `(user_id, label) WHERE deleted_at IS NULL` is the real
 * uniqueness backstop (research.md §4); the pre-check here exists for a friendly error,
 * the same pre-check-then-insert pattern `lib/contacts/service.ts` already uses.
 */

export type { Resume } from "./types";

/** Pure row-to-DTO mapping: derives `status` from `deletedAt`, never leaks `storageKey`. */
export function toResume(row: ResumeRow): Resume {
  return {
    id: row.id,
    label: row.label,
    version: row.version,
    fileName: row.fileName,
    fileSize: row.fileSize,
    status: row.deletedAt ? "archived" : "active",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Next version number for a label's lineage — monotonic, never reused or reset (FR-011). */
export function nextResumeVersion(existingVersions: number[]): number {
  return existingVersions.length === 0 ? 1 : Math.max(...existingVersions) + 1;
}

export async function uploadResume(
  userId: string,
  input: ResumeUploadInput,
  opts: { db?: Db; storage?: ResumeStorage } = {},
): Promise<Resume> {
  const db = opts.db ?? defaultDb;
  const storage = opts.storage ?? r2Storage;

  const active = await db
    .select({ id: resumes.id })
    .from(resumes)
    .where(and(eq(resumes.userId, userId), isNull(resumes.deletedAt)));
  if (active.length >= MAX_ACTIVE_RESUMES) throw new ConflictError("resume_limit_reached");

  const [activeWithLabel] = await db
    .select({ id: resumes.id })
    .from(resumes)
    .where(and(eq(resumes.userId, userId), eq(resumes.label, input.label), isNull(resumes.deletedAt)))
    .limit(1);
  if (activeWithLabel) throw new ConflictError("label_taken");

  const priorVersions = await db
    .select({ version: resumes.version })
    .from(resumes)
    .where(and(eq(resumes.userId, userId), eq(resumes.label, input.label)));
  const version = nextResumeVersion(priorVersions.map((v) => v.version));

  const id = crypto.randomUUID();
  const storageKey = `${userId}/${id}.pdf`;
  await storage.uploadObject(storageKey, input.file.buffer, "application/pdf");

  try {
    const [row] = await db
      .insert(resumes)
      .values({
        id,
        userId,
        label: input.label,
        version,
        fileName: input.fileName ?? input.file.name,
        storageKey,
        fileSize: input.file.size,
      })
      .returning();
    return toResume(row!);
  } catch (err) {
    // Best-effort cleanup so a DB failure doesn't leave an orphaned R2 object.
    await storage.deleteObject(storageKey).catch(() => {});
    throw err;
  }
}

/** Active resumes by default (US2), ordered by label; includeArchived adds history rows (US4). */
export async function listResumes(
  userId: string,
  opts: { includeArchived?: boolean; db?: Db } = {},
): Promise<{ items: Resume[] }> {
  const db = opts.db ?? defaultDb;
  const filters = [eq(resumes.userId, userId)];
  if (!opts.includeArchived) filters.push(isNull(resumes.deletedAt));

  const rows = await db
    .select()
    .from(resumes)
    .where(and(...filters))
    .orderBy(asc(resumes.label), asc(resumes.version));
  return { items: rows.map(toResume) };
}

export type ResumeFileContent = {
  body: ReadableStream<Uint8Array>;
  contentLength?: number;
  fileName: string;
};

/** The stored PDF for an active or archived resume the caller owns (US2/US4, FR-008/014). */
export async function getResumeFile(
  userId: string,
  id: string,
  opts: { db?: Db; storage?: ResumeStorage } = {},
): Promise<ResumeFileContent> {
  const db = opts.db ?? defaultDb;
  const storage = opts.storage ?? r2Storage;

  const [row] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId)))
    .limit(1);
  if (!row) throw new NotFoundError();

  const object = await storage.getObjectStream(row.storageKey);
  if (!object) throw new NotFoundError();
  return { body: object.body, contentLength: object.contentLength, fileName: row.fileName };
}

/**
 * Whether any of the user's send batches attached this exact resume row. A resume that was
 * sent is part of the truthful record of what went out (Constitution II) — its file must
 * stay retrievable from history, so it is retained rather than purged. One that was never
 * sent references nothing and is safe to remove entirely.
 */
async function isReferencedBySend(userId: string, resumeId: string, db: Db): Promise<boolean> {
  const [hit] = await db
    .select({ id: sendBatches.id })
    .from(sendBatches)
    .where(and(eq(sendBatches.userId, userId), eq(sendBatches.attachedResumeId, resumeId)))
    .limit(1);
  return hit !== undefined;
}

/**
 * Delete an active resume (US3, FR-009/010), retain-if-sent:
 * - Never attached to a send → hard-delete the row and purge its R2 object. Nothing
 *   references it, so keeping either around is pure waste (the storage leak this fixes).
 * - Attached to a past send → soft-delete only (set `deletedAt`) and keep the R2 object,
 *   so `history` can still open the exact file that recipient received.
 *
 * The R2 object is purged only after the row is gone, and a not-found delete is swallowed
 * (`r2Storage.deleteObject` uses `isNotFoundError` upstream) so a retry or double-click is
 * idempotent rather than a hard error.
 */
export async function deleteResume(
  userId: string,
  id: string,
  opts: { db?: Db; storage?: ResumeStorage } = {},
): Promise<void> {
  const db = opts.db ?? defaultDb;
  const storage = opts.storage ?? r2Storage;

  const [target] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId), isNull(resumes.deletedAt)))
    .limit(1);
  if (!target) throw new NotFoundError();

  if (await isReferencedBySend(userId, target.id, db)) {
    await db
      .update(resumes)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(resumes.id, target.id), isNull(resumes.deletedAt)));
    return;
  }

  await db.delete(resumes).where(and(eq(resumes.id, target.id), eq(resumes.userId, userId)));
  await storage.deleteObject(target.storageKey).catch(() => {});
}

/**
 * Update an active resume's file in place — the user's mental model is "keep this resume
 * current," not "make a new version" (there is no user-facing versioning). A dedicated
 * action, not a side effect of `uploadResume` (which still rejects a duplicate label
 * unconditionally, FR-005/US1 unchanged). Retain-if-sent, mirroring `deleteResume`:
 *
 * - The current file was never attached to a send → overwrite the row in place (same id)
 *   with the new file, then purge the old R2 object. Nothing referenced the old file, so
 *   no history is lost and no orphan is left behind.
 * - The current file was attached to a past send → its bytes are part of the record of
 *   what went out, so keep that row (soft-deleted, its R2 object retained) as a frozen
 *   reference for history, and insert the new file as the active row. This is the only
 *   path that still mints a new row/version, and it is invisible to the user.
 *
 * The two-statement archive+insert runs atomically via `runAtomic` (lib/db/client): a
 * `db.batch` on Neon's HTTP driver, a real transaction on node-postgres.
 */
export async function replaceResume(
  userId: string,
  id: string,
  file: ResumeFile,
  fileName?: string,
  opts: { db?: Db; storage?: ResumeStorage } = {},
): Promise<Resume> {
  const db = opts.db ?? defaultDb;
  const storage = opts.storage ?? r2Storage;

  const [target] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId)))
    .limit(1);
  if (!target || target.deletedAt !== null) throw new NotFoundError();

  const newId = crypto.randomUUID();
  const storageKey = `${userId}/${newId}.pdf`;
  await storage.uploadObject(storageKey, file.buffer, "application/pdf");

  const now = new Date();
  const values = { fileName: fileName ?? file.name, storageKey, fileSize: file.size, updatedAt: now };

  if (await isReferencedBySend(userId, target.id, db)) {
    const priorVersions = await db
      .select({ version: resumes.version })
      .from(resumes)
      .where(and(eq(resumes.userId, userId), eq(resumes.label, target.label)));
    const version = nextResumeVersion(priorVersions.map((v) => v.version));
    try {
      await runAtomic(db, (x) => [
        x
          .update(resumes)
          .set({ deletedAt: now, updatedAt: now })
          .where(and(eq(resumes.id, target.id), isNull(resumes.deletedAt))),
        x.insert(resumes).values({ id: newId, userId, label: target.label, version, ...values }),
      ]);
    } catch (err) {
      await storage.deleteObject(storageKey).catch(() => {});
      throw err;
    }
    const [row] = await db.select().from(resumes).where(eq(resumes.id, newId)).limit(1);
    return toResume(row!);
  }

  // Never sent: overwrite in place, then purge the now-orphaned old file.
  try {
    await db.update(resumes).set(values).where(eq(resumes.id, target.id));
  } catch (err) {
    await storage.deleteObject(storageKey).catch(() => {});
    throw err;
  }
  await storage.deleteObject(target.storageKey).catch(() => {});
  const [row] = await db.select().from(resumes).where(eq(resumes.id, target.id)).limit(1);
  return toResume(row!);
}
