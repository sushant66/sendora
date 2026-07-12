/** History DTOs shared across the server/client boundary. */

export type SendStatus = "pending" | "sent" | "failed";

/**
 * One recipient's send — the immutable snapshot summary. Used as a list sub-row
 * (inside a bulk event) and as the head of the detail drawer.
 */
export type HistoryRecord = {
  id: string;
  recipientName: string | null;
  recipientEmail: string;
  contactId: string | null;
  subject: string;
  status: SendStatus;
  failureReason: string | null;
  sentAt: string | null;
  createdAt: string;
};

/**
 * A send event = one batch. A single send is a batch of size 1 (carries its one
 * `record` so the row renders and opens directly); a bulk send is many individual
 * emails (its per-recipient records are fetched on expand).
 */
/** The resume (if any) attached to a batch's send(s) — 003-resume-attachments. */
export type AttachedResumeInfo = { label: string; fileName: string };

export type HistoryEvent = {
  id: string; // batchId
  kind: "single" | "bulk";
  when: string; // ISO — batch createdAt
  total: number;
  sent: number;
  failed: number;
  record: HistoryRecord | null; // present for single sends; null for bulk
  attachedResume: AttachedResumeInfo | null;
};

export type HistoryList = { items: HistoryEvent[]; nextCursor: string | null };

/** The per-recipient records of one batch (for expanding a bulk event). */
export type HistoryBatchRecords = { records: HistoryRecord[] };

/** The full immutable snapshot for the detail drawer — exactly what was sent. */
export type HistoryDetail = HistoryRecord & {
  bodyHtml: string;
  bodyText: string;
  fromEmail: string;
  batch: { id: string; kind: "single" | "bulk"; total: number; sent: number; failed: number };
  attachedResume: AttachedResumeInfo | null;
};

/**
 * Outcome of resending a record's snapshot. `attachmentDropped` is true when the original
 * send had a resume attached but it could no longer be resolved (003-resume-attachments) —
 * the resend still succeeds/fails on its own terms; the attachment simply wasn't included.
 */
export type ResendResult = { recordId: string; status: SendStatus; reason: string | null; attachmentDropped: boolean };

export type RecontactInfo = {
  previouslyContacted: { contactId: string; lastSentAt: string }[];
};
