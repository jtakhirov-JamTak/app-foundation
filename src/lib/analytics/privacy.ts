// Mirrors public.analytics_properties_safe in
// supabase/migrations/202607210001_foundation.sql. The SQL constraint is the
// enforcement point; this is the same check at the client and the route. Change
// both together — supabase/tests/001_foundation_rls.sql and privacy.test.ts
// assert the same vectors, so drift fails one of them.
//
// Word boundaries, not bare substrings: every *_name segment is rejected
// (screen_name and error_name included, by design — enumerating the acceptable
// name variants is an unwinnable blocklist), while embedded fragments such as
// subtitle, notes_count and hostname pass.
const PROHIBITED_KEY =
  /^(username|nickname)$|(^|_)(name|email|phone|address|text|prompt|output|title|note|url|token|message|stack|filename|location|health|financial|relationship)(_|$)/i;

export function assertSafeEventProperties(properties: object): void {
  const json = JSON.stringify(properties);
  if (new TextEncoder().encode(json).byteLength > 4096) {
    throw new Error("Analytics properties exceed 4 KiB");
  }

  for (const [key, value] of Object.entries(properties)) {
    if (PROHIBITED_KEY.test(key)) {
      throw new Error(`Prohibited analytics property key: ${key}`);
    }
    // null is rejected here too: jsonb_typeof reports 'null', which the SQL
    // constraint does not count as a scalar.
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      throw new Error(`Analytics property ${key} must be scalar`);
    }
  }
}
