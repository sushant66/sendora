/**
 * One-shot handoff of a recipient selection between screens (import → compose).
 *
 * After an import, the user shouldn't have to re-pick the people they just added. The import
 * screen stashes the batch's contact IDs here; Compose reads and clears them on mount so the
 * recipient field arrives pre-filled. sessionStorage (not a query string) keeps long batches
 * out of the URL and scopes the handoff to the current tab. Reading is consume-once: a normal
 * visit to Compose finds nothing and behaves as before.
 */

const KEY = "sendora:compose-preselect";

/** Stash the contact IDs to pre-select on the next Compose visit. No-op on the server. */
export function stashPreselect(contactIds: string[]): void {
  if (typeof window === "undefined" || contactIds.length === 0) return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(contactIds));
  } catch {
    // Private-mode / disabled storage: the handoff is a convenience, so fail silently.
  }
}

/** Read and clear any stashed pre-selection. Returns [] when there is nothing to hand off. */
export function takePreselect(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return [];
    window.sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
