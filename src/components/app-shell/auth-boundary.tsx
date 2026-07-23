"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { ErrorState } from "@/components/states/error-state";
import { OfflineState } from "@/components/states/offline-state";
import { ScreenSkeleton } from "@/components/states/loading-skeleton";

import { useSession } from "./session-provider";

export function AuthBoundary({ children }: Readonly<{ children: ReactNode }>) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (session.status === "unauthenticated") {
      router.replace(`/sign-in?next=${encodeURIComponent(pathname || "/")}` as Route);
    }
  }, [pathname, router, session.status]);

  if (session.status === "loading" || session.status === "unauthenticated") {
    return <ScreenSkeleton />;
  }

  if (session.status === "error") {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return <OfflineState onRetry={() => void session.verify()} />;
    }
    return (
      <ErrorState
        code="SESSION_UNAVAILABLE"
        message="Your session could not be verified."
        onRetry={() => void session.verify()}
      />
    );
  }

  return children;
}
