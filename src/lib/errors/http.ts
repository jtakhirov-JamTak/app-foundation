import { NextResponse } from "next/server";

import { AppError } from "./app-error";

export function requestId(): string {
  return crypto.randomUUID();
}

export function apiError(code: string, status: number, recoverable: boolean, id: string) {
  return NextResponse.json(
    {
      error: {
        code,
        request_id: id,
        recoverable,
      },
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export function apiErrorFromUnknown(error: unknown, id: string) {
  const isAppError = error instanceof AppError;
  const code = isAppError ? error.code : "INTERNAL_ERROR";
  const status = isAppError ? error.status : 500;
  const recoverable = isAppError ? error.recoverable : true;

  // Server failures only. Expected client outcomes (401/403/422/429 — every
  // UNAUTHENTICATED rejection) stay silent: that is noise, not signal.
  //
  // Controlled fields ONLY. There is deliberately no message field: vendor and
  // Postgres messages embed user data (playbook §6). If a message is ever
  // needed it enters through an explicit safe field — an optional
  // `safeLogMessage` that a caller consciously populates with a string it owns
  // — never `error.message`. Do not add that field speculatively.
  if (status >= 500) {
    const line = JSON.stringify({
      level: code === "SESSION_UNAVAILABLE" ? "warn" : "error",
      request_id: id,
      code,
      error_type: error instanceof Error ? error.name : "unknown",
    });
    if (code === "SESSION_UNAVAILABLE") {
      // Warn, not error: this code conflates two conditions. A single
      // SESSION_UNAVAILABLE is an expired session — expected, and the common
      // case, because supabase-js reports an expired refresh token as an error
      // rather than as an absent session. A sustained spike across many
      // distinct request_ids is instead a probable auth-service outage.
      // Splitting it into two codes is out of scope here; it is a candidate for
      // app #2's observability work, where an error sink can aggregate
      // warn-rate instead of relying on per-line severity.
      console.warn(line);
    } else {
      console.error(line);
    }
  }

  return apiError(code, status, recoverable, id);
}
