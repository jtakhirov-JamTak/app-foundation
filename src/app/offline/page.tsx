export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center p-5" data-safe-shell>
      <section className="card max-w-md p-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Offline
        </p>
        <h1 className="mt-2 text-2xl font-bold">The safe shell is available</h1>
        <p className="mt-3 leading-6 text-[var(--text-muted)]">
          Protected data is never stored by the service worker. Reconnect to verify your session and
          load your information.
        </p>
      </section>
    </main>
  );
}
