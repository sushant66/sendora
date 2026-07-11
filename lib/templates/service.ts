import { and, desc, eq, or, isNull } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/lib/db/client";
import { emailTemplates, type EmailTemplateRow } from "@/lib/db/schema";
import { ForbiddenError, NotFoundError, UnsupportedMergeFieldsError } from "@/lib/errors";
import { sanitizeRichText, htmlToPlainText } from "@/lib/sanitize";
import { extractTokens } from "./merge";
import { unsupportedTemplateTokens, type TemplateInput } from "@/lib/validation/templates";
import type { Template, TemplateKind } from "./types";

/**
 * Template reads (User Story 2). Returns starter (system) templates plus the caller's
 * custom templates (FR-008/022). Custom CRUD lives in this module too, added in US3.
 */

export function toTemplate(row: EmailTemplateRow): Template {
  return {
    id: row.id,
    kind: row.kind as TemplateKind,
    name: row.name,
    subject: row.subject,
    bodyHtml: row.bodyHtml,
    bodyText: row.bodyText,
    mergeFields: row.mergeFields,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Starter templates first, then the caller's custom templates (newest first). */
export async function listTemplates(userId: string, db: Db = defaultDb): Promise<Template[]> {
  const rows = await db
    .select()
    .from(emailTemplates)
    .where(or(isNull(emailTemplates.userId), eq(emailTemplates.userId, userId)))
    .orderBy(desc(emailTemplates.kind), desc(emailTemplates.createdAt));
  return rows.map(toTemplate);
}

/** Derive the stored fields (sanitized HTML, plain-text alt, merge-field list) from input. */
function deriveTemplateFields(input: TemplateInput) {
  const bad = unsupportedTemplateTokens(input);
  if (bad.length > 0) throw new UnsupportedMergeFieldsError(bad);
  const bodyHtml = sanitizeRichText(input.bodyHtml);
  return {
    name: input.name,
    subject: input.subject,
    bodyHtml,
    bodyText: htmlToPlainText(bodyHtml),
    mergeFields: [...new Set([...extractTokens(input.subject), ...extractTokens(bodyHtml)])],
  };
}

/** Create a custom template owned by the caller (US3, FR-009). */
export async function createTemplate(userId: string, input: TemplateInput, db: Db = defaultDb): Promise<Template> {
  const [row] = await db
    .insert(emailTemplates)
    .values({ userId, kind: "custom", ...deriveTemplateFields(input) })
    .returning();
  return toTemplate(row!);
}

/** Edit a custom template. System templates are read-only → ForbiddenError (403). */
export async function updateTemplate(
  userId: string,
  id: string,
  input: TemplateInput,
  db: Db = defaultDb,
): Promise<Template> {
  const existing = await getReadableTemplateRow(userId, id, db);
  if (existing.kind === "system" || existing.userId === null) {
    throw new ForbiddenError("starter templates can't be edited");
  }
  const [row] = await db
    .update(emailTemplates)
    .set({ ...deriveTemplateFields(input), updatedAt: new Date() })
    .where(and(eq(emailTemplates.id, id), eq(emailTemplates.userId, userId)))
    .returning();
  if (!row) throw new NotFoundError("template not found");
  return toTemplate(row);
}

/** Delete a custom template. System templates are read-only → ForbiddenError (403). */
export async function deleteTemplate(userId: string, id: string, db: Db = defaultDb): Promise<void> {
  const existing = await getReadableTemplateRow(userId, id, db);
  if (existing.kind === "system" || existing.userId === null) {
    throw new ForbiddenError("starter templates can't be deleted");
  }
  await db.delete(emailTemplates).where(and(eq(emailTemplates.id, id), eq(emailTemplates.userId, userId)));
}

/** Load one template readable by the caller (own custom or any system). Throws if missing. */
export async function getReadableTemplateRow(
  userId: string,
  id: string,
  db: Db = defaultDb,
): Promise<EmailTemplateRow> {
  const [row] = await db
    .select()
    .from(emailTemplates)
    .where(and(eq(emailTemplates.id, id), or(isNull(emailTemplates.userId), eq(emailTemplates.userId, userId))))
    .limit(1);
  if (!row) throw new NotFoundError("template not found");
  return row;
}
