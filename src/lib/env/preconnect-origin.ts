// The hermetic-test Supabase host. Builds that use it (Playwright's webServer
// fallback, `verify-sw-version-bust`, `verify-example-removal`) never talk to a
// real Supabase, so the host does not resolve.
export const PLACEHOLDER_SUPABASE_HOST = "example.supabase.co";

// Returns the origin worth preconnecting to, or null when warming it would be
// wasted: a local stack needs no DNS/TLS handshake, and the placeholder host
// opens a connection the real request can never reuse.
//
// Matches on `hostname` rather than the whole URL so the port and any path are
// ignored — `.env.example` ships `http://127.0.0.1:54321`.
export function preconnectOrigin(url: string): string | null {
  const { origin, hostname } = new URL(url);

  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
    return null;
  }
  if (hostname === PLACEHOLDER_SUPABASE_HOST) {
    return null;
  }

  return origin;
}
