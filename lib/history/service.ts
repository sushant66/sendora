import { and, asc, desc, eq, inArray, isNotNull, max, sql } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/lib/db/client";
import { connectedEmailAccounts, recruiterContacts, resumes, sendBatches, sendRecords } from "@/lib/db/schema";
import type {
  AttachedResumeInfo,
  HistoryBatchRecords,
  HistoryDetail,
  HistoryEvent,
  HistoryList,
  HistoryRecord,
  RecontactInfo,
  SendStatus,
} from "./types";

/**
 * Sending-history service (User Story 5). All queries scoped to `userId` (FR-022).
 * History lists sends newest-first (FR-020), grouped by send event (batch) so a bulk
 * send reads as one expandable event rather than a wall of rows. Every record carries an
 * immutable content snapshot (subject/body), so the detail view shows exactly what was
 * sent even after the source template changes. The re-contact lookup finds recruiters the
 * user has already emailed successfully (FR-021).
 */

const PAGE_SIZE = 50;

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}
function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
  } catch {
    return null;
  }
}

/** Columns for a per-recipient record summary, with the contact's name joined in. */
const recordCols = {
  id: sendRecords.id,
  batchId: sendRecords.batchId,
  recipientEmail: sendRecords.recipientEmail,
  contactId: sendRecords.contactId,
  subject: sendRecords.subject,
  status: sendRecords.status,
  failureReason: sendRecords.failureReason,
  sentAt: sendRecords.sentAt,
  createdAt: sendRecords.createdAt,
  recipientName: recruiterContacts.name,
};

type RecordRow = {
  id: string;
  recipientEmail: string;
  contactId: string | null;
  subject: string;
  status: string;
  failureReason: string | null;
  sentAt: Date | null;
  createdAt: Date;
  recipientName: string | null;
};

