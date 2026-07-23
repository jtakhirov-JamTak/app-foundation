import { describe, expect, it } from "vitest";

import { assertSafeEventProperties } from "./privacy";

describe("analytics privacy", () => {
  it("accepts allowlisted scalar properties", () => {
    expect(() =>
      assertSafeEventProperties({
        screen: "home",
        feedback_ms: 42,
        recoverable: true,
      }),
    ).not.toThrow();
  });

  it.each(["email", "free_text", "private_url", "error_message", "stack"])(
    "rejects prohibited key %s",
    (key) => {
      expect(() => assertSafeEventProperties({ [key]: "value" })).toThrow();
    },
  );

  it("rejects nested properties", () => {
    expect(() => assertSafeEventProperties({ context: { id: 1 } })).toThrow();
  });

  it("rejects payloads over 4 KiB", () => {
    expect(() => assertSafeEventProperties({ value: "x".repeat(5000) })).toThrow();
  });
});
