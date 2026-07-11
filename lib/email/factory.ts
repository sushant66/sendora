import type { EmailProvider, ProviderKey } from "./provider";
import { gmailProvider } from "./gmail-provider";

/**
 * Resolve the EmailProvider for a connected account by its provider key. A new provider
 * is added here as one more case — no change to the send flow (FR-019c).
 */
export function resolveProvider(key: ProviderKey): EmailProvider {
  switch (key) {
    case "gmail":
      return gmailProvider;
    default:
      throw new Error(`No email provider registered for "${key satisfies never}"`);
  }
}
