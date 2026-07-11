import { and, desc, eq, inArray, isNotNull, max, sql } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/lib/db/client";
import { sendRecords, sendBatches, emailTemplates } from "@/lib/db/schema";
import type { HistoryItem, HistoryList, RecontactInfo } from "./types";

/**
 * Sending-history service (User Story 5). All queries scoped to `userId` (FR-022).
 * History lists sends newest-first (FR-020); the re-contact lookup finds recruiters the
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

export async function listHistory(
  userId: string,
  opts: { cursor?: string } = {},
  db: Db = defaultDb,
): Promise<HistoryList> {
  const filters = [eq(sendRecords.userId, userId)];
  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (cursor) {
    filters.push(sql`(${sendRecords.createdAt}, ${sendRecords.id}) < (${cursor.createdAt.toISOString()}, ${cursor.id})`);
  }

  const rows = await db
    .select({
      id: sendRecords.id,
      recipientEmail: sendRecords.recipientEmail,
      contactId: sendRecords.contactId,
      subject: sendRecords.subject,
      status: sendRecords.status,
      failureReason: sendRecords.failureReason,
      sentAt: sendRecords.sentAt,
      createdAt: sendRecords.createdAt,
      batchId: sendRecords.batchId,
      templateName: emailTemplates.name,
    })
    .from(sendRecords)
    .leftJoin(sendBatches, eq(sendRecords.batchId, sendBatches.id))
    .leftJoin(emailTemplates, eq(sendBatches.templateId, emailTemplates.id))
    .where(and(...filters))
    .orderBy(desc(sendRecords.createdAt), desc(sendRecords.id))
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const last = page[page.length - 1];

  const items: HistoryItem[] = page.map((r) => ({
    id: r.id,
    recipientEmail: r.recipientEmail,
    contactId: r.contactId,
    subject: r.subject,
    templateName: r.templateName ?? null,
    status: r.status as HistoryItem["status"],
    failureReason: r.failureReason,
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    batchId: r.batchId,
  }));

  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
  };
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
