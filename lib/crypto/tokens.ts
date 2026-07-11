import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/validation/env";

/**
 * Symmetric encryption for OAuth refresh tokens at rest (FR-019, security hardening).
 * AES-256-GCM with a per-value random IV; the 32-byte key is derived from
 * TOKEN_ENCRYPTION_KEY. Ciphertext is stored as `iv:authTag:data` (all base64).
 *
 * Tokens are never logged and never returned to the client.
 */

const ALGO = "aes-256-gcm";

function key(): Buffer {
  return createHash("sha256").update(getEnv().TOKEN_ENCRYPTION_KEY).digest();
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptToken(ciphertext: string): string {
  const [ivB64, tagB64, dataB64] = ciphertext.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("malformed encrypted token");
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
