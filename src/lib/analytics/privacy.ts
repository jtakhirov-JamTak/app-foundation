const PROHIBITED_KEY =
  /(name|email|phone|address|text|prompt|output|title|note|url|token|message|stack|filename|location|health|financial|relationship)/i;

export function assertSafeEventProperties(properties: object): void {
  const json = JSON.stringify(properties);
  if (new TextEncoder().encode(json).byteLength > 4096) {
    throw new Error("Analytics properties exceed 4 KiB");
  }

  for (const [key, value] of Object.entries(properties)) {
    if (PROHIBITED_KEY.test(key)) {
      throw new Error(`Prohibited analytics property key: ${key}`);
    }
    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      throw new Error(`Analytics property ${key} must be scalar`);
    }
  }
}
