"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { SWRConfig } from "swr";

import { HttpError } from "@/lib/data/http-error";
import { WebVitalsReporter } from "@/lib/performance/web-vitals";

import { SessionProvider } from "./session-provider";

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  const cache = useMemo(() => new Map(), []);

  return (
    <SWRConfig
      value={{
        provider: () => cache,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 2_000,
        errorRetryCount: 2,
        onErrorRetry(error, _key, _config, revalidate, context) {
          if (
            error instanceof HttpError &&
            [401, 403, 404, 422].includes(error.status)
          ) {
            return;
          }
          if (context.retryCount >= 2) return;
          const delay = Math.min(1_000 * 2 ** context.retryCount, 4_000) + Math.random() * 250;
          setTimeout(() => void revalidate({ retryCount: context.retryCount + 1 }), delay);
        }
      }}
    >
      <SessionProvider>
        <WebVitalsReporter />
        {children}
      </SessionProvider>
    </SWRConfig>
  );
}
