import { z } from "zod";

// The single source of event semantics. Names, property shapes, and every
// exported type derive from the schemas below; the database enforces only
// generic invariants (see public.analytics_properties_safe). Extend the catalog
// by editing this file — declaration merging cannot reach zod-derived types.
//
// Client modules must import from here with `import type` only, so zod stays
// out of the browser bundle. `npm run check:bundle` is the guard.

export const screenSchema = z.enum([
  "home",
  "settings",
  // Returned by screenFromPath in production for a path no screen claims.
  "unregistered",
  // EXAMPLE-ONLY: delete with src/app/(app)/(example-feature)
  "example",
  // END EXAMPLE-ONLY
]);

export const navigationTypeSchema = z.enum(["navigate", "reload", "back-forward", "prerender"]);
export const vitalNameSchema = z.enum(["LCP", "INP", "CLS"]);
export const vitalRatingSchema = z.enum(["good", "needs-improvement", "poor"]);

export const errorAreaSchema = z.enum([
  "global",
  "protected_route",
  "analytics",
  // EXAMPLE-ONLY: delete with src/app/(app)/(example-feature)
  "example",
  // END EXAMPLE-ONLY
]);

export const errorCodeSchema = z.enum([
  "UNHANDLED_APPLICATION_ERROR",
  "ROUTE_RENDER_FAILED",
  "ANALYTICS_WRITE_FAILED",
  // EXAMPLE-ONLY: delete with src/app/(app)/(example-feature)
  "EXAMPLE_LOAD_FAILED",
  "EXAMPLE_SAVE_FAILED",
  // END EXAMPLE-ONLY
]);

export type ScreenName = z.infer<typeof screenSchema>;
export type NavigationType = z.infer<typeof navigationTypeSchema>;
export type VitalName = z.infer<typeof vitalNameSchema>;
export type VitalRating = z.infer<typeof vitalRatingSchema>;
export type ErrorArea = z.infer<typeof errorAreaSchema>;
export type ErrorCode = z.infer<typeof errorCodeSchema>;

const screenViewedPropertiesSchema = z.strictObject({
  screen: screenSchema,
  referrer_screen: screenSchema.optional(),
});

const navigationFeedbackPropertiesSchema = z.strictObject({
  from: screenSchema,
  to: screenSchema,
  feedback_ms: z.number().min(0).max(60_000),
});

const webVitalPropertiesSchema = z.strictObject({
  metric: vitalNameSchema,
  value: z.number().min(0),
  rating: vitalRatingSchema,
  navigation_type: navigationTypeSchema,
  screen: screenSchema,
});

const appErrorPropertiesSchema = z.strictObject({
  area: errorAreaSchema,
  code: errorCodeSchema,
  recoverable: z.boolean(),
  // Next's server-generated error hash. Sanitized by construction — it is a
  // digest, not a message — and it is the only handle that ties a client error
  // report to a server log line. Absent for purely client-side errors, so it is
  // optional and recordError omits the key rather than sending undefined.
  digest: z.string().min(1).max(128).optional(),
});

// EXAMPLE-ONLY: delete with src/app/(app)/(example-feature)
const exampleRecordCreatedPropertiesSchema = z.strictObject({
  source: z.literal("example_form"),
});
// END EXAMPLE-ONLY

// The map, not a flat union, is what preserves per-event property typing for
// trackEvent: EventProperties[K] resolves through it to one event's schema.
export const eventPropertySchemas = {
  screen_viewed: screenViewedPropertiesSchema,
  navigation_feedback_measured: navigationFeedbackPropertiesSchema,
  web_vital_recorded: webVitalPropertiesSchema,
  app_error_recorded: appErrorPropertiesSchema,
  // EXAMPLE-ONLY: delete with src/app/(app)/(example-feature)
  example_record_created: exampleRecordCreatedPropertiesSchema,
  // END EXAMPLE-ONLY
} as const;

export type EventName = keyof typeof eventPropertySchemas;

export type EventProperties = {
  [K in EventName]: z.infer<(typeof eventPropertySchemas)[K]>;
};

const requestEnvelope = {
  platform: z.enum(["web", "pwa", "ios", "android"]),
  app_version: z.string().min(1).max(100),
  occurred_at: z.iso.datetime({ offset: true }),
};

function eventMember<TName extends EventName>(name: TName) {
  return z.object({
    event_name: z.literal(name),
    properties: eventPropertySchemas[name],
    ...requestEnvelope,
  });
}

export const eventRequestSchema = z.discriminatedUnion("event_name", [
  eventMember("screen_viewed"),
  eventMember("navigation_feedback_measured"),
  eventMember("web_vital_recorded"),
  eventMember("app_error_recorded"),
  // EXAMPLE-ONLY: delete with src/app/(app)/(example-feature)
  eventMember("example_record_created"),
  // END EXAMPLE-ONLY
]);
