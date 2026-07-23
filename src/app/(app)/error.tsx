"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/states/error-state";
import { recordError } from "@/lib/analytics/client";

export default function ProtectedRouteError({
  error: _error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void recordError("protected_route", "ROUTE_RENDER_FAILED", true);
  }, []);

  return <ErrorState code="ROUTE_RENDER_FAILED" onRetry={reset} />;
}
