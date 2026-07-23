"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { OfflineBanner } from "@/components/states/offline-state";
import { useOnlineStatus } from "@/lib/network/use-online-status";
import { usePrimarySwipe } from "@/lib/navigation/use-primary-swipe";
import { screenFromPath } from "@/lib/analytics/screen-registry";
import {
  markNavigationStart,
  reportNavigationFeedback
} from "@/lib/performance/navigation-metrics";

import { useSession } from "./session-provider";

const PRIMARY_ROUTES = [
  { href: "/", label: "Home" },
  { href: "/settings", label: "Settings" }
] as const;
const PRIMARY_PATHS = PRIMARY_ROUTES.map((route) => route.href);

function NavContent({
  label,
  active,
  destination
}: {
  label: string;
  active: boolean;
  destination: ReturnType<typeof screenFromPath>;
}) {
  const { pending } = useLinkStatus();
  const selected = active || pending;

  useEffect(() => {
    if (pending) reportNavigationFeedback(destination);
  }, [destination, pending]);

  return (
    <span
      className={`flex min-h-14 min-w-24 items-center justify-center rounded-2xl px-4 text-sm font-bold transition-colors duration-150 ${
        selected
          ? "bg-[var(--text)] text-white"
          : "text-[var(--text-muted)]"
      }`}
    >
      {label}
    </span>
  );
}

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const online = useOnlineStatus();
  const mainRef = useRef<HTMLElement | null>(null);
  const swipeHandlers = usePrimarySwipe(pathname, router, PRIMARY_PATHS);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="safe-shell" data-safe-shell>
      <OfflineBanner online={online} />
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center justify-between px-4">
          <span className="text-sm font-bold uppercase tracking-[0.16em]">Application</span>
          {session.status === "authenticated" ? (
            <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold">
              Verified
            </span>
          ) : (
            <span className="skeleton h-7 w-20 rounded-full" aria-hidden="true" />
          )}
        </div>
      </header>

      <main
        ref={mainRef}
        tabIndex={-1}
        className="app-main outline-none"
        style={{ touchAction: "pan-y" }}
        {...swipeHandlers}
      >
        {children}
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-white/95 pb-[var(--safe-area-bottom)] backdrop-blur"
      >
        <div className="mx-auto flex min-h-18 max-w-md items-center justify-around px-3">
          {session.status === "authenticated"
            ? PRIMARY_ROUTES.map((route) => {
                const active =
                  route.href === "/" ? pathname === "/" : pathname.startsWith(route.href);
                return (
                  <Link
                    key={route.href}
                    href={route.href}
                    prefetch
                    className="rounded-2xl"
                    onClick={() =>
                      markNavigationStart(screenFromPath(pathname), screenFromPath(route.href))
                    }
                  >
                    <NavContent
                      label={route.label}
                      active={active}
                      destination={screenFromPath(route.href)}
                    />
                  </Link>
                );
              })
            : PRIMARY_ROUTES.map((route) => (
                <span
                  key={route.href}
                  className="skeleton h-14 w-24 rounded-2xl"
                  aria-hidden="true"
                />
              ))}
        </div>
      </nav>
    </div>
  );
}
