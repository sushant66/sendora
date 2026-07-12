/**
 * SenderProfile DTOs (feature 002, US1). Shared across the server/client boundary, so no
 * server-only imports here. The profile backs the sender (`my_*`) merge fields and the
 * authoritative in-app display name (FR-001).
 */

export const WORK_PREFERENCES = ["remote", "hybrid", "onsite", "open"] as const;
export type WorkPreference = (typeof WORK_PREFERENCES)[number];

/** The profile as returned by the API and consumed by the UI. Every field is optional; an
 *  unset field is `null` (empty strings normalize to null at the validation boundary). */
export type SenderProfile = {
  displayName: string | null;
  title: string | null;
  pitch: string | null;
  skills: string | null;
  link: string | null;
  location: string | null;
  workPreference: WorkPreference | null;
};
