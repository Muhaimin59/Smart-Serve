import type { RequestHandler } from "express";
import { logger } from "../lib/logger";

/**
 * Tiny fixed-window in-memory rate limiter (per IP). Good enough for a
 * single-node deployment; swap for a Redis-backed one when scaling out.
 */
type Bucket = { count: number; resetAt: number };

export function rateLimit(options: { windowMs?: number; max?: number; message?: string }): RequestHandler {
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const max = options.max ?? 30;
  const buckets = new Map<string, Bucket>();
  setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
  }, windowMs).unref();
  return (req, res, next) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      logger.warn({ ip: key }, "rate limit exceeded");
      res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
      res.status(429).json({ message: options.message ?? "Too many requests. Please try again shortly." });
      return;
    }
    next();
  };
}
