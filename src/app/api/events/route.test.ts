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

const validEvent = {
  event_name: "screen_viewed",
  properties: { screen: "home" },
  platform: "web",
  app_version: "test",
  occurred_at: "2026-07-21T00:00:00.000Z",
};

function request(body: unknown, origin = "https://app.example") {
  return new Request("https://app.example/api/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Host: "app.example",
    },
    body: JSON.stringify(body),
  });
}

describe("events API boundary", () => {
  beforeEach(() => {
    mocks.requireUser.mockReset();
    mocks.limitUser.mockReset();
    mocks.createServerSupabaseClient.mockReset();
    mocks.requireUser.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    mocks.limitUser.mockResolvedValue({ success: true });
  });

  it("rejects a cross-origin event before authentication", async () => {
    const response = await POST(request(validEvent, "https://evil.example"));
    expect(response.status).toBe(403);
    expect(mocks.requireUser).not.toHaveBeenCalled();
  });

  it("rejects sensitive property keys", async () => {
    const response = await POST(
      request({ ...validEvent, properties: { email: "private@example.invalid" } }),
    );
    expect(response.status).toBe(422);
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("requires an authenticated user", async () => {
    mocks.requireUser.mockRejectedValue(new AppError("UNAUTHENTICATED", 401, false));
    const response = await POST(request(validEvent));
    expect(response.status).toBe(401);
  });

  it("derives event ownership from the verified session", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    mocks.createServerSupabaseClient.mockResolvedValue({ from });

    const response = await POST(request(validEvent));

    expect(response.status).toBe(204);
    expect(from).toHaveBeenCalledWith("events");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "11111111-1111-4111-8111-111111111111",
        event_name: "screen_viewed",
      }),
    );
  });

  it("sanitizes database failures", async () => {
    const insert = vi.fn().mockResolvedValue({
      error: { code: "XX000", message: "private database detail" },
    });
    mocks.createServerSupabaseClient.mockResolvedValue({
      from: vi.fn().mockReturnValue({ insert }),
    });

    const response = await POST(request(validEvent));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("EVENT_WRITE_FAILED");
    expect(JSON.stringify(body)).not.toContain("private database detail");
  });
});
