import { and, asc, eq, isNull } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/lib/db/client";
import { resumes, type ResumeRow } from "@/lib/db/schema";
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
        fileName: input.file.name,
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
 * Soft-delete an active resume (US3, FR-009/010). Only sets `deletedAt` — the R2 object is
 * retained, never purged, so it remains part of its label's history.
 */
export async function deleteResume(userId: string, id: string, db: Db = defaultDb): Promise<void> {
  const deleted = await db
    .update(resumes)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId), isNull(resumes.deletedAt)))
    .returning({ id: resumes.id });
  if (deleted.length === 0) throw new NotFoundError();
}

/**
 * Restore an archived resume as the active one for its label (US4, FR-012/013) — a
 * "revert to this version." Archives whatever row is currently active for that label (if
 * any) and reactivates the target, atomically. Does not mint a new version (the same
 * file is being reactivated, not re-uploaded).
 *
 * Note: this project's Neon HTTP driver (`drizzle-orm/neon-http`) has no `db.transaction`
 * support (it throws "No transactions support in neon-http driver"). `db.batch(...)`
 * (Neon's HTTP batch endpoint) is the atomic alternative used here.
 *
 * Restoring a version that's already active is a no-op (spec Edge Cases: "treated as
 * already satisfied — no change occurs"), not an error — it returns the resume unchanged.
 */
export async function restoreResume(userId: string, id: string, db: Db = defaultDb): Promise<Resume> {
  const [target] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId)))
    .limit(1);
  if (!target) throw new NotFoundError();
  if (target.deletedAt === null) return toResume(target);

  const [currentActive] = await db
    .select({ id: resumes.id })
    .from(resumes)
    .where(and(eq(resumes.userId, userId), eq(resumes.label, target.label), isNull(resumes.deletedAt)))
    .limit(1);

  const now = new Date();
  const reactivate = db.update(resumes).set({ deletedAt: null, updatedAt: now }).where(eq(resumes.id, target.id));
  if (currentActive) {
    // Archive the currently-active row BEFORE reactivating the target — the partial
    // unique index on (user_id, label) WHERE deleted_at IS NULL is checked per-statement,
    // not deferred to end of transaction, so reactivating first would momentarily leave
    // two active rows under the same label and violate it.
    const archiveCurrent = db.update(resumes).set({ deletedAt: now, updatedAt: now }).where(eq(resumes.id, currentActive.id));
    await db.batch([archiveCurrent, reactivate]);
  } else {
    await reactivate;
  }

  const [row] = await db.select().from(resumes).where(eq(resumes.id, target.id)).limit(1);
  return toResume(row!);
}

/**
 * Replace an active resume with a new file, in one step (a dedicated action, not a side
 * effect of `uploadResume` — see specs/002-resume-storage/plan for why these are separate:
 * `uploadResume` keeps unconditionally rejecting a duplicate label, FR-005/US1 unchanged).
 * Archives the target and inserts the new version atomically via `db.batch` (same reason
 * as `restoreResume`: this project's Neon HTTP driver has no `db.transaction()` support).
 *
 * Known, accepted gap at this feature's single-user scale: if two requests replace/delete
 * the same resume at nearly the same instant, `archiveOld`'s `isNull(deletedAt)` guard
 * could silently affect 0 rows while `insertNew` still proceeds — matching the same
 * unguarded-window risk `restoreResume` already carries between its reads and its batch.
 */
export async function replaceResume(
  userId: string,
  id: string,
  file: ResumeFile,
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

  const priorVersions = await db
    .select({ version: resumes.version })
    .from(resumes)
    .where(and(eq(resumes.userId, userId), eq(resumes.label, target.label)));
  const version = nextResumeVersion(priorVersions.map((v) => v.version));

  const newId = crypto.randomUUID();
  const storageKey = `${userId}/${newId}.pdf`;
  await storage.uploadObject(storageKey, file.buffer, "application/pdf");

  const now = new Date();
  const archiveOld = db
    .update(resumes)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(resumes.id, target.id), isNull(resumes.deletedAt)));
  const insertNew = db.insert(resumes).values({
    id: newId,
    userId,
    label: target.label,
    version,
    fileName: file.name,
    storageKey,
    fileSize: file.size,
  });

  try {
    await db.batch([archiveOld, insertNew]);
  } catch (err) {
    await storage.deleteObject(storageKey).catch(() => {});
    throw err;
  }

  const [row] = await db.select().from(resumes).where(eq(resumes.id, newId)).limit(1);
  return toResume(row!);
}
