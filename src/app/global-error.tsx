"use client";

import { useEffect } from "react";

import { recordError } from "@/lib/analytics/client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void recordError("global", "UNHANDLED_APPLICATION_ERROR", true);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Something went wrong</title>
      </head>
      <body style={{ margin: 0, background: "#f7f7f5", color: "#171716" }}>
        <main
          style={{
            minHeight: "100dvh",
            display: "grid",
            placeItems: "center",
            padding: "1.25rem",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <section style={{ maxWidth: "28rem", textAlign: "center" }}>
            <p aria-hidden="true" style={{ fontSize: "3rem", margin: 0 }}>
              !
            </p>
            <h1 style={{ fontSize: "1.25rem", margin: "1rem 0 0" }}>Something went wrong</h1>
            <p style={{ color: "#65655f", lineHeight: 1.5 }}>
              Try again. No private error details were shown or logged.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: "3rem",
                border: 0,
                borderRadius: "999px",
                padding: "0 1.25rem",
                background: "#2656d8",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              Try again
            </button>
            <p>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional hard reload: client-side routing may be broken inside the global error boundary */}
              <a href="/" style={{ color: "#2656d8" }}>
                Return home
              </a>
            </p>
          </section>
        </main>
      </body>
    </html>
  );
}
