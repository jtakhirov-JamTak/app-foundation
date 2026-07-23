import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { clientEnv } from "@/lib/env/client";
import { serverEnv } from "@/lib/env/server";

const localBuckets = new Map<string, { count: number; resetAt: number }>();
let redis: Redis | null = null;

function distributedLimiter(limit: number, window: `${number} ${"s" | "m" | "h"}`) {
  if (!serverEnv.UPSTASH_REDIS_REST_URL || !serverEnv.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  redis ??= new Redis({
    url: serverEnv.UPSTASH_REDIS_REST_URL,
    token: serverEnv.UPSTASH_REDIS_REST_TOKEN
  });

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: clientEnv.NEXT_PUBLIC_APP_ID
  });
}

type LimitResult =
  | { success: true; remaining: number; reset: number }
  | { success: false; remaining: 0; reset: number; reason: "limited" | "unavailable" };

function localLimit(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  const existing = localBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    localBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, reset: now + windowMs };
  }

  if (existing.count >= limit) {
    return {
      success: false,
      remaining: 0,
      reset: existing.resetAt,
      reason: "limited"
    };
  }

  existing.count += 1;
  return {
    success: true,
    remaining: limit - existing.count,
    reset: existing.resetAt
  };
}

function windowToMs(window: `${number} ${"s" | "m" | "h"}`): number {
  const [amountText, unit] = window.split(" ");
  const amount = Number(amountText);
  const multiplier = unit === "h" ? 3_600_000 : unit === "m" ? 60_000 : 1_000;
  return amount * multiplier;
}

export async function limitUser(
  key: string,
  limit: number,
  window: `${number} ${"s" | "m" | "h"}`
) {
  const limiter = distributedLimiter(limit, window);
  if (limiter) {
    try {
      const result = await limiter.limit(key);
      if (result.success) {
        return {
          success: true,
          remaining: result.remaining,
          reset: result.reset
        } satisfies LimitResult;
      }
      return {
        success: false,
        remaining: 0,
        reset: result.reset,
        reason: "limited"
      } satisfies LimitResult;
    } catch {
      return {
        success: false,
        remaining: 0,
        reset: Date.now() + windowToMs(window),
        reason: "unavailable"
      } satisfies LimitResult;
    }
  }

  if (serverEnv.APP_ENV === "production") {
    return {
      success: false,
      remaining: 0,
      reset: Date.now() + windowToMs(window),
      reason: "unavailable"
    } satisfies LimitResult;
  }

  return localLimit(key, limit, windowToMs(window));
}
