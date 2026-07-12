/**
 * Resume DTOs shared across the server/client boundary (no server-only imports here, so
 * client components can import these types freely).
 */

export type ResumeStatus = "active" | "archived";

export type Resume = {
  id: string;
  label: string;
  version: number;
  fileName: string;
  fileSize: number;
  status: ResumeStatus;
  createdAt: string;
};

/** A resume plus its archived version history, for the list's expandable rows (US4). */
export type ResumeNode = Resume & { children?: Resume[] };
