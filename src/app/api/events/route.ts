import { NextResponse } from "next/server";

import { assertSafeEventProperties } from "@/lib/analytics/privacy";
import { eventRequestSchema } from "@/lib/analytics/schemas";
import { checkOrigin } from "@/lib/security/check-origin";
import { InvalidJsonBody, readJsonBody } from "@/lib/security/read-json";
import { apiError, apiErrorFromUnknown, requestId } from "@/lib/errors/http";
import { limitUser } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth/require-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const id = requestId();

  if (!checkOrigin(request)) {
    return apiError("ORIGIN_REJECTED", 403, false, id);
  }

  let json: unknown;
  try {
    json = await readJsonBody(request);
  } catch (error) {
    const status = error instanceof InvalidJsonBody ? error.status : 400;
    return apiError("INVALID_JSON_BODY", status, false, id);
  }

  const parsed = eventRequestSchema.safeParse(json);
  if (!parsed.success) {
    return apiError("INVALID_EVENT", 422, false, id);
  }

  try {
    assertSafeEventProperties(parsed.data.properties);
  } catch {
    return apiError("INVALID_EVENT_PROPERTIES", 422, false, id);
  }

  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch (error) {
    return apiErrorFromUnknown(error, id);
  }

  const rate = await limitUser(`events:${user.id}`, 120, "1 m");
  if (!rate.success) {
    return rate.reason === "unavailable"
      ? apiError("RATE_LIMIT_UNAVAILABLE", 503, true, id)
      : apiError("RATE_LIMITED", 429, true, id);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("events").insert({
    user_id: user.id,
    event_name: parsed.data.event_name,
    properties: parsed.data.properties,
    platform: parsed.data.platform,
    app_version: parsed.data.app_version,
    occurred_at: parsed.data.occurred_at
  });

  if (error) {
    if (error.code === "23514") {
      return apiError("INVALID_EVENT", 422, false, id);
    }
    return apiError("EVENT_WRITE_FAILED", 503, true, id);
  }

  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
