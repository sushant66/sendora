import { google } from "googleapis";
import { getEnv } from "@/lib/validation/env";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import type { OAuthConnector, ExchangedTokens } from "./index";

/**
 * Gmail connector: incremental Google OAuth for the narrow `gmail.send` scope. The scope grants
 * no profile read, so `emailAddress` is null and the caller falls back to the session email.
 * Google is always configured (GOOGLE_CLIENT_ID/SECRET are required env).
 */
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";

function redirectUri(): string {
  return `${getEnv().APP_URL}/api/email-account/callback`;
}

function oauthClient() {
  const env = getEnv();
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri());
}

export const gmailConnector: OAuthConnector = {
  key: "gmail",
  method: "oauth",

  isConfigured() {
    return true;
  },

  authorizeUrl(state: string): string {
    return oauthClient().generateAuthUrl({
      access_type: "offline",
      prompt: "consent", // force a refresh_token every time
      scope: [GMAIL_SCOPE],
      include_granted_scopes: true,
      state,
    });
  },

  async exchangeCode(code: string): Promise<ExchangedTokens> {
    const { tokens } = await oauthClient().getToken(code);
    if (!tokens.refresh_token) {
      // Google omits the refresh token if the user previously consented without revoking.
      throw new ConflictError(
        "reconnect_required",
        "Google did not return a refresh token. Revoke access and reconnect.",
      );
    }
    const scopes = (tokens.scope ?? GMAIL_SCOPE).split(" ").filter(Boolean);
    if (!scopes.includes(GMAIL_SCOPE))
      throw new ForbiddenError("the gmail.send permission was not granted");

    return {
      accessToken: tokens.access_token ?? null,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      scopes,
      emailAddress: null,
    };
  },
};
