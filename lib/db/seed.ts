// Load .env for standalone CLI runs. Next.js loads it automatically, but `tsx` does not,
// so without this the DB client's startup env validation fails. Safe no-op if absent
// (e.g. CI provides the environment directly).
try {
  process.loadEnvFile();
} catch {
  /* rely on the ambient environment */
}

import { logger } from "@/lib/observability/logger";
import { buildStarterTemplates } from "@/lib/templates/starters";

/**
 * Database seed entry point. Re-seeds the starter (system) email templates (User Story 2,
 * T037): clears existing system templates and re-inserts from source, so it is safe to
 * run repeatedly.
 *
 * DB-touching modules are imported dynamically so `.env` is loaded before their module
 * initialization validates the environment.
 */
async function seed(): Promise<void> {
  const { and, eq, isNull } = await import("drizzle-orm");
  const { db } = await import("@/lib/db/client");
  const { emailTemplates } = await import("@/lib/db/schema");

  const starters = buildStarterTemplates();

  await db.delete(emailTemplates).where(and(eq(emailTemplates.kind, "system"), isNull(emailTemplates.userId)));
  await db.insert(emailTemplates).values(
    starters.map((t) => ({
      userId: null,
      kind: t.kind,
      name: t.name,
      subject: t.subject,
      bodyHtml: t.bodyHtml,
      bodyText: t.bodyText,
      mergeFields: t.mergeFields,
    })),
  );

  logger.info("seed: starter templates ready", { count: starters.length });
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error("seed failed", { error: String(err) });
    process.exit(1);
  });
