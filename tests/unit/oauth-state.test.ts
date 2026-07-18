import { describe, it, expect } from "vitest";
import { signState, verifyState } from "@/lib/email/account-service";

/** Unit — the OAuth `state` carries the provider and is tamper-evident (CSRF guard). */

describe("signState / verifyState", () => {
  it("round-trips the user and provider", () => {
    const state = signState("u1", "gmail");
    expect(verifyState(state, "u1")).toEqual({ valid: true, provider: "gmail" });
  });

  it("recovers the provider so one callback can serve many providers", () => {
    expect(verifyState(signState("u1", "yahoo"), "u1")).toEqual({ valid: true, provider: "yahoo" });
  });

  it("rejects a state signed for a different user", () => {
    expect(verifyState(signState("u2", "gmail"), "u1")).toEqual({ valid: false });
  });

  it("rejects a tampered provider (MAC covers user+provider)", () => {
    const state = signState("u1", "gmail");
    const tampered = state.replace("gmail", "yahoo");
    expect(verifyState(tampered, "u1")).toEqual({ valid: false });
  });

  it("rejects a malformed state", () => {
    expect(verifyState("garbage", "u1")).toEqual({ valid: false });
  });
});
