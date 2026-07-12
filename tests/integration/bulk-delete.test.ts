import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  users,
  recruiterContacts,
  connectedEmailAccounts,
  sendBatches,
  sendRecords,
} from "@/lib/db/schema";
import { softDeleteContacts, restoreBatch } from "@/lib/contacts/soft-delete";
import { createContact, listContacts } from "@/lib/contacts/service";
import { NotFoundError } from "@/lib/errors";

/**
 * T042 [US4] — DB-backed integration for soft-delete/restore: delete hides rows, undo restores
 * the SAME identity with its send_record linkage intact, and a user can neither delete nor
 * restore another user's contacts (FR-024/C1). Self-skips when no database is reachable
 * (the default local test DB), mirroring how the E2E specs skip without a session.
 */

const U1 = crypto.randomUUID();
const U2 = crypto.randomUUID();
let dbAvailable = false;

beforeAll(async () => {
  try {
    await db.insert(users).values([
      { id: U1, email: `${U1}@test.local` },
      { id: U2, email: `${U2}@test.local` },
    ]);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (!dbAvailable) return;
  // FK cascade removes contacts, accounts, batches, and records for these users.
  await db.delete(users).where(inArray(users.id, [U1, U2]));
});

describe("soft-delete + restore (DB-backed)", () => {
  it("hides deleted rows and restores the same identity with history linkage intact", async (ctx) => {
    if (!dbAvailable) return ctx.skip();

    const contact = await createContact(U1, { name: "Ada Lovelace", email: "ada@analytical.com" });

    // A send_record linked to the contact, to prove the linkage survives a delete/undo cycle.
    const [account] = await db
      .insert(connectedEmailAccounts)
      .values({ userId: U1, provider: "gmail", emailAddress: "seeker@gmail.com", refreshToken: "enc" })
      .returning();
    const [batch] = await db
      .insert(sendBatches)
      .values({ userId: U1, connectedAccountId: account!.id, kind: "single", total: 1 })
      .returning();
    const [record] = await db
      .insert(sendRecords)
      .values({
        userId: U1,
        batchId: batch!.id,
        contactId: contact.id,
        recipientEmail: "ada@analytical.com",
        subject: "Hi",
        bodyHtml: "<p>Hi</p>",
        bodyText: "Hi",
        status: "sent",
      })
      .returning();

    const del = await softDeleteContacts(U1, { ids: [contact.id] });
    expect(del.count).toBe(1);

    // Hidden from reads.
    const afterDelete = await listContacts(U1, { all: true });
    expect(afterDelete.items.find((c) => c.id === contact.id)).toBeUndefined();

    // The send_record still points at the same contact id while soft-deleted.
    const [recAfterDelete] = await db.select().from(sendRecords).where(eq(sendRecords.id, record!.id));
    expect(recAfterDelete!.contactId).toBe(contact.id);

    const restored = await restoreBatch(U1, del.deletedBatch);
    expect(restored).toEqual({ restored: 1, skipped: 0 });

    // Back, with the SAME id (identity preserved) and history still linked.
    const afterRestore = await listContacts(U1, { all: true });
    expect(afterRestore.items.find((c) => c.id === contact.id)).toBeDefined();
    const [recAfterRestore] = await db.select().from(sendRecords).where(eq(sendRecords.id, record!.id));
    expect(recAfterRestore!.contactId).toBe(contact.id);
  });

  it("a user cannot delete another user's contacts (FR-024)", async (ctx) => {
    if (!dbAvailable) return ctx.skip();

    const u2Contact = await createContact(U2, { name: "Bo North", email: "bo@globex.com" });
    const del = await softDeleteContacts(U1, { ids: [u2Contact.id] });
    expect(del.count).toBe(0);

    const u2Live = await listContacts(U2, { all: true });
    expect(u2Live.items.find((c) => c.id === u2Contact.id)).toBeDefined();
  });

  it("a user cannot restore another user's delete batch (FR-024)", async (ctx) => {
    if (!dbAvailable) return ctx.skip();

    const u2Contact = await createContact(U2, { name: "Cy West", email: "cy@initech.com" });
    const del = await softDeleteContacts(U2, { ids: [u2Contact.id] });
    expect(del.count).toBe(1);

    await expect(restoreBatch(U1, del.deletedBatch)).rejects.toBeInstanceOf(NotFoundError);

    // Still deleted for U2 (the foreign restore was a no-op).
    const u2Live = await listContacts(U2, { all: true });
    expect(u2Live.items.find((c) => c.id === u2Contact.id)).toBeUndefined();

    // Clean up so afterAll cascade is the only remover.
    await db.delete(recruiterContacts).where(and(eq(recruiterContacts.userId, U2), eq(recruiterContacts.id, u2Contact.id)));
  });
});
