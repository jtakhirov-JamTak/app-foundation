export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
    readonly recoverable = false,
  ) {
    super(code);
    this.name = "HttpError";
  }
}
