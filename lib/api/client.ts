/**
 * Browser-side fetch helper for calling Sendora's internal API from client components.
 * Parses JSON, and on a non-2xx response throws {@link ApiError} carrying the status and
 * the parsed error body (so callers can surface per-field validation messages).
 */

export type ApiErrorBody = {
  error?: string;
  fields?: Record<string, string>;
  [key: string]: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;
  constructor(status: number, body: ApiErrorBody) {
    super(body.error ?? `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export async function apiRequest<T>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });

  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) throw new ApiError(res.status, (body ?? {}) as ApiErrorBody);
  return body as T;
}
