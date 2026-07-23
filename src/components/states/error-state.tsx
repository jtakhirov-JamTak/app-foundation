"use client";

export function ErrorState({
  code,
  message = "The request could not be completed.",
  requestId,
  onRetry
}: {
  code: string;
  message?: string;
  requestId?: string;
  onRetry?: () => void;
}) {
  return (
    <section role="alert" className="card border-[color-mix(in_srgb,var(--danger)_28%,white)] p-5">
      <h2 className="text-lg font-bold">Something went wrong</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{message}</p>
      <p className="mt-3 font-mono text-xs text-[var(--text-muted)]">
        {code}
        {requestId ? ` · ${requestId}` : ""}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-11 rounded-full bg-[var(--text)] px-5 font-bold text-white"
        >
          Try again
        </button>
      ) : null}
    </section>
  );
}
