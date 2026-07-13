import type { Env } from "@/lib/validation/env";

/** A complete, valid environment fixture for tests. */
export const validEnv: Env = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/sendora_test?sslmode=require",
  AUTH_SECRET: "test-auth-secret",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  TOKEN_ENCRYPTION_KEY: "test-token-encryption-key",
  APP_URL: "http://localhost:3000",
  R2_ACCOUNT_ID: "test-r2-account-id",
  R2_ACCESS_KEY_ID: "test-r2-access-key-id",
  R2_SECRET_ACCESS_KEY: "test-r2-secret-access-key",
  R2_BUCKET_NAME: "test-resumes-bucket",
};
