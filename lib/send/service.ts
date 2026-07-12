import { and, eq, inArray, isNull } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/lib/db/client";
import { recruiterContacts, sendBatches, sendRecords } from "@/lib/db/schema";
import { NotFoundError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/validation/contacts";
import type { SendRequest } from "@/lib/validation/send";
import { renderTemplate, type SenderContext } from "@/lib/templates/merge";
import { resolveContent } from "@/lib/templates/preview";
import { getProfile } from "@/lib/profile/service";
import { senderContextFromProfile } from "@/lib/profile/context";
import { getActiveAccount, markAccountExpired } from "@/lib/email/account-service";
import { resolveProvider } from "@/lib/email/factory";
import { REAUTH_REQUIRED, type EmailProvider, type ProviderCredentials } from "@/lib/email/provider";
import type { SendResultItem, SendSummary } from "./types";

/**
 * Send service (User Story 2 single + User Story 4 bulk). One uniform path handles both:
 * dedup recipients (FR-016) → create a batch → render + send one message per recruiter via
 * the provider seam → snapshot each SendRecord outcome. Partial failures never roll back
 * successful sends (FR-018); a mid-batch reauth failure marks the account expired and fails
 * the remaining recipients with a clear reason (FR-019b).
 *
 * The dedup and per-recipient send loop are pure (DB-free) so they are directly unit- and
 * integration-testable with the fake provider.
 */

export type Recipient = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role: string | null;
};

/** One rendered, attempted send — the snapshot persisted as a SendRecord. */
export type RenderedSend = {
  contactId: string;
  recipientEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  status: "sent" | "failed";
  reason?: string;
  providerMessageId: string | null;
  sentAt: Date | null;
};

