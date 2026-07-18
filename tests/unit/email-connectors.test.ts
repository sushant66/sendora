import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConflictError } from "@/lib/errors";

/** Unit — connector registry + Yahoo credentials verification. */

vi.mock("@/lib/email/yahoo-smtp", () => ({ verifyYahooCredentials: vi.fn() }));

import { verifyYahooCredentials } from "@/lib/email/yahoo-smtp";
import { connectorFor, availableProviders } from "@/lib/email/connectors";
import { resolveProvider } from "@/lib/email/factory";

beforeEach(() => vi.clearAllMocks());

describe("connector registry", () => {
  it("classifies connect methods per provider", () => {
    expect(connectorFor("gmail").method).toBe("oauth");
    expect(connectorFor("yahoo").method).toBe("credentials");
  });

  it("lists both providers as available (Gmail env-configured, Yahoo user-supplied)", () => {
    expect(availableProviders()).toEqual(expect.arrayContaining(["gmail", "yahoo"]));
  });
});

describe("resolveProvider", () => {
  it("resolves the Yahoo sender", () => {
    expect(resolveProvider("yahoo").key).toBe("yahoo");
  });
});

describe("yahoo connector verify", () => {
  it("resolves when Yahoo SMTP accepts the app password", async () => {
    vi.mocked(verifyYahooCredentials).mockResolvedValue(undefined);
    const connector = connectorFor("yahoo");
    if (connector.method !== "credentials") throw new Error("expected credentials connector");
    await expect(connector.verify("me@yahoo.com", "app-pass")).resolves.toBeUndefined();
    expect(verifyYahooCredentials).toHaveBeenCalledWith("me@yahoo.com", "app-pass");
  });

  it("maps an SMTP sign-in failure to an invalid_credentials conflict", async () => {
    vi.mocked(verifyYahooCredentials).mockRejectedValue(new Error("535 auth failed"));
    const connector = connectorFor("yahoo");
    if (connector.method !== "credentials") throw new Error("expected credentials connector");
    await expect(connector.verify("me@yahoo.com", "bad")).rejects.toMatchObject({
      name: "ConflictError",
      code: "invalid_credentials",
    });
  });
});

describe("ConflictError shape", () => {
  it("carries a machine-readable code", () => {
    expect(new ConflictError("invalid_credentials").code).toBe("invalid_credentials");
  });
});
