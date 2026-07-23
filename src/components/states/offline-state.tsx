"use client";

export function OfflineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 bg-[var(--text)] px-3 py-1 text-center text-xs font-bold text-white"
    >
      Offline — protected data is not stored on this device
    </div>
  );
}

export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <section className="card p-5 text-center">
      <h2 className="text-lg font-bold">You are offline</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
        The safe shell remains available, but protected information requires a verified connection.
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-11 rounded-full border border-[var(--border)] px-5 font-bold"
        >
          Retry
        </button>
      ) : null}
    </section>
  );
}
