import type { z } from "zod";

import { HttpError } from "./http-error";

const errorEnvelopeSchema = {
  safeParse(value: unknown) {
    if (
      typeof value === "object" &&
      value !== null &&
      "error" in value &&
      typeof value.error === "object" &&
      value.error !== null &&
      "code" in value.error &&
      typeof value.error.code === "string"
    ) {
      const error = value.error as {
        code: string;
        request_id?: string;
        recoverable?: boolean;
      };
      return { success: true as const, data: error };
    }
    return { success: false as const };
  }
};

export async function fetchJson<TSchema extends z.ZodType>(
  input: RequestInfo | URL,
  schema: TSchema,
  init?: RequestInit
): Promise<z.infer<TSchema>> {
  const response = await fetch(input, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: { Accept: "application/json", ...init?.headers }
  });

  const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = errorEnvelopeSchema.safeParse(payload);
    throw new HttpError(
      response.status,
      parsedError.success ? parsedError.data.code : "REQUEST_FAILED",
      parsedError.success ? parsedError.data.request_id : undefined,
      parsedError.success ? Boolean(parsedError.data.recoverable) : false
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError(502, "INVALID_SERVER_RESPONSE");
  }

  return parsed.data;
}
