import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  UnsupportedMergeFieldsError,
} from "@/lib/errors";
import { logger } from "@/lib/observability/logger";
import {
  conflict,
  forbidden,
  notFound,
  tooManyRequests,
  unauthorized,
  unsupportedMergeFields,
  validationError,
} from "./responses";

/**
 * Wraps a route handler so domain errors map to the HTTP contract
 * (contracts/http-api.md) in one place. Handlers throw; this translates.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof UnauthorizedError) return unauthorized();
      if (err instanceof z.ZodError) return validationError(err);
      if (err instanceof UnsupportedMergeFieldsError) return unsupportedMergeFields(err.tokens);
      if (err instanceof ConflictError) return conflict(err.code);
      if (err instanceof TooManyRequestsError) return tooManyRequests();
      if (err instanceof ForbiddenError) return forbidden();
      if (err instanceof NotFoundError) return notFound();
      logger.error("unhandled route error", { error: String(err) });
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }
  };
}
