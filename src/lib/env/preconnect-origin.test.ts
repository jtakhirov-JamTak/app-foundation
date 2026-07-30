import { describe, expect, it } from "vitest";

import { preconnectOrigin } from "./preconnect-origin";

describe("preconnectOrigin", () => {
  it.each([
    "http://127.0.0.1:54321",
    "http://localhost:54321",
    "http://[::1]:54321",
    "https://example.supabase.co",
    "https://example.supabase.co/rest/v1",
  ])("suppresses the preconnect for %s", (url) => {
    expect(preconnectOrigin(url)).toBeNull();
  });

  it("returns the origin for a real project", () => {
    expect(preconnectOrigin("https://abcdefg.supabase.co")).toBe("https://abcdefg.supabase.co");
  });

  it("strips the path and keeps a non-default port", () => {
    expect(preconnectOrigin("https://abcdefg.supabase.co:8443/rest/v1")).toBe(
      "https://abcdefg.supabase.co:8443",
    );
  });
});
