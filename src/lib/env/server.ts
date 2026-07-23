import "server-only";

import { z } from "zod";

const serverEnvSchema = z
  .object({
    APP_ENV: z.enum(["local", "test", "production"]),
    SUPABASE_SECRET_KEY: z.string().min(20),
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(20).optional(),
  })
  .superRefine((value, context) => {
    const hasUrl = Boolean(value.UPSTASH_REDIS_REST_URL);
    const hasToken = Boolean(value.UPSTASH_REDIS_REST_TOKEN);
    if (hasUrl !== hasToken) {
      context.addIssue({
        code: "custom",
        message: "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together",
      });
    }
    if (value.APP_ENV === "production" && (!hasUrl || !hasToken)) {
      context.addIssue({
        code: "custom",
        message: "Distributed rate limiting is required when APP_ENV=production",
      });
    }
  });

export const serverEnv = serverEnvSchema.parse({
  APP_ENV: process.env.APP_ENV,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || undefined,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || undefined,
});
