import { describe, it, expect } from "vitest";
import { mapError } from "@/lib/email/gmail-provider";
import { REAUTH_REQUIRED } from "@/lib/email/provider";

/** Coverage for Gmail error → SendResult classification (FR-017/FR-019b, T043). */

describe("mapError", () => {
  it("maps HTTP 401 to a non-retryable reauthorization failure", () => {
    expect(mapError({ response: { status: 401 } })).toEqual({ status: "failed", reason: REAUTH_REQUIRED, retryable: false });
  });

  it("maps an invalid_grant message to reauthorization", () => {
    const r = mapError({ message: "invalid_grant: token expired or revoked" });
    expect(r).toMatchObject({ status: "failed", reason: REAUTH_REQUIRED, retryable: false });
  });

  it("marks rate limits (429) and 5xx as retryable", () => {
    expect(mapError({ response: { status: 429 } })).toMatchObject({ status: "failed", retryable: true });
    expect(mapError({ response: { status: 503 } })).toMatchObject({ status: "failed", retryable: true });
  });

  it("marks a 400 bad-request as a non-retryable failure carrying the provider reason", () => {
    const r = mapError({ response: { status: 400, data: { error: { message: "Invalid To header" } } } });
    expect(r).toMatchObject({ status: "failed", retryable: false, reason: "Invalid To header" });
  });

  it("treats a 403 (not 401, no invalid_grant) as a plain non-retryable failure, not reauth", () => {
    const r = mapError({ response: { status: 403 }, message: "Forbidden" });
    expect(r).toMatchObject({ status: "failed", retryable: false });
    expect((r as { reason: string }).reason).not.toBe(REAUTH_REQUIRED);
  });
});
