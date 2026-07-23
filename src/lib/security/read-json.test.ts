import { describe, expect, it } from "vitest";

import { readJsonBody } from "./read-json";

describe("readJsonBody", () => {
  it("parses bounded JSON", async () => {
    const request = new Request("https://app.example/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: 1 }),
    });

    await expect(readJsonBody(request)).resolves.toEqual({ value: 1 });
  });

  it("rejects non-JSON content", async () => {
    const request = new Request("https://app.example/api/test", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "value",
    });

    await expect(readJsonBody(request)).rejects.toMatchObject({
      status: 415,
    });
  });

  it("rejects oversized bodies", async () => {
    const request = new Request("https://app.example/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(100) }),
    });

    await expect(readJsonBody(request, 20)).rejects.toMatchObject({ status: 413 });
  });
});
