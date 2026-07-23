import { describe, expect, it } from "vitest";

import { checkOrigin } from "./check-origin";

describe("checkOrigin", () => {
  it("accepts same-origin fetch metadata", () => {
    expect(
      checkOrigin(new Request("https://app.example/api/x", {
        headers: { "sec-fetch-site": "same-origin" }
      }))
    ).toBe(true);
  });

  it("rejects cross-site fetch metadata", () => {
    expect(
      checkOrigin(new Request("https://app.example/api/x", {
        headers: { "sec-fetch-site": "cross-site" }
      }))
    ).toBe(false);
  });

  it("uses matching origin and host as a fallback", () => {
    expect(
      checkOrigin(new Request("https://app.example/api/x", {
        headers: { origin: "https://app.example", host: "app.example" }
      }))
    ).toBe(true);
  });

  it("fails closed when signals are absent", () => {
    expect(checkOrigin(new Request("https://app.example/api/x"))).toBe(false);
  });
});
