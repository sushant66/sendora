/** Email-account DTO shared across the server/client boundary (no tokens, ever). */

export type AccountConnectionStatus = "active" | "expired" | "revoked";

export type AccountStatus = {
  connected: boolean;
  provider?: "gmail";
  emailAddress?: string;
  status?: AccountConnectionStatus;
};
