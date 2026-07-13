import { describe, it, expect } from "vitest";
import { NoSuchKey } from "@aws-sdk/client-s3";
import { isNotFoundError } from "@/lib/storage/r2-client";

/**
 * The only branch in `r2-client.ts` with real logic: mapping an S3/R2 "object missing"
 * error to `null` (which the resumes service turns into a NotFoundError) versus rethrowing
 * a genuine failure. `instanceof NoSuchKey` alone is fragile, so a name/404 match is also
 * accepted — and unrelated errors must still propagate.
 */
describe("isNotFoundError", () => {
  it("matches a NoSuchKey instance", () => {
    expect(isNotFoundError(new NoSuchKey({ message: "nope", $metadata: {} }))).toBe(true);
  });

  it("matches by error name when the class identity is lost (e.g. under bundling)", () => {
    expect(isNotFoundError({ name: "NoSuchKey" })).toBe(true);
  });

  it("matches a bare 404 status", () => {
    expect(isNotFoundError({ name: "NotFound", $metadata: { httpStatusCode: 404 } })).toBe(true);
  });

  it("rethrows unrelated errors (access denied, network, null/undefined)", () => {
    expect(isNotFoundError({ name: "AccessDenied", $metadata: { httpStatusCode: 403 } })).toBe(false);
    expect(isNotFoundError(new Error("network"))).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError(undefined)).toBe(false);
  });
});
