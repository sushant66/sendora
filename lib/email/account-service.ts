import { createHmac, timingSafeEqual } from "node:crypto";
import { google } from "googleapis";
import { and, eq } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/lib/db/client";
import { connectedEmailAccounts, type ConnectedEmailAccountRow } from "@/lib/db/schema";
import { getEnv } from "@/lib/validation/env";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import { encryptToken, decryptToken } from "@/lib/crypto/tokens";
import type { ProviderCredentials, ProviderKey } from "./provider";
import type { AccountStatus } from "./types";

/**
 * Connected email account service (User Story 2, FR-019/a/b).
 *
 * Self-contained OAuth for the narrow `gmail.send` scope: connect returns a Google consent
 * URL; the callback exchanges the code and stores the refresh token encrypted at rest. The
 * account email is the signed-in user's own Google address (send-only scope grants no
 * profile read). Sending requires an `active` account (FR-019a); a reauth failure flips it
 * to `expired` (FR-019b).
 */

const PROVIDER: ProviderKey = "gmail";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";

function redirectUri(): string {
  return `${getEnv().APP_URL}/api/email-account/callback`;
}

function oauthClient() {
  const env = getEnv();
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri());
}

/** Sign the OAuth `state` so the callback can verify it belongs to this user (CSRF guard). */
function signState(userId: string): string {
  const mac = createHmac("sha256", getEnv().AUTH_SECRET).update(userId).digest("base64url");
  return `${userId}.${mac}`;
}
export function verifyState(state: string, userId: string): boolean {
  const expected = signState(userId);
  const a = Buffer.from(state);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function getAccountStatus(userId: string, db: Db = defaultDb): Promise<AccountStatus> {
  const [row] = await db
    .select()
    .from(connectedEmailAccounts)
    .where(and(eq(connectedEmailAccounts.userId, userId), eq(connectedEmailAccounts.provider, PROVIDER)))
    .limit(1);
  if (!row || row.status === "revoked") return { connected: false };
  return {
    connected: row.status === "active",
    provider: "gmail",
    emailAddress: row.emailAddress,
    status: row.status as AccountStatus["status"],
  };
}

export function buildConnectUrl(userId: string): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force a refresh_token every time
    scope: [GMAIL_SCOPE],
    include_granted_scopes: true,
    state: signState(userId),
    login_hint: undefined,
  });
}

/** Exchange the authorization code and upsert the connected account (status active). */
export async function completeConnection(
  userId: string,
  emailAddress: string,
  code: string,
  db: Db = defaultDb,
): Promise<void> {
  const { tokens } = await oauthClient().getToken(code);
  if (!tokens.refresh_token) {
    // Google omits the refresh token if the user previously consented without revoking.
    throw new ConflictError("reconnect_required", "Google did not return a refresh token. Revoke access and reconnect.");
  }
  const scopes = (tokens.scope ?? GMAIL_SCOPE).split(" ").filter(Boolean);
  if (!scopes.includes(GMAIL_SCOPE)) throw new ForbiddenError("the gmail.send permission was not granted");

  const values = {
    userId,
    provider: PROVIDER,
    emailAddress,
    accessToken: tokens.access_token ? encryptToken(tokens.access_token) : null,
    refreshToken: encryptToken(tokens.refresh_token),
    tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scopes,
    status: "active" as const,
    connectedAt: new Date(),
    updatedAt: new Date(),
  };

  await db
    .insert(connectedEmailAccounts)
    .values(values)
    .onConflictDoUpdate({
      target: [connectedEmailAccounts.userId, connectedEmailAccounts.provider, connectedEmailAccounts.emailAddress],
      set: {
        accessToken: values.accessToken,
        refreshToken: values.refreshToken,
        tokenExpiresAt: values.tokenExpiresAt,
        scopes: values.scopes,
        status: "active",
        connectedAt: values.connectedAt,
        updatedAt: values.updatedAt,
      },
    });
}

export async function disconnect(userId: string, db: Db = defaultDb): Promise<void> {
  await db
    .update(connectedEmailAccounts)
    .set({ status: "revoked", accessToken: null, updatedAt: new Date() })
    .where(and(eq(connectedEmailAccounts.userId, userId), eq(connectedEmailAccounts.provider, PROVIDER)));
}

export type ActiveAccount = {
  row: ConnectedEmailAccountRow;
  providerKey: ProviderKey;
  credentials: ProviderCredentials;
};

/** The caller's active account + decrypted credentials, or a `no_active_account` conflict. */
export async function getActiveAccount(userId: string, db: Db = defaultDb): Promise<ActiveAccount> {
  const [row] = await db
    .select()
    .from(connectedEmailAccounts)
    .where(
      and(
        eq(connectedEmailAccounts.userId, userId),
        eq(connectedEmailAccounts.provider, PROVIDER),
        eq(connectedEmailAccounts.status, "active"),
      ),
    )
    .limit(1);
  if (!row) throw new ConflictError("no_active_account");
  return {
    row,
    providerKey: row.provider as ProviderKey,
    credentials: {
      accessToken: row.accessToken ? decryptToken(row.accessToken) : "",
      refreshToken: decryptToken(row.refreshToken),
      expiresAt: row.tokenExpiresAt ?? undefined,
    },
  };
}

/** Flip an account to `expired` after a reauthorization failure (FR-019b). */
export async function markAccountExpired(accountId: string, db: Db = defaultDb): Promise<void> {
  await db
    .update(connectedEmailAccounts)
    .set({ status: "expired", updatedAt: new Date() })
    .where(eq(connectedEmailAccounts.id, accountId));
}
