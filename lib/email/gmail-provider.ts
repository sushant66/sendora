import { google } from "googleapis";
import { getEnv } from "@/lib/validation/env";
import { logger } from "@/lib/observability/logger";
import { buildRawMessage } from "./mime";
import {
  REAUTH_REQUIRED,
  type EmailProvider,
  type OutgoingMessage,
  type ProviderCredentials,
  type SendResult,
} from "./provider";

/**
 * Gmail implementation of the EmailProvider seam (User Story 2, research §4).
 *
 * Uses `users.messages.send` with the `gmail.send` scope only. The OAuth2 client refreshes
 * the access token from the stored refresh token automatically when it is expired; a
 * revoked/expired refresh token surfaces as a {@link REAUTH_REQUIRED} failure so the caller
 * can flip the account to `expired`/`revoked` (FR-019b). Ordinary delivery failures never
 * throw — they return `{ status: "failed", reason, retryable }` (FR-017/018).
 */
class GmailProvider implements EmailProvider {
  readonly key = "gmail" as const;

  async sendEmail(message: OutgoingMessage, creds: ProviderCredentials): Promise<SendResult> {
    const env = getEnv();
    const auth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
    auth.setCredentials({
      access_token: creds.accessToken || undefined,
      refresh_token: creds.refreshToken,
      expiry_date: creds.expiresAt ? creds.expiresAt.getTime() : undefined,
    });

    const gmail = google.gmail({ version: "v1", auth });
    try {
      const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: buildRawMessage(message) },
      });
      const id = res.data.id;
      if (!id) return { status: "failed", reason: "no_message_id", retryable: true };
      return { status: "sent", providerMessageId: id };
    } catch (err) {
      return mapError(err);
    }
  }
}

type GaxiosLikeError = {
  code?: number | string;
  message?: string;
  response?: { status?: number; data?: { error?: string | { message?: string } } };
};

export function mapError(err: unknown): SendResult {
  const e = err as GaxiosLikeError;
  const status = typeof e.response?.status === "number" ? e.response.status : Number(e.code);
  const data = e.response?.data;
  const dataError = typeof data?.error === "string" ? data.error : data?.error?.message;
  const messageText = `${dataError ?? ""} ${e.message ?? ""}`;

  const needsReauth = status === 401 || /invalid_grant|invalid_credentials|unauthorized/i.test(messageText);
  if (needsReauth) {
    logger.warn("gmail send requires reauthorization", { status });
    return { status: "failed", reason: REAUTH_REQUIRED, retryable: false };
  }

  const retryable = status === 429 || (status >= 500 && status < 600);
  logger.error("gmail send failed", { status, retryable });
  return { status: "failed", reason: dataError || e.message || "send_failed", retryable };
}

export const gmailProvider: EmailProvider = new GmailProvider();

// Re-export for the MIME format contract test.
export { buildRawMessage } from "./mime";
