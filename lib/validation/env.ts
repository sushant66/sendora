import { z } from "zod";

/**
 * Environment contract (Constitution Principle I: validate every trust boundary).
 * Parsed lazily + memoized so importing app modules in tests/build does not require
 * a fully-populated environment until the value is actually read.
 */
const EnvSchema = z.object({
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
  APP_URL: z.url(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/** Validate and return the environment. Throws a readable error on misconfiguration. */
export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test-only: reset the memoized value. */
export function resetEnvCache(): void {
  cached = null;
}

export { EnvSchema };
