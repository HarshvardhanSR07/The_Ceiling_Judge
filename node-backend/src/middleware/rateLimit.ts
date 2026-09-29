/**
 * @file middleware/rateLimit.ts
 * @description In-memory sliding-window rate limiter.
 *
 * Two rate-limit buckets are implemented:
 *   - `rateLimitAuth`    — keyed on IP + path; guards login / register
 *   - `rateLimitObserve` — keyed on judgeId; guards observation submission
 *
 * Design decisions
 * ────────────────
 * • In-memory is intentional for the offline, single-node Docker Compose
 *   deployment.  For multi-node or Redis-backed deployments, replace `bump`
 *   with a Redis INCR / EXPIRE pair and the behaviour contracts remain the same.
 *
 * • `clientIp` reads `X-Forwarded-For` because the Docker Compose stack puts
 *   a reverse proxy in front of the backend.  If this service is ever exposed
 *   directly (no trusted proxy), remove the header read and use
 *   `req.socket.remoteAddress` only — otherwise an attacker can spoof any IP.
 *
 * • Bucket GC runs every 15 seconds (previously 60 s) to bound memory growth
 *   during bursts of unique IPs.  `MAX_BUCKETS` caps the map so a sustained
 *   flood of unique IPs cannot exhaust process memory.
 *
 * Rate limit headers follow the IETF draft-polli-ratelimit-headers spec.
 */

import { Request, Response, NextFunction } from "express";
import { authConfig }    from "../config/auth.js";
import type { AuthedRequest } from "./auth.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Observation rate-limit window (5 minutes). */
const OBSERVE_WINDOW_MS = 5 * 60 * 1000;

/** Max observations per judge per window. */
const OBSERVE_MAX = 60;

/**
 * Maximum number of buckets held in memory at once.  Once this limit is
 * reached, the oldest-resetAt bucket is evicted on each new arrival.
 * This prevents a sustained flood of unique IPs from growing the map unboundedly.
 */
const MAX_BUCKETS = 10_000;

// ---------------------------------------------------------------------------
// Bucket store
// ---------------------------------------------------------------------------

interface Bucket {
  count:   number;
  resetAt: number; // Unix ms
}

const buckets = new Map<string, Bucket>();

/**
 * Garbage-collect expired buckets every 15 seconds.
 * `unref()` ensures this timer does not keep the Node.js event loop alive.
 */
const gcTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 15_000);

if (typeof gcTimer.unref === "function") gcTimer.unref();

// ---------------------------------------------------------------------------
// Core increment function
// ---------------------------------------------------------------------------

/**
 * Increments the request count for a bucket key within the given window.
 * Sets standard rate-limit response headers on every call.
 *
 * @param key      - Unique string identifying this rate-limit bucket.
 * @param windowMs - Sliding window duration in milliseconds.
 * @param max      - Maximum requests allowed within the window.
 * @param res      - Express response (for header injection).
 * @returns `true` if the request is within the limit, `false` if it exceeds it.
 */
function increment(key: string, windowMs: number, max: number, res: Response): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    // Evict oldest bucket if at capacity
    if (buckets.size >= MAX_BUCKETS) {
      let oldestKey = "";
      let oldestReset = Infinity;
      for (const [k, b] of buckets) {
        if (b.resetAt < oldestReset) { oldestKey = k; oldestReset = b.resetAt; }
      }
      if (oldestKey) buckets.delete(oldestKey);
    }
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  const remaining = Math.max(0, max - bucket.count);
  res.setHeader("X-RateLimit-Limit",     String(max));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset",     String(Math.ceil(bucket.resetAt / 1000)));

  return bucket.count <= max;
}

/**
 * Computes the number of seconds until the rate-limit window resets for a key.
 * Returns 0 if the key has no active bucket.
 */
function retryAfterSec(key: string): number {
  const bucket = buckets.get(key);
  if (!bucket) return 0;
  return Math.max(0, Math.ceil((bucket.resetAt - Date.now()) / 1000));
}

// ---------------------------------------------------------------------------
// IP extraction
// ---------------------------------------------------------------------------

/**
 * Extracts the most-likely client IP address from a request.
 *
 * Behind the Docker Compose reverse proxy, `X-Forwarded-For` carries the
 * real client IP.  The first entry in a comma-separated list is the
 * originating client; subsequent entries are intermediate proxies.
 *
 * CAUTION: if the server is ever exposed directly (no proxy), this header
 * is fully attacker-controlled and must not be trusted for security checks.
 */
function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"] as string | undefined;
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? "unknown";
}

// ---------------------------------------------------------------------------
// Exported middleware
// ---------------------------------------------------------------------------

/**
 * Rate-limits authentication routes (login / register) by IP + path.
 *
 * Default: 30 requests per 15-minute window per IP+path pair.
 * Configurable via `authConfig.rateLimitMax` and `authConfig.rateLimitWindowMs`.
 */
export function rateLimitAuth(req: Request, res: Response, next: NextFunction): void {
  const key = `auth:${clientIp(req)}:${req.path}`;
  if (!increment(key, authConfig.rateLimitWindowMs, authConfig.rateLimitMax, res)) {
    res.setHeader("Retry-After", String(retryAfterSec(key)));
    res.status(429).json({
      error:          "too many requests",
      retryAfterSec:  retryAfterSec(key),
    });
    return;
  }
  next();
}

/**
 * Rate-limits observation submission by authenticated judge ID.
 *
 * Falls back to IP if `req.user` is not populated (should not happen on this
 * route since `requireRole` runs before this middleware, but guards defensively).
 *
 * Default: 60 observations per 5-minute window per judge.
 */
export function rateLimitObserve(req: AuthedRequest, res: Response, next: NextFunction): void {
  const identity = req.user?.id ?? clientIp(req);
  const key = `observe:${identity}`;

  if (!increment(key, OBSERVE_WINDOW_MS, OBSERVE_MAX, res)) {
    res.setHeader("Retry-After", String(retryAfterSec(key)));
    res.status(429).json({
      error:          "observation rate limit exceeded",
      limit:          OBSERVE_MAX,
      windowSec:      OBSERVE_WINDOW_MS / 1000,
      retryAfterSec:  retryAfterSec(key),
    });
    return;
  }
  next();
}
