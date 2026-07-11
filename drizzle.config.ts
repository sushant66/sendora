import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside the Next.js runtime and does not auto-load .env.
try {
  process.loadEnvFile();
} catch {
  /* rely on the ambient environment (e.g. CI) */
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Read directly here (drizzle-kit runs outside the app runtime).
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
