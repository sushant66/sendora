import { NextResponse } from "next/server";
import { z } from "zod";

/** JSON success response. */
export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function forbidden(): NextResponse {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export function notFound(): NextResponse {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

export function conflict(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 409 });
}

/** 422 with per-field messages, matching contracts/http-api.md. */
export function validationError(err: z.ZodError): NextResponse {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "(root)";
    fields[key] ??= issue.message;
  }
  return NextResponse.json({ error: "validation", fields }, { status: 422 });
}
