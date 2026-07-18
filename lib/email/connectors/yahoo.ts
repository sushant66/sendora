import { ConflictError } from "@/lib/errors";
import { verifyYahooCredentials } from "../yahoo-smtp";
import type { CredentialsConnector } from "./index";

/**
 * Yahoo connector: connect by app-specific password, not OAuth. The user generates an app
 * password in Yahoo Account Security and submits it with their email; we verify it against
 * Yahoo SMTP before storing. Always configured (the user supplies their own credential).
 */
export const yahooConnector: CredentialsConnector = {
  key: "yahoo",
  method: "credentials",

  isConfigured() {
    return true;
  },

  async verify(email: string, secret: string): Promise<void> {
    try {
      await verifyYahooCredentials(email, secret);
    } catch {
      throw new ConflictError(
        "invalid_credentials",
        "Could not sign in to Yahoo with that email and app password.",
      );
    }
  },
};
