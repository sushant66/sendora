import { and, eq, isNull } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/lib/db/client";
import { recruiterContacts } from "@/lib/db/schema";
import { NotFoundError } from "@/lib/errors";
import { sanitizeRichText, htmlToPlainText } from "@/lib/sanitize";
import { renderTemplate } from "./merge";
import { getReadableTemplateRow } from "./service";
import { getProfile } from "@/lib/profile/service";
import { senderContextFromProfile } from "@/lib/profile/context";
import type { PreviewRequest } from "@/lib/validation/templates";
import type { TemplatePreview } from "./types";

/**
 * Render a template (or inline content) for a specific contact (User Story 2, T046). The
 * result never contains a literal `{{token}}` for either namespace (FR-012, SC-002/SC-004);
 * empty optional fields become warnings the compose UI and the pre-send gate surface. Sender
 * (`my_*`) fields resolve from the caller's profile, identical to a real send (FR-006).
 */
export async function previewTemplate(
  userId: string,
  request: PreviewRequest,
  opts: { db?: Db; senderName?: string | null } = {},
): Promise<TemplatePreview> {
  const db = opts.db ?? defaultDb;
  const [contact] = await db
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
  if (!contact) throw new NotFoundError("contact not found");

  const profile = await getProfile(userId, db);
  const base = await resolveContent(userId, request, db);
  const rendered = renderTemplate(base, {
    contact: { name: contact.name, company: contact.company, role: contact.role },
    sender: senderContextFromProfile(profile, opts.senderName ?? null),
  });

  return {
    subject: rendered.subject,
    bodyHtml: rendered.bodyHtml,
    bodyText: rendered.bodyText,
    warnings: rendered.warnings,
  };
}

/** Resolve the pre-merge content from a saved template or inline (sanitized) content. */
export async function resolveContent(
  userId: string,
  request: { templateId?: string; inline?: { subject: string; bodyHtml: string } },
  db: Db = defaultDb,
): Promise<{ subject: string; bodyHtml: string; bodyText: string }> {
  if (request.inline) {
    const bodyHtml = sanitizeRichText(request.inline.bodyHtml);
    return { subject: request.inline.subject, bodyHtml, bodyText: htmlToPlainText(bodyHtml) };
  }
  const row = await getReadableTemplateRow(userId, request.templateId!, db);
  return { subject: row.subject, bodyHtml: row.bodyHtml, bodyText: row.bodyText };
}
