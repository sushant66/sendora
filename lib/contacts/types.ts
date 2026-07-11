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
};
