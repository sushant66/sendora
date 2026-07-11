import { logger } from "@/lib/observability/logger";

/**
 * Database seed entry point.
 *
 * Foundation: no seed data yet. Starter (system) email templates are seeded here
 * in User Story 2 (see specs/001-recruiter-outreach/tasks.md, T037).
 */
async function seed(): Promise<void> {
  logger.info("seed: nothing to seed yet (starter templates arrive in US2)");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error("seed failed", { error: String(err) });
    process.exit(1);
  });
