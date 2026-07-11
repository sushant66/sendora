import { defineConfig } from "drizzle-kit";

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
