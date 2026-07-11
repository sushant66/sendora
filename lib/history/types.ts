/** History DTOs shared across the server/client boundary. */

export type HistoryItem = {
  id: string;
  recipientEmail: string;
  contactId: string | null;
  subject: string;
  templateName: string | null;
  status: "pending" | "sent" | "failed";
  failureReason: string | null;
  sentAt: string | null;
  createdAt: string;
  batchId: string;
};

export type HistoryList = {
  items: HistoryItem[];
  nextCursor: string | null;
};

export type RecontactInfo = {
  previouslyContacted: { contactId: string; lastSentAt: string }[];
};
