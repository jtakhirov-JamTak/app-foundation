import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors/app-error";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  limitUser: vi.fn(),
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/rate-limit", () => ({ limitUser: mocks.limitUser }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

import { POST } from "./route";

function request(body: unknown, origin = "https://app.example") {
  return new Request("https://app.example/api/example-records", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Host: "app.example",
    },
    body: JSON.stringify(body),
  });
}

describe("example records API boundary", () => {
  beforeEach(() => {
    mocks.requireUser.mockReset();
    mocks.limitUser.mockReset();
    mocks.createServerSupabaseClient.mockReset();
    mocks.requireUser.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    mocks.limitUser.mockResolvedValue({ success: true });
  });

  it("rejects cross-origin writes before authentication", async () => {
    const response = await POST(
      request({ title: "Record", idempotency_key: crypto.randomUUID() }, "https://evil.example"),
    );
    expect(response.status).toBe(403);
    expect(mocks.requireUser).not.toHaveBeenCalled();
  });

  it("rejects invalid input", async () => {
    const response = await POST(request({ title: "", idempotency_key: "not-a-uuid" }));
    expect(response.status).toBe(422);
  });

  it("requires an authenticated user", async () => {
    mocks.requireUser.mockRejectedValue(new AppError("UNAUTHENTICATED", 401, false));
    const response = await POST(request({ title: "Record", idempotency_key: crypto.randomUUID() }));
    expect(response.status).toBe(401);
  });

  it("returns a stable sanitized failure", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "private database detail" } }),
    });

    const response = await POST(request({ title: "Record", idempotency_key: crypto.randomUUID() }));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("EXAMPLE_SAVE_FAILED");
    expect(JSON.stringify(body)).not.toContain("private database detail");
  });

  it("creates through the idempotent database function", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          user_id: "11111111-1111-4111-8111-111111111111",
          title: "Record",
          idempotency_key: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          created_at: "2026-07-21T00:00:00.000Z",
          updated_at: "2026-07-21T00:00:00.000Z",
          archived_at: null,
        },
      ],
      error: null,
    });
    mocks.createServerSupabaseClient.mockResolvedValue({ rpc });

    const response = await POST(
      request({
        title: "Record",
        idempotency_key: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    );

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("create_example_record", {
      p_title: "Record",
      p_idempotency_key: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
  });
});
