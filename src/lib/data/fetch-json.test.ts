import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { fetchJson } from "./fetch-json";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchJson", () => {
  it("validates successful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ value: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }))
    );

    await expect(fetchJson("/api/test", z.object({ value: z.number() }))).resolves.toEqual({
      value: 1
    });
  });

  it("maps stable API errors without exposing server details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(
        JSON.stringify({
          error: { code: "UNAUTHENTICATED", request_id: "request-1", recoverable: false }
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ))
    );

    await expect(fetchJson("/api/test", z.object({ value: z.number() }))).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
      requestId: "request-1"
    });
  });
});
