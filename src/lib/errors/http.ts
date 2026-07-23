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
  if (error instanceof AppError) {
    return apiError(error.code, error.status, error.recoverable, id);
  }
  return apiError("INTERNAL_ERROR", 500, true, id);
}
