import type { SenderProfile } from "@/lib/profile/types";

/**
 * Test factory for a SenderProfile DTO (feature 002, US1). Every field is optional in the
 * domain, so the default profile is fully populated for the common "happy path" and callers
 * override or null-out individual fields to exercise empty-value warnings.
 */
export function makeProfile(overrides: Partial<SenderProfile> = {}): SenderProfile {
  return {
    displayName: "Ada Lovelace",
    title: "Senior Frontend Engineer",
    pitch: "I build accessible design systems.",
    skills: "React, TypeScript, StyleX",
    link: "https://ada.dev",
    location: "Remote (UK)",
    workPreference: "remote",
    ...overrides,
  };
}

/** An entirely empty profile (all fields null) — the "no profile saved" baseline. */
export function makeEmptyProfile(): SenderProfile {
  return {
    displayName: null,
    title: null,
    pitch: null,
    skills: null,
    link: null,
    location: null,
    workPreference: null,
  };
}
