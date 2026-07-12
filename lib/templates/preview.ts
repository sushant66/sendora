import { and, eq } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/lib/db/client";
import { recruiterContacts } from "@/lib/db/schema";
import { NotFoundError } from "@/lib/errors";
import { sanitizeRichText, htmlToPlainText } from "@/lib/sanitize";
import { renderTemplate } from "./merge";
import { getReadableTemplateRow } from "./service";
import type { PreviewRequest } from "@/lib/validation/templates";
import type { TemplatePreview } from "./types";

/**
 * Render a template (or inline content) for a specific contact (User Story 2, T046). The
 * result never contains a literal `{{token}}` (FR-012, SC-004); empty optional fields
 * become warnings the compose UI surfaces.
 */
export async function previewTemplate(
  userId: string,
  request: PreviewRequest,
  db: Db = defaultDb,
): Promise<TemplatePreview> {
  const [contact] = await db
    .select()
    .from(recruiterContacts)
    .where(and(eq(recruiterContacts.id, request.contactId), eq(recruiterContacts.userId, userId)))
    .limit(1);
  if (!contact) throw new NotFoundError("contact not found");

  const base = await resolveContent(userId, request, db);
  const rendered = renderTemplate(base, {
    contact: { name: contact.name, company: contact.company, role: contact.role },
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
