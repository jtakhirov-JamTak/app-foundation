import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient
}));

import { GET } from "./route";

describe("session API", () => {
  beforeEach(() => {
    mocks.createServerSupabaseClient.mockReset();
  });

  it("returns the verified subject only", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: "11111111-1111-4111-8111-111111111111", email: "private@example.invalid" } },
          error: null
        })
      }
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      authenticated: true,
      user: { id: "11111111-1111-4111-8111-111111111111" }
    });
    expect(JSON.stringify(body)).not.toContain("private@example.invalid");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 401 when no authenticated subject exists", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: {} }, error: null }) }
    });

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("keeps transient verification failures distinct from logout", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "private provider detail" }
        })
      }
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ authenticated: false });
    expect(JSON.stringify(body)).not.toContain("private provider detail");
  });
});
