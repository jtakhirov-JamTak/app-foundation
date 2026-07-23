"use client";

import { AuthBoundary } from "@/components/app-shell/auth-boundary";
import { useSession } from "@/components/app-shell/session-provider";
import { useTrackScreen } from "@/lib/analytics/use-track-screen";

export function SettingsScreen() {
  const { signOut } = useSession();
  useTrackScreen("settings");

  return (
    <AuthBoundary>
      <section className="card p-5">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Signing out clears the authenticated identity and all in-memory protected data.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-5 min-h-12 rounded-full border border-[var(--border)] px-5 font-bold"
        >
          Sign out
        </button>
      </section>
    </AuthBoundary>
  );
}
