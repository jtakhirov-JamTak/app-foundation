import { NextResponse } from "next/server";

import { createExampleInputSchema } from "../../_feature/schemas";
import { requireUser } from "@/lib/auth/require-user";
import { apiError, apiErrorFromUnknown, requestId } from "@/lib/errors/http";
import { limitUser } from "@/lib/rate-limit";
import { checkOrigin } from "@/lib/security/check-origin";
import { InvalidJsonBody, readJsonBody } from "@/lib/security/read-json";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = requestId();

  if (!checkOrigin(request)) return apiError("ORIGIN_REJECTED", 403, false, id);

  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch (error) {
    return apiErrorFromUnknown(error, id);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("example_records")
    .select("id,title,created_at")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return apiError("EXAMPLE_LOAD_FAILED", 503, true, id);

  return NextResponse.json({ records: data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const id = requestId();

  if (!checkOrigin(request)) return apiError("ORIGIN_REJECTED", 403, false, id);

  let json: unknown;
  try {
    json = await readJsonBody(request);
  } catch (error) {
    const status = error instanceof InvalidJsonBody ? error.status : 400;
    return apiError("INVALID_JSON_BODY", status, false, id);
  }

  const parsed = createExampleInputSchema.safeParse(json);
  if (!parsed.success) return apiError("INVALID_EXAMPLE_RECORD", 422, false, id);

  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch (error) {
    return apiErrorFromUnknown(error, id);
  }

  const rate = await limitUser(`example-create:${user.id}`, 20, "1 m");
  if (!rate.success) {
    return rate.reason === "unavailable"
      ? apiError("RATE_LIMIT_UNAVAILABLE", 503, true, id)
      : apiError("RATE_LIMITED", 429, true, id);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_example_record", {
    p_title: parsed.data.title,
    p_idempotency_key: parsed.data.idempotency_key,
  });

  const record = data?.[0];
  if (error || !record) return apiError("EXAMPLE_SAVE_FAILED", 503, true, id);

  return NextResponse.json(
    {
      record: {
        id: record.id,
        title: record.title,
        created_at: record.created_at,
      },
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
