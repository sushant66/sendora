/** Send DTOs shared across the server/client boundary. */

export type SendResultItem = {
  contactId: string;
  recipientEmail: string;
  status: "sent" | "failed";
  reason?: string;
};

export type SendSummary = {
  batchId: string;
  total: number;
  sent: number;
  failed: number;
  results: SendResultItem[];
};
