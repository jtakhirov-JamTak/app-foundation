import { describe, expect, it } from "vitest";

import { screenFromPath } from "./screen-registry";

describe("screenFromPath", () => {
  it("resolves a registered prefix", () => {
    expect(screenFromPath("/settings")).toBe("settings");
    expect(screenFromPath("/settings/notifications")).toBe("settings");
  });

  it("matches the root only exactly", () => {
    expect(screenFromPath("/")).toBe("home");
  });

  it("throws outside production rather than mislabelling an unregistered path", () => {
    expect(() => screenFromPath("/not-a-screen")).toThrow(
      "Unregistered screen path: /not-a-screen",
    );
  });
});
