import type { ProviderKey } from "../provider";
import { gmailConnector } from "./gmail";
import { yahooConnector } from "./yahoo";

/**
 * Connect seam, the mirror of the EmailProvider send seam. Providers connect one of two ways:
 *  - "oauth": a consent redirect + code exchange (Gmail).
 *  - "credentials": the user submits an email + secret we verify and store directly (Yahoo
 *    app password — Yahoo's OAuth mail scope needs a separate approval we avoid).
 * The account-service drives connect generically through this discriminated union; the send
 * flow is unaffected.
 */
export type ExchangedTokens = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt?: Date;
  scopes: string[];
  /** Resolved mailbox address, or null when the grant carries no profile (Gmail send-only). */
  emailAddress: string | null;
};

type BaseConnector = {
  readonly key: ProviderKey;
  /** True when this provider can be connected in the current environment. */
  isConfigured(): boolean;
};

export type OAuthConnector = BaseConnector & {
  readonly method: "oauth";
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<ExchangedTokens>;
};

export type CredentialsConnector = BaseConnector & {
  readonly method: "credentials";
  /** Validate the submitted email + secret (throws on failure). */
  verify(email: string, secret: string): Promise<void>;
};

export type ProviderConnector = OAuthConnector | CredentialsConnector;

const CONNECTORS: Record<ProviderKey, ProviderConnector> = {
  gmail: gmailConnector,
  yahoo: yahooConnector,
};

export function connectorFor(provider: ProviderKey): ProviderConnector {
  return CONNECTORS[provider];
}

/** Provider keys the user can currently connect. */
export function availableProviders(): ProviderKey[] {
  return (Object.keys(CONNECTORS) as ProviderKey[]).filter((key) => CONNECTORS[key].isConfigured());
}
