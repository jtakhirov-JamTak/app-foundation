import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_ID: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(60),
  NEXT_PUBLIC_APP_VERSION: z.string().min(1).max(100),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_APP_ID: process.env.NEXT_PUBLIC_APP_ID,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
