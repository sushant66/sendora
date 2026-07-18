import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { db as defaultDb, runAtomic, type Db } from "@/lib/db/client";
import { connectedEmailAccounts, type ConnectedEmailAccountRow } from "@/lib/db/schema";
import { getEnv } from "@/lib/validation/env";
import { ConflictError } from "@/lib/errors";
import { encryptToken, decryptToken } from "@/lib/crypto/tokens";
import { connectorFor, availableProviders } from "./connectors";
import type { ProviderCredentials, ProviderKey } from "./provider";
import type { AccountStatus, ConnectedAccount, EmailAccountsStatus } from "./types";

/**
 * Connected email account service (User Story 2, FR-019/a/b).
 *
 * Self-contained OAuth for a narrow send scope, per provider (Gmail via REST, Yahoo via SMTP).
 * Connect returns a provider consent URL; the callback exchanges the code and stores the refresh
 * token encrypted at rest. A user may connect several providers, but exactly one is the selected
 * sender (`isActive`); sending uses that account (FR-019a), and a reauth failure flips it to
 * `expired` (FR-019b). Provider-specific work is delegated to the connector seam.
 */

// ---- Signed OAuth state (CSRF guard, carries the provider) --------------------------------

/** `state = ${userId}.${provider}.${mac}`, where the MAC covers userId+provider. */
export function signState(userId: string, provider: ProviderKey): string {
  const mac = createHmac("sha256", getEnv().AUTH_SECRET)
    .update(`${userId}.${provider}`)
    .digest("base64url");
  return `${userId}.${provider}.${mac}`;
}

export function verifyState(
  state: string,
  userId: string,
): { valid: boolean; provider?: ProviderKey } {
  const parts = state.split(".");
  if (parts.length !== 3) return { valid: false };
  const [stateUserId, provider] = parts;
  if (stateUserId !== userId) return { valid: false };
  const expected = signState(userId, provider as ProviderKey);
  const a = Buffer.from(state);
  const b = Buffer.from(expected);
  const valid = a.length === b.length && timingSafeEqual(a, b);
  return valid ? { valid, provider: provider as ProviderKey } : { valid: false };
}

// ---- Connect / callback -------------------------------------------------------------------

/** Begin an OAuth connect — the consent URL for a redirect-based provider (Gmail). */
export function buildConnectUrl(userId: string, provider: ProviderKey): string {
  const connector = connectorFor(provider);
  if (connector.method !== "oauth") {
    throw new ConflictError("provider_unavailable", `${provider} does not connect by OAuth.`);
  }
  if (!connector.isConfigured()) {
    throw new ConflictError("provider_unavailable", `${provider} is not configured for sending.`);
  }
  return connector.authorizeUrl(signState(userId, provider));
}

/** Complete an OAuth connect: exchange the code (redirect provider) and store the account. */
export async function completeConnection(
  userId: string,
  provider: ProviderKey,
  code: string,
  fallbackEmail: string,
  db: Db = defaultDb,
): Promise<void> {
  const connector = connectorFor(provider);
  if (connector.method !== "oauth")
    throw new ConflictError("provider_unavailable", `${provider} does not use OAuth.`);
  const tokens = await connector.exchangeCode(code);
  if (!tokens.refreshToken)
    throw new ConflictError("reconnect_required", "No refresh token was returned.");
  const emailAddress = tokens.emailAddress ?? fallbackEmail;
  if (!emailAddress)
    throw new ConflictError("email_unresolved", "Could not determine the mailbox address.");

  await persistConnection(db, {
    userId,
    provider,
    emailAddress,
    secret: tokens.refreshToken,
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt,
    scopes: tokens.scopes,
  });
}

/**
 * Complete a credentials connect (Yahoo app password): verify the submitted email + secret,
 * then store the account. The secret is kept in the encrypted-secret column and used as the
 * SMTP password at send time.
 */
export async function connectWithCredentials(
  userId: string,
  provider: ProviderKey,
  email: string,
  secret: string,
  db: Db = defaultDb,
): Promise<void> {
  const connector = connectorFor(provider);
  if (connector.method !== "credentials") {
    throw new ConflictError(
      "provider_unavailable",
      `${provider} does not connect with a password.`,
    );
  }
  await connector.verify(email, secret);
  await persistConnection(db, {
    userId,
    provider,
    emailAddress: email,
    secret,
    accessToken: null,
    scopes: [],
  });
}

type PersistArgs = {
  userId: string;
  provider: ProviderKey;
  emailAddress: string;
  /** Long-lived secret: an OAuth refresh token or an app password. */
  secret: string;
  accessToken?: string | null;
  expiresAt?: Date;
  scopes?: string[];
};

/**
 * Upsert a connected account and maintain the single-active invariant: the account becomes the
 * active sender only if the user has no other active account (else it stays connected, inactive),
 * unless it already is the active account (self-reconnect keeps it active).
 */
