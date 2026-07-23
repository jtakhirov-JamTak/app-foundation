import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requireUser(): Promise<{ id: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  const id = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (error) {
    throw new AppError("SESSION_UNAVAILABLE", 503, true, error);
  }

  if (!id) {
    throw new AppError("UNAUTHENTICATED", 401, false);
  }

  return { id };
}
