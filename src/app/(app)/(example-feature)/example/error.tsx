"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/states/error-state";
import { recordError } from "@/lib/analytics/client";

export default function ExampleError({ reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    void recordError("example", "EXAMPLE_LOAD_FAILED", true);
  }, []);

  return <ErrorState code="EXAMPLE_LOAD_FAILED" onRetry={reset} />;
}
