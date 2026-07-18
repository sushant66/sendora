import { describe, it, expect } from "vitest";
import { mapError } from "@/lib/email/yahoo-provider";
import { REAUTH_REQUIRED } from "@/lib/email/provider";

/** Unit — Yahoo SMTP error classification (never throws; maps to sent/failed contract). */

describe("yahoo-provider mapError", () => {
  it("maps an SMTP auth failure to reauthorization required (non-retryable)", () => {
    expect(mapError({ code: "EAUTH", responseCode: 535, message: "Invalid login" })).toEqual({
      status: "failed",
      reason: REAUTH_REQUIRED,
      retryable: false,
    });
  });

  it("treats a 535 response code as reauthorization required even without EAUTH", () => {
    const r = mapError({ responseCode: 535, message: "authentication failed" });
    expect(r).toMatchObject({ status: "failed", reason: REAUTH_REQUIRED, retryable: false });
  });

  it("marks connection/timeout errors as retryable", () => {
    for (const code of ["ETIMEDOUT", "ESOCKET", "ECONNECTION", "ECONNRESET"]) {
      expect(mapError({ code })).toMatchObject({ status: "failed", retryable: true });
    }
  });

  it("marks a 421 (service not available) as retryable", () => {
    expect(mapError({ responseCode: 421, message: "try again later" })).toMatchObject({
      status: "failed",
      retryable: true,
    });
  });

  it("marks a 5xx as failed but non-retryable", () => {
    expect(mapError({ responseCode: 550, message: "mailbox unavailable" })).toMatchObject({
      status: "failed",
      retryable: false,
    });
  });
});
