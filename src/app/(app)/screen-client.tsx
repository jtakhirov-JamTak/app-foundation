"use client";

import { AuthBoundary } from "@/components/app-shell/auth-boundary";
import { useTrackScreen } from "@/lib/analytics/use-track-screen";

export function HomeScreen() {
  useTrackScreen("home");

  return (
    <AuthBoundary>
      <section className="space-y-4">
        <div className="card p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Foundation
          </p>
          <h1 className="mt-2 text-2xl font-bold">The protected shell is ready</h1>
          <p className="mt-3 leading-6 text-[var(--text-muted)]">
            This content appears only after server-side session verification. The shell, geometry,
            and safe loading state appeared first.
          </p>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-bold">Foundation status</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Authentication, stale-while-revalidate data access, private analytics, offline-safe
            shell caching, and mobile navigation are available for the first product feature.
          </p>
        </div>
      </section>
    </AuthBoundary>
  );
}
