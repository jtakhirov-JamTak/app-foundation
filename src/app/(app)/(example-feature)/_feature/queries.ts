import { fetchJson } from "@/lib/data/fetch-json";

import { exampleListSchema } from "./schemas";

export function fetchExampleRecords() {
  return fetchJson("/api/example-records", exampleListSchema);
}
