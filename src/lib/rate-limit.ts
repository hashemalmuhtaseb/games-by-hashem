import { singleton } from "./globals";

/** In-memory token bucket. Good for a single instance; swap for Redis when scaling horizontally. */
interface Bucket {
  tokens: number;
  at: number;
}
const buckets = singleton("rateLimit", () => new Map<string, Bucket>());

export function rateLimit(key: string, capacity: number, refillPerSec: number): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: capacity, at: now };
  b.tokens = Math.min(capacity, b.tokens + ((now - b.at) / 1000) * refillPerSec);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 50_000) for (const [k, v] of buckets) if (now - v.at > 600_000) buckets.delete(k);
  return true;
}
