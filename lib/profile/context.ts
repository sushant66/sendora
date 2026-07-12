import type { SenderContext } from "@/lib/templates/merge";
import type { SenderProfile } from "./types";

/**
 * Build the sender merge context from a saved profile (feature 002, US1). The display name is
 * authoritative but falls back to the account name when the profile name is empty (FR-001);
 * every other field passes through as-is (empty values become render warnings, never literal
 * placeholders). Pure and client-safe so both the send and preview seams share one mapping.
 */
export function senderContextFromProfile(
  profile: SenderProfile | null,
  fallbackName: string | null,
): SenderContext {
  const displayName = profile?.displayName?.trim() || fallbackName?.trim() || null;
  return {
    displayName,
    title: profile?.title ?? null,
    pitch: profile?.pitch ?? null,
    skills: profile?.skills ?? null,
    link: profile?.link ?? null,
    location: profile?.location ?? null,
    workPreference: profile?.workPreference ?? null,
  };
}