async function persistConnection(db: Db, args: PersistArgs): Promise<void> {
  const { userId, provider, emailAddress } = args;
  const existing = await db
    .select()
    .from(connectedEmailAccounts)
    .where(eq(connectedEmailAccounts.userId, userId));
  const active = existing.find((r) => r.isActive && r.status !== "revoked");
  const isSelf = (r: ConnectedEmailAccountRow) =>
    r.provider === provider && r.emailAddress === emailAddress;
  const isActive = !active || isSelf(active);

  const now = new Date();
  const values = {
    userId,
    provider,
    emailAddress,
    accessToken: args.accessToken ? encryptToken(args.accessToken) : null,
    refreshToken: encryptToken(args.secret),
    tokenExpiresAt: args.expiresAt ?? null,
    scopes: args.scopes ?? [],
    status: "active" as const,
    isActive,
    connectedAt: now,
    updatedAt: now,
  };

  await db
    .insert(connectedEmailAccounts)
    .values(values)
    .onConflictDoUpdate({
      target: [
        connectedEmailAccounts.userId,
        connectedEmailAccounts.provider,
        connectedEmailAccounts.emailAddress,
      ],
      set: {
        accessToken: values.accessToken,
        refreshToken: values.refreshToken,
        tokenExpiresAt: values.tokenExpiresAt,
        scopes: values.scopes,
        status: "active",
        isActive,
        connectedAt: values.connectedAt,
        updatedAt: values.updatedAt,
      },
    });
}

// ---- Status / listing ---------------------------------------------------------------------

/** The caller's active (selected) sending account, summarized for the dashboard + compose gate. */
export async function getAccountStatus(userId: string, db: Db = defaultDb): Promise<AccountStatus> {
  const [row] = await db
    .select()
    .from(connectedEmailAccounts)
    .where(
      and(eq(connectedEmailAccounts.userId, userId), eq(connectedEmailAccounts.isActive, true)),
    )
    .limit(1);
  if (!row || row.status === "revoked") return { connected: false };
  return {
    connected: row.status === "active",
    provider: row.provider as ProviderKey,
    emailAddress: row.emailAddress,
    status: row.status as AccountStatus["status"],
  };
}

/** Every connected (non-revoked) account for the settings page, plus connectable providers. */
export async function listConnectedAccounts(
  userId: string,
  db: Db = defaultDb,
): Promise<EmailAccountsStatus> {
  const rows = await db
    .select()
    .from(connectedEmailAccounts)
    .where(eq(connectedEmailAccounts.userId, userId));
  const accounts: ConnectedAccount[] = rows
    .filter((r) => r.status !== "revoked")
    .map((r) => ({
      provider: r.provider as ProviderKey,
      emailAddress: r.emailAddress,
      status: r.status as ConnectedAccount["status"],
      isActive: r.isActive,
    }));
  return { accounts, availableProviders: availableProviders() };
}

// ---- Active-account selection & disconnect ------------------------------------------------

/** Make the given provider's account the sole active sender (FR-019). */
export async function setActiveAccount(
  userId: string,
  provider: ProviderKey,
  db: Db = defaultDb,
): Promise<void> {
  const [target] = await db
    .select()
    .from(connectedEmailAccounts)
    .where(
      and(
        eq(connectedEmailAccounts.userId, userId),
        eq(connectedEmailAccounts.provider, provider),
        ne(connectedEmailAccounts.status, "revoked"),
      ),
    )
    .limit(1);
  if (!target) throw new ConflictError("no_such_account", `No connected ${provider} account.`);
  if (target.isActive) return;

  // Demote every account first (frees the single-active slot), then promote the target.
  await runAtomic(db, (x) => [
    x
      .update(connectedEmailAccounts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(eq(connectedEmailAccounts.userId, userId), eq(connectedEmailAccounts.isActive, true)),
      ),
    x
      .update(connectedEmailAccounts)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(connectedEmailAccounts.id, target.id)),
  ]);
}

/** Disconnect a provider's account (status → revoked); auto-promote another if it was active. */
export async function disconnect(
  userId: string,
  provider: ProviderKey,
  db: Db = defaultDb,
): Promise<void> {
  const rows = await db
    .select()
    .from(connectedEmailAccounts)
    .where(eq(connectedEmailAccounts.userId, userId));
  const target = rows.find((r) => r.provider === provider && r.status !== "revoked");
  if (!target) return;

  // If the disconnected account was the active one, promote another healthy account (any provider).
  const promote = target.isActive
    ? (rows.find((r) => r.id !== target.id && r.status === "active" && !r.isActive) ??
      rows.find((r) => r.id !== target.id && r.status !== "revoked" && !r.isActive))
    : undefined;

  await runAtomic(db, (x) => {
    const stmts: Array<PromiseLike<unknown>> = [
      x
        .update(connectedEmailAccounts)
        .set({ status: "revoked", isActive: false, accessToken: null, updatedAt: new Date() })
        .where(eq(connectedEmailAccounts.id, target.id)),
    ];
    if (promote) {
      stmts.push(
        x
          .update(connectedEmailAccounts)
          .set({ isActive: true, updatedAt: new Date() })
          .where(eq(connectedEmailAccounts.id, promote.id)),
      );
    }
    return stmts;
  });
}

// ---- Send-path helpers --------------------------------------------------------------------

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
        eq(connectedEmailAccounts.isActive, true),
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
