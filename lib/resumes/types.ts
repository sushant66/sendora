/**
 * Resume DTOs shared across the server/client boundary (no server-only imports here, so
 * client components can import these types freely).
 */

export type ResumeStatus = "active" | "archived";

export type Resume = {
  id: string;
  label: string;
  /**
   * Internal lineage counter, never surfaced in the UI. There is no user-facing versioning;
   * `version` only exists so a resume that was attached to a past send can be retained as a
   * frozen row while the label's active file moves on (see `replaceResume`).
   */
  version: number;
  fileName: string;
  fileSize: number;
  status: ResumeStatus;
  /** ISO timestamp the resume was first created. */
  createdAt: string;
  /** ISO timestamp the current file was uploaded or last updated (what the shelf shows). */
  updatedAt: string;
};
