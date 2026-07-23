import { describe, expect, it } from "vitest";

import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example"])(
    "rejects unsafe redirect %s",
    (value) => {
      expect(safeNextPath(value)).toBe("/");
    },
  );

  it("keeps an internal path", () => {
    expect(safeNextPath("/settings?tab=account")).toBe("/settings?tab=account");
  });
});
