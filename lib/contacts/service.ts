import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/lib/db/client";
import { recruiterContacts, type RecruiterContactRow } from "@/lib/db/schema";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { runImportPipeline } from "@/lib/import/pipeline";
import {
  normalizeEmail,
  type ContactInput,
  type ImportRequest,
  type ImportSource,
} from "@/lib/validation/contacts";
import type { RawImportRow } from "@/lib/import/types";
import type { Contact, ContactList, ImportResult } from "./types";

/**
 * Contacts service (User Story 1). All queries are scoped to `userId` (FR-022) and
 * dedup uses the normalized email (FR-003/005). Pure import logic lives in the pipeline;
 * this layer owns persistence only.
 */

export type { Contact, ContactList, ImportResult } from "./types";

const PAGE_SIZE = 50;

function toContact(row: RecruiterContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    role: row.role,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Opaque keyset cursor over (createdAt desc, id desc). */
function encodeCursor(row: RecruiterContactRow): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString("base64url");
}
function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export async function listContacts(
  userId: string,
  opts: { query?: string; cursor?: string; all?: boolean } = {},
  db: Db = defaultDb,
): Promise<ContactList> {
  const filters = [eq(recruiterContacts.userId, userId)];

  const q = opts.query?.trim();
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

  // Compose needs the full set at once so its recipient picker (and "select all") can act on
  // every contact, not just the first page. Callers browsing a long list keep the keyset cursor.
  if (opts.all) {
    const rows = await db
      .select()
      .from(recruiterContacts)
      .where(and(...filters))
      .orderBy(desc(recruiterContacts.createdAt), desc(recruiterContacts.id));
    return { items: rows.map(toContact), nextCursor: null };
  }

  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (cursor) {
    // Keyset: rows strictly "after" the cursor in (createdAt desc, id desc) order.
    filters.push(
      sql`(${recruiterContacts.createdAt}, ${recruiterContacts.id}) < (${cursor.createdAt.toISOString()}, ${cursor.id})`,
    );
  }

  const rows = await db
    .select()
    .from(recruiterContacts)
    .where(and(...filters))
    .orderBy(desc(recruiterContacts.createdAt), desc(recruiterContacts.id))
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const last = page[page.length - 1];
  return {
    items: page.map(toContact),
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  };
}

export async function createContact(
  userId: string,
  input: ContactInput,
  source: string = "manual",
  db: Db = defaultDb,
): Promise<Contact> {
  const emailNormalized = normalizeEmail(input.email);
  const [existing] = await db
    .select({ id: recruiterContacts.id })
    .from(recruiterContacts)
    .where(and(eq(recruiterContacts.userId, userId), eq(recruiterContacts.emailNormalized, emailNormalized)))
    .limit(1);
  if (existing) throw new ConflictError("email_exists", "a contact with this email already exists");

  const [row] = await db
    .insert(recruiterContacts)
    .values({
      userId,
      name: input.name,
      email: input.email,
      emailNormalized,
      company: input.company ?? null,
      role: input.role ?? null,
      source,
    })
    .returning();
  return toContact(row!);
}

export async function updateContact(
  userId: string,
  id: string,
  input: ContactInput,
  db: Db = defaultDb,
): Promise<Contact> {
  const emailNormalized = normalizeEmail(input.email);

  // Existence/ownership first, so a non-owned id is a 404 (not masked as a 409 when the
  // new email happens to collide with one of the caller's own contacts).
  const [target] = await db
    .select({ id: recruiterContacts.id })
    .from(recruiterContacts)
    .where(and(eq(recruiterContacts.id, id), eq(recruiterContacts.userId, userId)))
    .limit(1);
  if (!target) throw new NotFoundError("contact not found");

  // Guard against colliding with a *different* contact's email (FR-005).
  const [collision] = await db
    .select({ id: recruiterContacts.id })
    .from(recruiterContacts)
    .where(and(eq(recruiterContacts.userId, userId), eq(recruiterContacts.emailNormalized, emailNormalized)))
    .limit(1);
  if (collision && collision.id !== id) {
    throw new ConflictError("email_exists", "another contact already uses this email");
  }

  const [row] = await db
    .update(recruiterContacts)
    .set({
      name: input.name,
      email: input.email,
      emailNormalized,
      company: input.company ?? null,
      role: input.role ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(recruiterContacts.id, id), eq(recruiterContacts.userId, userId)))
    .returning();
  if (!row) throw new NotFoundError("contact not found");
  return toContact(row);
}

export async function deleteContact(userId: string, id: string, db: Db = defaultDb): Promise<void> {
  const deleted = await db
    .delete(recruiterContacts)
    .where(and(eq(recruiterContacts.id, id), eq(recruiterContacts.userId, userId)))
    .returning({ id: recruiterContacts.id });
  if (deleted.length === 0) throw new NotFoundError("contact not found");
}

export async function importContacts(
  userId: string,
  request: ImportRequest,
  db: Db = defaultDb,
): Promise<ImportResult> {
  const existing = await db
    .select({ emailNormalized: recruiterContacts.emailNormalized })
    .from(recruiterContacts)
    .where(eq(recruiterContacts.userId, userId));

  const summary = runImportPipeline(request.rows as RawImportRow[], existing.map((e) => e.emailNormalized));

  if (summary.valid.length > 0) {
    await db.insert(recruiterContacts).values(
      summary.valid.map((c) => ({
        userId,
        name: c.name,
        email: c.email,
        emailNormalized: c.emailNormalized,
        company: c.company,
        role: c.role,
        source: request.source satisfies ImportSource as string,
      })),
    );
  }

  // The batch the user meant to email: the rows we just created plus the duplicates that
  // already existed as contacts. Resolve them to IDs (new + pre-existing) in one query so the
  // import screen can offer "Compose to these contacts". Ordered to mirror the imported list.
  const batchEmails: string[] = [];
  const seen = new Set<string>();
  for (const c of summary.valid) {
    if (!seen.has(c.emailNormalized)) { seen.add(c.emailNormalized); batchEmails.push(c.emailNormalized); }
  }
  for (const d of summary.duplicates) {
    const n = normalizeEmail(d.email);
    if (!seen.has(n)) { seen.add(n); batchEmails.push(n); }
  }

  let contactIds: string[] = [];
  if (batchEmails.length > 0) {
    const rows = await db
      .select({ id: recruiterContacts.id, emailNormalized: recruiterContacts.emailNormalized })
      .from(recruiterContacts)
      .where(and(eq(recruiterContacts.userId, userId), inArray(recruiterContacts.emailNormalized, batchEmails)));
    const idByEmail = new Map(rows.map((r) => [r.emailNormalized, r.id]));
    contactIds = batchEmails.map((e) => idByEmail.get(e)).filter((id): id is string => Boolean(id));
  }

  return {
    imported: summary.valid.length,
    duplicates: summary.duplicates,
    invalid: summary.invalid,
    contactIds,
  };
}
