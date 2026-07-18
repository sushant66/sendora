/** Email-account DTO shared across the server/client boundary (no tokens, ever). */

import type { ProviderKey } from "./provider";

export type AccountConnectionStatus = "active" | "expired" | "revoked";

/** Summary of the caller's active (selected) sending account, or `{ connected: false }`. */
export type AccountStatus = {
  connected: boolean;
  provider?: ProviderKey;
  emailAddress?: string;
  status?: AccountConnectionStatus;
};

/** One connected account in the settings list (all non-revoked accounts for a user). */
export type ConnectedAccount = {
  provider: ProviderKey;
  emailAddress: string;
  status: AccountConnectionStatus;
  isActive: boolean;
};

/** Payload for the settings page: every connected account + which providers can be connected. */
export type EmailAccountsStatus = {
  accounts: ConnectedAccount[];
  availableProviders: ProviderKey[];
};
