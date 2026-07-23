export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly recoverable: boolean,
    override readonly cause?: unknown,
  ) {
    super(code);
    this.name = "AppError";
  }
}
