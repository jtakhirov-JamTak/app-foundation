export class InvalidJsonBody extends Error {
  constructor(readonly status: 400 | 413 | 415) {
    super("INVALID_JSON_BODY");
    this.name = "InvalidJsonBody";
  }
}

export async function readJsonBody(request: Request, maxBytes = 8_192): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== "application/json") {
    throw new InvalidJsonBody(415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new InvalidJsonBody(413);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new InvalidJsonBody(413);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new InvalidJsonBody(400);
  }
}
