/**
 * Contact DTOs shared across the server/client boundary (no server-only imports here,
 * so client components can import these types and values freely).
 */

export type Contact = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  source: string;
  createdAt: string;
};

export type ContactList = {
  items: Contact[];
  nextCursor: string | null;
};

export type ImportResult = {
  imported: number;
  duplicates: { row: number; email: string }[];
  invalid: { row: number; reason: string }[];
  /**
   * IDs of every emailable contact in this import batch: the newly created ones plus the
   * duplicates that already existed. Powers the "Compose to these contacts" handoff so the
   * user does not have to re-select the list by hand. Invalid rows have no contact, so they
   * are absent here.
   */
  contactIds: string[];
};
