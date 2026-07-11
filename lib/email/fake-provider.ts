import type { EmailProvider, OutgoingMessage, ProviderCredentials, SendResult } from "./provider";

/**
 * Configurable fake EmailProvider for unit/integration tests (User Story 2, T040).
 * Records every message it "sends" and lets a test script the per-recipient outcome
 * (e.g. to exercise partial-failure and mid-batch reauth paths without a network).
 */
export class FakeEmailProvider implements EmailProvider {
  readonly key = "gmail" as const;
  readonly sent: { message: OutgoingMessage; creds: ProviderCredentials }[] = [];

  constructor(
    /** Decide the result per call; defaults to success with a synthetic message id. */
    private readonly outcome: (message: OutgoingMessage, callIndex: number) => SendResult = (_m, i) => ({
      status: "sent",
      providerMessageId: `fake-${i}`,
    }),
  ) {}

  async sendEmail(message: OutgoingMessage, creds: ProviderCredentials): Promise<SendResult> {
    const index = this.sent.length;
    this.sent.push({ message, creds });
    return this.outcome(message, index);
  }
}

/** Convenience: a fake that fails a specific recipient address. */
export function fakeProviderFailing(failFor: (to: string) => boolean, reason = "rejected"): FakeEmailProvider {
  return new FakeEmailProvider((m, i) =>
    failFor(m.to)
      ? { status: "failed", reason, retryable: false }
      : { status: "sent", providerMessageId: `fake-${i}` },
  );
}
