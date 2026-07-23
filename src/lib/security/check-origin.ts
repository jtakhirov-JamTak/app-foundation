/**
 * Fail-closed CSRF origin check adapted from the audited fail-closed pattern.
 * Sec-Fetch-Site is primary; Origin/Host equality is the compatibility fallback.
 */
export function checkOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
