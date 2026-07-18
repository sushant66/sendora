import { type Transporter } from "nodemailer";
import { createHash } from "node:crypto";
import { logger } from "@/lib/observability/logger";
import { createYahooTransport } from "./yahoo-smtp";
import {
  REAUTH_REQUIRED,
  type EmailProvider,
  type OutgoingMessage,
  type ProviderCredentials,
  type SendResult,
} from "./provider";

/**
 * Yahoo implementation of the EmailProvider seam. Delivery is over SMTP
 * (`smtp.mail.yahoo.com:465`) authenticated with the user's Yahoo app-specific password.
 *
 * The app password is the account's stored secret: it is carried in `creds.refreshToken` (the
 * encrypted-secret column), with no access token and no expiry — there is nothing to refresh.
 * The SMTP transport is pooled and memoized at module scope so the per-recipient send loop
 * reuses one TCP+TLS+auth session instead of reconnecting for every message.
 *
 * Ordinary delivery failures never throw — they return `{ status: "failed", reason, retryable }`.
 * An auth failure surfaces as {@link REAUTH_REQUIRED} so the caller flips the account to expired.
 */
class YahooProvider implements EmailProvider {
  readonly key = "yahoo" as const;

  async sendEmail(message: OutgoingMessage, creds: ProviderCredentials): Promise<SendResult> {
    const appPassword = creds.refreshToken;
    try {
      const transport = getTransport(message.fromEmail, appPassword);
      const info = await transport.sendMail({
        from: message.fromName
          ? { name: message.fromName, address: message.fromEmail }
          : message.fromEmail,
        to: message.to,
        subject: message.subject,
        html: message.bodyHtml,
        text: message.bodyText,
        attachments: message.attachment
          ? [
              {
                filename: message.attachment.fileName,
                content: message.attachment.content,
                contentType: message.attachment.contentType,
              },
            ]
          : undefined,
      });
      // SMTP has no server-assigned id; nodemailer returns the Message-ID header it generated.
      const id = info.messageId;
      if (!id) return { status: "failed", reason: "no_message_id", retryable: true };
      return { status: "sent", providerMessageId: id };
    } catch (err) {
      return mapError(err);
    }
  }
}

/** One pooled transport per (mailbox, app-password) pair, memoized for the process. */
const transports = new Map<string, Transporter>();

function getTransport(user: string, appPassword: string): Transporter {
  const key = createHash("sha256").update(`${user}:${appPassword}`).digest("hex");
  const existing = transports.get(key);
  if (existing) return existing;
  const transport = createYahooTransport(user, appPassword);
  transports.set(key, transport);
  return transport;
}

type SmtpLikeError = {
  code?: string;
  responseCode?: number;
  message?: string;
};

export function mapError(err: unknown): SendResult {
  const e = err as SmtpLikeError;
  const code = e.code ?? "";
  const responseCode = typeof e.responseCode === "number" ? e.responseCode : undefined;
  const messageText = e.message ?? "";

  const needsReauth =
    code === "EAUTH" ||
    responseCode === 535 ||
    /invalid.*(login|password)|authentication failed/i.test(messageText);
  if (needsReauth) {
    logger.warn("yahoo send requires reauthorization", { code, responseCode });
    return { status: "failed", reason: REAUTH_REQUIRED, retryable: false };
  }

  const transient =
    ["ETIMEDOUT", "ESOCKET", "ECONNECTION", "EDNS", "ECONNRESET"].includes(code) ||
    responseCode === 421 ||
    (responseCode !== undefined && responseCode >= 400 && responseCode < 500);
  logger.error("yahoo send failed", { code, responseCode, retryable: transient });
  return { status: "failed", reason: messageText || code || "send_failed", retryable: transient };
}

export const yahooProvider: EmailProvider = new YahooProvider();
