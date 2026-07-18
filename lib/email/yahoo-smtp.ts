import nodemailer, { type Transporter } from "nodemailer";
import type SMTPPool from "nodemailer/lib/smtp-pool";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

/**
 * Yahoo sends over SMTP with an app-specific password (Yahoo has no send REST API, and its
 * OAuth mail scope requires a separate approval we deliberately avoid). The user generates an
 * app password in Yahoo Account Security and we authenticate SMTP with their email + that
 * password. See https://help.yahoo.com/kb/generate-third-party-passwords-sln15241.html
 */
export const YAHOO_SMTP_HOST = "smtp.mail.yahoo.com";
export const YAHOO_SMTP_PORT = 465;

export function createYahooTransport(user: string, appPassword: string, pool = true): Transporter {
  const base = {
    host: YAHOO_SMTP_HOST,
    port: YAHOO_SMTP_PORT,
    secure: true,
    auth: { user, pass: appPassword },
    // Fail fast instead of nodemailer's 2-minute default so a slow/unreachable host doesn't
    // hang the connect request (which verifies synchronously) or a send.
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  };
  const options = pool
    ? ({ ...base, pool: true as const, maxConnections: 1 } satisfies SMTPPool.Options)
    : (base satisfies SMTPTransport.Options);
  return nodemailer.createTransport(options);
}

/** Confirm the email + app password authenticate against Yahoo SMTP; throws otherwise. */
export async function verifyYahooCredentials(user: string, appPassword: string): Promise<void> {
  const transport = createYahooTransport(user, appPassword, false);
  try {
    await transport.verify();
  } finally {
    transport.close();
  }
}
