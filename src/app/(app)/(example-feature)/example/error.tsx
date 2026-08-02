"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/states/error-state";
import { recordError } from "@/lib/analytics/client";

export default function ExampleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void recordError("example", "EXAMPLE_LOAD_FAILED", true, error.digest);
  }, [error.digest]);

  return <ErrorState code="EXAMPLE_LOAD_FAILED" onRetry={reset} />;
}
