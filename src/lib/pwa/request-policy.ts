export function isSensitiveRequest(url: URL, request: Request, appOrigin: string): boolean {
  if (request.method !== "GET") return true;
  if (url.origin === appOrigin && url.pathname.startsWith("/api/")) return true;
  if (url.pathname.startsWith("/auth/") || url.pathname.startsWith("/sign-in")) return true;
  if (url.hostname.endsWith(".supabase.co")) return true;
  return false;
}
