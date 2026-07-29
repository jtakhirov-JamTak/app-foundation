import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { clientEnv } from "@/lib/env/client";

import "./globals.css";

// Every client-side Supabase call is behind a dynamic import (session-provider's
// auth listener and sign-out, the sign-in form's submit), so the browser only
// learns this origin exists late. Warming DNS/TLS at first paint moves that
// handshake off the critical path of the first auth request.
// `crossOrigin="anonymous"` matches how supabase-js fetches: CORS, no cookies —
// a mismatched mode would open a connection the real request cannot reuse.
const supabaseOrigin = new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).origin;

export const metadata: Metadata = {
  title: {
    default: "Application",
    template: "%s · Application",
  },
  description: "Mobile-first application foundation",
  applicationName: "Application",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f7f5",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
