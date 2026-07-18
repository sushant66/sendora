/**
 * Minimal in-memory sliding-window rate limiter. It blunts rapid-fire abuse of expensive
 * endpoints (e.g. the Yahoo credentials verify, which opens a live outbound SMTP auth per call)
 * so one client can't drive a burst of connections from the server's IP.
 *
 * It is per-instance, not global: good enough to stop a burst on a warm serverless instance, but
 * a durable/shared store (KV) would be needed for hard cross-instance guarantees. Buckets are
 * keyed by caller (e.g. userId), so the map is bounded by active users on the instance.
 */
type Window = { count: number; resetAt: number };
const buckets = new Map<string, Window>();

/** Returns true if the call is allowed, false once `limit` is exceeded within `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
