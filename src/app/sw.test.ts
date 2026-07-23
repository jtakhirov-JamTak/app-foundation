import { describe, expect, it } from "vitest";

import { isSensitiveRequest } from "@/lib/pwa/request-policy";

const appOrigin = "https://app.example";

function request(url: string, method = "GET") {
  return new Request(url, { method });
}

describe("service-worker routing contract", () => {
  it.each([
    ["https://app.example/api/session", "GET"],
    ["https://project.supabase.co/auth/v1/token", "POST"],
    ["https://app.example/sign-in", "GET"],
    ["https://app.example/anything", "POST"],
  ])("keeps %s network-only", (url: string, method: string) => {
    const value = request(url, method);
    expect(isSensitiveRequest(new URL(url), value, appOrigin)).toBe(true);
  });

  it("does not classify versioned static assets as sensitive", () => {
    const url = "https://app.example/_next/static/chunks/app.js";
    expect(isSensitiveRequest(new URL(url), request(url), appOrigin)).toBe(false);
  });
});
