import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken } from "@/lib/crypto/tokens";

/** Coverage for refresh-token encryption at rest (FR-019 security, T044). */

describe("token encryption", () => {
  it("round-trips a value", () => {
    const secret = "1//refresh-token-value.abcDEF123";
    expect(decryptToken(encryptToken(secret))).toBe(secret);
  });

  it("produces different ciphertext each time (random IV) but decrypts to the same value", () => {
    const a = encryptToken("same");
    const b = encryptToken("same");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("same");
    expect(decryptToken(b)).toBe("same");
  });

  it("does not contain the plaintext", () => {
    expect(encryptToken("super-secret-token")).not.toContain("super-secret-token");
  });

  it("rejects tampered ciphertext (GCM auth tag)", () => {
    const [iv, tag, data] = encryptToken("payload").split(":");
    const flipped = data!.slice(0, -2) + (data!.slice(-2) === "AA" ? "BB" : "AA");
    expect(() => decryptToken(`${iv}:${tag}:${flipped}`)).toThrow();
  });

  it("rejects a malformed value", () => {
    expect(() => decryptToken("not-valid")).toThrow(/malformed/);
  });
});
