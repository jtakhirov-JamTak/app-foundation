import { fetchJson } from "@/lib/data/fetch-json";

import { createExampleResponseSchema } from "./schemas";

export function createExampleRecord(input: { title: string; idempotency_key: string }) {
  return fetchJson("/api/example-records", createExampleResponseSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}
