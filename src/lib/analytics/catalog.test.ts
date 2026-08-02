import { describe, expect, it } from "vitest";

import { eventRequestSchema } from "./catalog";
import { trackEvent } from "./client";

const envelope = {
  platform: "web",
  app_version: "test",
  occurred_at: "2026-08-01T00:00:00.000Z",
} as const;

// Never invoked. `npm run typecheck` is the assertion: tsconfig includes every
// *.ts, so this file fails the build if the event-name -> properties mapping
// ever stops being enforced. Without it the mapping holds only by request.
async function eventNameToPropertyMappingIsEnforced() {
  await trackEvent("screen_viewed", { screen: "home" });
  await trackEvent("app_error_recorded", {
    area: "global",
    code: "ROUTE_RENDER_FAILED",
    recoverable: true,
  });
  await trackEvent("app_error_recorded", {
    area: "global",
    code: "ROUTE_RENDER_FAILED",
    recoverable: true,
    digest: "a1b2c3d4",
  });
  await trackEvent("screen_viewed", {
    // @ts-expect-error app_error_recorded properties are not valid for screen_viewed
    area: "global",
    code: "ROUTE_RENDER_FAILED",
    recoverable: true,
  });
}

describe("analytics catalog", () => {
  it("keeps the per-event property mapping under typecheck", () => {
    expect(typeof eventNameToPropertyMappingIsEnforced).toBe("function");
  });

  it("accepts a valid event", () => {
    const result = eventRequestSchema.safeParse({
      event_name: "screen_viewed",
      properties: { screen: "home", referrer_screen: "settings" },
      ...envelope,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown event name", () => {
    const result = eventRequestSchema.safeParse({
      event_name: "not_in_the_catalog",
      properties: { screen: "home" },
      ...envelope,
    });
    expect(result.success).toBe(false);
  });

  it("rejects properties belonging to a different event", () => {
    const result = eventRequestSchema.safeParse({
      event_name: "screen_viewed",
      properties: { area: "global", code: "ROUTE_RENDER_FAILED", recoverable: true },
      ...envelope,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unlisted property on a known event", () => {
    const result = eventRequestSchema.safeParse({
      event_name: "screen_viewed",
      properties: { screen: "home", note: "free text" },
      ...envelope,
    });
    expect(result.success).toBe(false);
  });

  it("accepts app_error_recorded with and without a digest", () => {
    const base = { area: "global", code: "ROUTE_RENDER_FAILED", recoverable: true };
    for (const properties of [base, { ...base, digest: "a1b2c3d4" }]) {
      const result = eventRequestSchema.safeParse({
        event_name: "app_error_recorded",
        properties,
        ...envelope,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects a digest over the 128-character cap", () => {
    const result = eventRequestSchema.safeParse({
      event_name: "app_error_recorded",
      properties: {
        area: "global",
        code: "ROUTE_RENDER_FAILED",
        recoverable: true,
        digest: "x".repeat(129),
      },
      ...envelope,
    });
    expect(result.success).toBe(false);
  });

  it("rejects out-of-range numeric properties", () => {
    const result = eventRequestSchema.safeParse({
      event_name: "navigation_feedback_measured",
      properties: { from: "home", to: "settings", feedback_ms: 60_001 },
      ...envelope,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a timestamp without an offset", () => {
    const result = eventRequestSchema.safeParse({
      event_name: "screen_viewed",
      properties: { screen: "home" },
      ...envelope,
      occurred_at: "2026-08-01 00:00:00",
    });
    expect(result.success).toBe(false);
  });
});
