import { describe, expect, it } from "vitest";

import { createExampleInputSchema } from "./schemas";

describe("example record input", () => {
  it("trims and validates a title", () => {
    const parsed = createExampleInputSchema.parse({
      title: "  Example  ",
      idempotency_key: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    });
    expect(parsed.title).toBe("Example");
  });

  it("rejects oversized input", () => {
    expect(
      createExampleInputSchema.safeParse({
        title: "x".repeat(121),
        idempotency_key: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      }).success
    ).toBe(false);
  });
});