/** Dedup recipients on normalized email, preserving request order (FR-016). */
export function dedupeRecipients(recipients: Recipient[]): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const r of recipients) {
    const key = normalizeEmail(r.email);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/**
 * Send one message per recipient, rendering the base content for each. Pure of the DB.
 * `onReauthRequired` is invoked once if the provider signals re-authorization; the
 * remaining recipients are then failed without further provider calls (FR-018/019b).
 */
export async function runSendLoop(
  recipients: Recipient[],
  base: { subject: string; bodyHtml: string; bodyText: string },
  from: { email: string; name: string | null },
  provider: EmailProvider,
  credentials: ProviderCredentials,
  onReauthRequired?: () => void | Promise<void>,
  sender?: SenderContext,
): Promise<RenderedSend[]> {
  const out: RenderedSend[] = [];
  let accountDisabled = false;

  for (const contact of recipients) {
    const rendered = renderTemplate(base, {
      contact: { name: contact.name, company: contact.company, role: contact.role },
      sender,
    });
    const record: RenderedSend = {
      contactId: contact.id,
      recipientEmail: contact.email,
      subject: rendered.subject,
      bodyHtml: rendered.bodyHtml,
      bodyText: rendered.bodyText,
      status: "failed",
      providerMessageId: null,
      sentAt: null,
    };

    if (accountDisabled) {
      record.reason = REAUTH_REQUIRED;
    } else {
      const result = await provider.sendEmail(
        { fromEmail: from.email, fromName: from.name ?? undefined, to: contact.email, subject: rendered.subject, bodyHtml: rendered.bodyHtml, bodyText: rendered.bodyText },
        credentials,
      );
      if (result.status === "sent") {
        record.status = "sent";
        record.providerMessageId = result.providerMessageId;
        record.sentAt = new Date();
      } else {
        record.reason = result.reason;
        if (result.reason === REAUTH_REQUIRED) {
          accountDisabled = true;
          await onReauthRequired?.();
        }
      }
    }
    out.push(record);
  }
  return out;
}

export async function sendEmails(
  userId: string,
  request: SendRequest,
  fromName: string | null,
  opts: { db?: Db; provider?: EmailProvider } = {},
): Promise<SendSummary> {
  const db = opts.db ?? defaultDb;

  // Precondition: an active connected account (else ConflictError "no_active_account" → 409).
  const account = await getActiveAccount(userId, db);
  const provider = opts.provider ?? resolveProvider(account.providerKey);

  const contactRows = await db
    .select()
    .from(recruiterContacts)
    .where(
      and(
        eq(recruiterContacts.userId, userId),
        inArray(recruiterContacts.id, request.contactIds),
        isNull(recruiterContacts.deletedAt),
      ),
    );
  const byId = new Map(contactRows.map((c) => [c.id, c]));
  // Preserve request order (unknown/unowned ids skipped) before dedup.
  const ordered = request.contactIds.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const recipients = dedupeRecipients(ordered);

  const base = await resolveContent(
    userId,
    request.override ? { inline: request.override } : { templateId: request.templateId },
    db,
  );

  // Sender (`my_*`) fields resolve from the profile; the display name falls back to the
  // account name (FR-001). Loaded once and reused across every recipient in the batch.
  const profile = await getProfile(userId, db);
  const sender = senderContextFromProfile(profile, fromName);

  const kind = recipients.length > 1 ? "bulk" : "single";
  const [batch] = await db
    .insert(sendBatches)
    .values({ userId, connectedAccountId: account.row.id, templateId: request.templateId ?? null, kind, total: recipients.length, status: "in_progress" })
    .returning();
  const batchId = batch!.id;

  const rendered = await runSendLoop(
    recipients,
    base,
    { email: account.row.emailAddress, name: fromName },
    provider,
    account.credentials,
    () => markAccountExpired(account.row.id, db),
    sender,
  );

  if (rendered.length > 0) {
    await db.insert(sendRecords).values(
      rendered.map((r) => ({
        userId,
        batchId,
        contactId: r.contactId,
        recipientEmail: r.recipientEmail,
        subject: r.subject,
        bodyHtml: r.bodyHtml,
        bodyText: r.bodyText,
        status: r.status,
        failureReason: r.reason ?? null,
        providerMessageId: r.providerMessageId,
        sentAt: r.sentAt,
      })),
    );
  }

  const sent = rendered.filter((r) => r.status === "sent").length;
  const failed = rendered.length - sent;
  await db
    .update(sendBatches)
    .set({ sentCount: sent, failedCount: failed, status: "completed", updatedAt: new Date() })
    .where(eq(sendBatches.id, batchId));

  const results: SendResultItem[] = rendered.map((r) => ({
    contactId: r.contactId,
    recipientEmail: r.recipientEmail,
    status: r.status,
    reason: r.reason,
  }));
  return { batchId, total: recipients.length, sent, failed, results };
}

/**
 * Resend an existing send record's immutable snapshot to the same recipient (US5 recovery).
 * The content is already final (merge fields resolved at the original send), so it is sent
 * verbatim — no re-render. Creates a new single-send batch + record, reusing the provider
 * seam and active-account precondition. 404 if the record isn't the caller's; 409
 * `no_active_account` if no Gmail is connected.
 */
export async function resendRecord(
  userId: string,
  recordId: string,
  fromName: string | null,
  opts: { db?: Db; provider?: EmailProvider } = {},
): Promise<{ recordId: string; status: "sent" | "failed"; reason: string | null }> {
  const db = opts.db ?? defaultDb;

  const [rec] = await db
    .select()
    .from(sendRecords)
    .where(and(eq(sendRecords.userId, userId), eq(sendRecords.id, recordId)))
    .limit(1);
  if (!rec) throw new NotFoundError();

  const account = await getActiveAccount(userId, db);
  const provider = opts.provider ?? resolveProvider(account.providerKey);

  const [batch] = await db
    .insert(sendBatches)
    .values({ userId, connectedAccountId: account.row.id, templateId: null, kind: "single", total: 1, status: "in_progress" })
    .returning();
  const batchId = batch!.id;

  let status: "sent" | "failed" = "failed";
  let reason: string | null = null;
  let providerMessageId: string | null = null;
  let sentAt: Date | null = null;

  const result = await provider.sendEmail(
    {
      fromEmail: account.row.emailAddress,
      fromName: fromName ?? undefined,
      to: rec.recipientEmail,
      subject: rec.subject,
      bodyHtml: rec.bodyHtml,
      bodyText: rec.bodyText,
    },
    account.credentials,
  );
  if (result.status === "sent") {
    status = "sent";
    providerMessageId = result.providerMessageId;
    sentAt = new Date();
  } else {
    reason = result.reason;
    if (result.reason === REAUTH_REQUIRED) await markAccountExpired(account.row.id, db);
  }

  const [newRec] = await db
    .insert(sendRecords)
    .values({
      userId,
      batchId,
      contactId: rec.contactId,
      recipientEmail: rec.recipientEmail,
      subject: rec.subject,
      bodyHtml: rec.bodyHtml,
      bodyText: rec.bodyText,
      status,
      failureReason: reason,
      providerMessageId,
      sentAt,
    })
    .returning();

  await db
    .update(sendBatches)
    .set({ sentCount: status === "sent" ? 1 : 0, failedCount: status === "failed" ? 1 : 0, status: "completed", updatedAt: new Date() })
    .where(eq(sendBatches.id, batchId));

  return { recordId: newRec!.id, status, reason };
}
