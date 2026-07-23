import { describe, expect, it } from "vitest";

import { clearBackNavigationState } from "./use-back-navigation-state";

describe("back-navigation state", () => {
  it("can be cleared at an authentication boundary", () => {
    expect(() => clearBackNavigationState()).not.toThrow();
  });
});
