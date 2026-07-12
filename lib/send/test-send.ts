import { and, eq, isNull } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/lib/db/client";
import { recruiterContacts } from "@/lib/db/schema";
import { renderTemplate } from "@/lib/templates/merge";
import { resolveContent } from "@/lib/templates/preview";
import { getProfile } from "@/lib/profile/service";
import { senderContextFromProfile } from "@/lib/profile/context";
import { getActiveAccount } from "@/lib/email/account-service";
import { resolveProvider } from "@/lib/email/factory";
import type { EmailProvider } from "@/lib/email/provider";
import type { TestSendRequest } from "@/lib/validation/send";

/**
 * Test send (feature 002, US3, FR-015). Renders the current draft (with `my_*` resolved,
 * identical to a real send) and delivers ONE message to the job seeker's own connected
 * address through the same provider seam. Creates NO `send_batch` / `send_record` rows, so
 * history stays real outreach only. The subject carries a clear test marker.
 */

export const TEST_SUBJECT_PREFIX = "[Test] ";

/** Clearly labelled sample recipient used when no contact is selected. */
const SAMPLE_CONTACT = { name: "Sample Recruiter", company: "Example Co", role: "Recruiter" };

export type TestSendResult = { status: "sent" | "failed"; toEmail?: string; reason?: string };

export async function sendTestEmail(
  userId: string,
  request: TestSendRequest,
  fromName: string | null,
  opts: { db?: Db; provider?: EmailProvider } = {},
): Promise<TestSendResult> {
  const db = opts.db ?? defaultDb;

  // Same precondition as a real send: an active connected account (else 409 no_active_account).
  const account = await getActiveAccount(userId, db);
  const provider = opts.provider ?? resolveProvider(account.providerKey);

  const base = await resolveContent(
    userId,
    request.override ? { inline: request.override } : { templateId: request.templateId },
    db,
  );
  const profile = await getProfile(userId, db);
  const sender = senderContextFromProfile(profile, fromName);

  let contact: { name: string; company: string | null; role: string | null } = SAMPLE_CONTACT;
  if (request.contactId) {
    const [row] = await db
      .select()
      .from(recruiterContacts)
      .where(
        and(
          eq(recruiterContacts.id, request.contactId),
          eq(recruiterContacts.userId, userId),
          isNull(recruiterContacts.deletedAt),
        ),
      )
      .limit(1);
    if (row) contact = { name: row.name, company: row.company, role: row.role };
  }

  const rendered = renderTemplate(base, { contact, sender });
  const result = await provider.sendEmail(
    {
      fromEmail: account.row.emailAddress,
      fromName: fromName ?? undefined,
      to: account.row.emailAddress,
      subject: `${TEST_SUBJECT_PREFIX}${rendered.subject}`,
      bodyHtml: rendered.bodyHtml,
      bodyText: rendered.bodyText,
    },
    account.credentials,
  );

  if (result.status === "sent") return { status: "sent", toEmail: account.row.emailAddress };
  return { status: "failed", reason: result.reason || "The provider rejected the message." };
}
