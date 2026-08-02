import { describe, expect, it } from "vitest";

import { assertSafeEventProperties } from "./privacy";

// The same vectors are asserted against the SQL constraint in
// supabase/tests/001_foundation_rls.sql. That pairing is the cross-language
// contract: change one policy without the other and one of the two suites fails.
const ACCEPTED_KEYS = ["metric", "digest", "screen", "feedback_ms", "subtitle", "notes_count"];
const REJECTED_KEYS = [
  // Rejected by design: every *_name segment is, technical keys included.
  "screen_name",
  "patient_name",
  "full_name",
  "email",
  "user_email",
  "access_token",
];

describe("analytics privacy", () => {
  it("accepts the shared allowed keys", () => {
    expect(() =>
      assertSafeEventProperties(Object.fromEntries(ACCEPTED_KEYS.map((key) => [key, "value"]))),
    ).not.toThrow();
  });

  it.each([...REJECTED_KEYS, "free_text", "private_url", "error_message", "stack", "username"])(
    "rejects prohibited key %s",
    (key) => {
      expect(() => assertSafeEventProperties({ [key]: "value" })).toThrow();
    },
  );

  it("accepts allowlisted scalar properties", () => {
    expect(() =>
      assertSafeEventProperties({
        screen: "home",
        feedback_ms: 42,
        recoverable: true,
      }),
    ).not.toThrow();
  });

  it("rejects nested properties", () => {
    expect(() => assertSafeEventProperties({ context: { id: 1 } })).toThrow();
  });

  it("rejects null values, which jsonb_typeof does not count as a scalar", () => {
    expect(() => assertSafeEventProperties({ screen: null })).toThrow();
  });

  it("rejects payloads over 4 KiB", () => {
    expect(() => assertSafeEventProperties({ value: "x".repeat(5000) })).toThrow();
  });

  // Why recordError spreads `digest` instead of passing it positionally. An
  // undefined value is not a scalar, so a present-but-undefined key throws —
  // and digest is undefined for every purely client-side error, i.e. the
  // common path. Omitting the key is the only shape that survives.
  it("rejects a present-but-undefined property, but accepts the key omitted", () => {
    expect(() =>
      assertSafeEventProperties({
        area: "global",
        code: "ROUTE_RENDER_FAILED",
        recoverable: true,
        digest: undefined,
      }),
    ).toThrow();

    expect(() =>
      assertSafeEventProperties({
        area: "global",
        code: "ROUTE_RENDER_FAILED",
        recoverable: true,
      }),
    ).not.toThrow();
  });
});