function toRecord(r: RecordRow): HistoryRecord {
  return {
    id: r.id,
    recipientName: r.recipientName,
    recipientEmail: r.recipientEmail,
    contactId: r.contactId,
    subject: r.subject,
    status: r.status as SendStatus,
    failureReason: r.failureReason,
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

/** List send events newest-first, paginated by batch (US5, FR-020). */
export async function listHistory(
  userId: string,
  opts: { cursor?: string } = {},
  db: Db = defaultDb,
): Promise<HistoryList> {
  const filters = [eq(sendBatches.userId, userId)];
  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (cursor) {
    filters.push(sql`(${sendBatches.createdAt}, ${sendBatches.id}) < (${cursor.createdAt.toISOString()}, ${cursor.id})`);
  }

  const batches = await db
    .select({
      id: sendBatches.id,
      kind: sendBatches.kind,
      createdAt: sendBatches.createdAt,
      total: sendBatches.total,
      sent: sendBatches.sentCount,
      failed: sendBatches.failedCount,
      attachedResumeId: sendBatches.attachedResumeId,
    })
    .from(sendBatches)
    .where(and(...filters))
    .orderBy(desc(sendBatches.createdAt), desc(sendBatches.id))
    .limit(PAGE_SIZE + 1);

  const hasMore = batches.length > PAGE_SIZE;
  const page = hasMore ? batches.slice(0, PAGE_SIZE) : batches;
  const last = page[page.length - 1];

  // Attach the single record for single-kind batches so those rows render and open directly.
  const singleIds = page.filter((b) => b.kind === "single").map((b) => b.id);
  const recordByBatch = new Map<string, HistoryRecord>();
  if (singleIds.length > 0) {
    const recs = await db
      .select(recordCols)
      .from(sendRecords)
      .leftJoin(recruiterContacts, eq(sendRecords.contactId, recruiterContacts.id))
      .where(and(eq(sendRecords.userId, userId), inArray(sendRecords.batchId, singleIds)));
    for (const r of recs) {
      if (!recordByBatch.has(r.batchId)) recordByBatch.set(r.batchId, toRecord(r));
    }
  }

  // 003-resume-attachments: resolve which resume (label + fileName) each batch attached,
  // if any. Tolerates the join coming back empty (treated as no attachment shown), the
  // same way a deleted contact's name is already tolerated above, even though resumes are
  // never hard-deleted today (FR-007/FR-008).
  const resumeIds = [...new Set(page.map((b) => b.attachedResumeId).filter((id): id is string => id !== null))];
  const resumeById = new Map<string, AttachedResumeInfo>();
  if (resumeIds.length > 0) {
    const resumeRows = await db
      .select({ id: resumes.id, label: resumes.label, fileName: resumes.fileName })
      .from(resumes)
      .where(and(eq(resumes.userId, userId), inArray(resumes.id, resumeIds)));
    for (const r of resumeRows) resumeById.set(r.id, { label: r.label, fileName: r.fileName });
  }

  const items: HistoryEvent[] = page.map((b) => ({
    id: b.id,
    kind: b.kind as "single" | "bulk",
    when: b.createdAt.toISOString(),
    total: b.total,
    sent: b.sent,
    failed: b.failed,
    record: b.kind === "single" ? recordByBatch.get(b.id) ?? null : null,
    attachedResume: b.attachedResumeId ? resumeById.get(b.attachedResumeId) ?? null : null,
  }));

  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}

/** The per-recipient records of one owned batch (expanding a bulk event). Failed first. */
export async function getBatchRecords(
  userId: string,
  batchId: string,
  db: Db = defaultDb,
): Promise<HistoryBatchRecords> {
  const recs = await db
    .select(recordCols)
    .from(sendRecords)
    .leftJoin(recruiterContacts, eq(sendRecords.contactId, recruiterContacts.id))
    .where(and(eq(sendRecords.userId, userId), eq(sendRecords.batchId, batchId)))
    // status text sorts failed < pending < sent, so failures surface first.
    .orderBy(asc(sendRecords.status), asc(sendRecords.recipientEmail));
  return { records: recs.map(toRecord) };
}

/** The full immutable snapshot for one owned record (the detail drawer). null → 404. */
export async function getHistoryDetail(
  userId: string,
  recordId: string,
  db: Db = defaultDb,
): Promise<HistoryDetail | null> {
  const [row] = await db
    .select({
      ...recordCols,
      bodyHtml: sendRecords.bodyHtml,
      bodyText: sendRecords.bodyText,
      fromEmail: connectedEmailAccounts.emailAddress,
      batchKind: sendBatches.kind,
      batchTotal: sendBatches.total,
      batchSent: sendBatches.sentCount,
      batchFailed: sendBatches.failedCount,
      resumeLabel: resumes.label,
      resumeFileName: resumes.fileName,
    })
    .from(sendRecords)
    .leftJoin(recruiterContacts, eq(sendRecords.contactId, recruiterContacts.id))
    .innerJoin(sendBatches, eq(sendRecords.batchId, sendBatches.id))
    .leftJoin(connectedEmailAccounts, eq(sendBatches.connectedAccountId, connectedEmailAccounts.id))
    .leftJoin(resumes, and(eq(sendBatches.attachedResumeId, resumes.id), eq(resumes.userId, userId)))
    .where(and(eq(sendRecords.userId, userId), eq(sendRecords.id, recordId)))
    .limit(1);

  if (!row) return null;

  return {
    ...toRecord(row),
    bodyHtml: row.bodyHtml,
    bodyText: row.bodyText,
    fromEmail: row.fromEmail ?? "",
    batch: {
      id: row.batchId,
      kind: row.batchKind as "single" | "bulk",
      total: row.batchTotal,
      sent: row.batchSent,
      failed: row.batchFailed,
    },
    // Tolerates the join coming back empty, same reasoning as listHistory above.
    attachedResume: row.resumeLabel !== null && row.resumeFileName !== null ? { label: row.resumeLabel, fileName: row.resumeFileName } : null,
  };
}

/** Flat, newest-first individual sends for the dashboard's recent-activity feed. */
export async function listRecentRecords(
  userId: string,
  limit = 5,
  db: Db = defaultDb,
): Promise<HistoryRecord[]> {
  const recs = await db
    .select(recordCols)
    .from(sendRecords)
    .leftJoin(recruiterContacts, eq(sendRecords.contactId, recruiterContacts.id))
    .where(eq(sendRecords.userId, userId))
    .orderBy(desc(sendRecords.createdAt), desc(sendRecords.id))
    .limit(limit);
  return recs.map(toRecord);
}

/** Whether the user has ever successfully sent an email (drives dashboard activation state). */
export async function hasSentAny(userId: string, db: Db = defaultDb): Promise<boolean> {
  const [row] = await db
    .select({ id: sendRecords.id })
    .from(sendRecords)
    .where(and(eq(sendRecords.userId, userId), eq(sendRecords.status, "sent")))
    .limit(1);
  return Boolean(row);
}

/** For the given contacts, which were already emailed successfully, and when last (FR-021). */
export async function getRecontactInfo(
  userId: string,
  contactIds: string[],
  db: Db = defaultDb,
): Promise<RecontactInfo> {
  if (contactIds.length === 0) return { previouslyContacted: [] };

  const rows = await db
    .select({ contactId: sendRecords.contactId, lastSentAt: max(sendRecords.sentAt) })
    .from(sendRecords)
    .where(
      and(
        eq(sendRecords.userId, userId),
        eq(sendRecords.status, "sent"),
        isNotNull(sendRecords.contactId),
        inArray(sendRecords.contactId, contactIds),
      ),
    )
    .groupBy(sendRecords.contactId);

  return {
    previouslyContacted: rows
      .filter((r): r is { contactId: string; lastSentAt: Date } => r.contactId !== null && r.lastSentAt !== null)
      .map((r) => ({ contactId: r.contactId, lastSentAt: r.lastSentAt.toISOString() })),
  };
}
