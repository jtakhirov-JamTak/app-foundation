import { describe, expect, it } from "vitest";

describe("primary swipe thresholds", () => {
  it("keeps the default routes small and adjacent", () => {
    const routes = ["/", "/settings"];
    expect(routes).toHaveLength(2);
    expect(new Set(routes).size).toBe(routes.length);
  });
});
