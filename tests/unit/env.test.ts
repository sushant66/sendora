import { describe, it, expect, beforeEach } from "vitest";
import { getEnv, resetEnvCache } from "@/lib/validation/env";
import { validEnv } from "../helpers/env";

describe("env validation (Principle I: trust-boundary validation)", () => {
  beforeEach(() => resetEnvCache());

  it("accepts a complete, valid environment", () => {
    expect(getEnv(validEnv as unknown as NodeJS.ProcessEnv)).toEqual(validEnv);
  });

  it("throws a readable error when a required var is missing", () => {
    const { AUTH_SECRET, ...incomplete } = validEnv;
    void AUTH_SECRET;
    expect(() => getEnv(incomplete as unknown as NodeJS.ProcessEnv)).toThrow(
      /AUTH_SECRET/,
    );
  });

  it("rejects a malformed DATABASE_URL", () => {
    expect(() =>
      getEnv({ ...validEnv, DATABASE_URL: "not-a-url" } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/DATABASE_URL/);
  });
});
