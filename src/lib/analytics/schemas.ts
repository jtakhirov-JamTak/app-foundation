import { z } from "zod";

const scalar = z.union([z.string().max(200), z.number().finite(), z.boolean()]);

export const eventRequestSchema = z.object({
  event_name: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  properties: z.record(z.string().min(1).max(64), scalar),
  platform: z.enum(["web", "pwa", "ios", "android"]),
  app_version: z.string().min(1).max(100),
  occurred_at: z.iso.datetime({ offset: true }),
});
