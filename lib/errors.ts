/**
 * Domain errors thrown by service-layer code and mapped to HTTP responses by route
 * handlers (see lib/http/responses.ts). Keeping them here decouples business logic in
 * `lib/` from the framework/HTTP layer (Constitution Principle I: simple, testable core).
 */

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ConflictError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "ConflictError";
    this.code = code;
  }
}

/** Template save rejected because it references merge tokens outside the vocabulary (FR-011). */
export class UnsupportedMergeFieldsError extends Error {
  readonly tokens: string[];
  constructor(tokens: string[]) {
    super(`unsupported merge fields: ${tokens.join(", ")}`);
    this.name = "UnsupportedMergeFieldsError";
    this.tokens = tokens;
  }
}

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}
