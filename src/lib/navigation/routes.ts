import type { Route } from "next";

// The primary route set — the single source of truth. The app shell renders it, the
// swipe handler orders by it, and the gates derive their expectations from it instead
// of restating them. Adding a route here must never require editing a test: two blind
// scaffold tests each had to edit two foundation e2e specs to add one route, which is
// how a template teaches derived apps to edit the gates (docs/FIX_LOG.md, 2026-08-02).
//
// Deliberately free of runtime imports. The app shell is a client component pulling in
// next/link and next/navigation; vitest runs in a node environment with no React
// renderer, and Playwright specs import this too, so anything heavier than constants
// here would break both consumers.
export const PRIMARY_ROUTES = [
  { href: "/", label: "Home" },
  { href: "/settings", label: "Settings" },
] as const;

export const PRIMARY_PATHS: readonly Route[] = PRIMARY_ROUTES.map((route) => route.href);

// Which primary route owns a pathname, or -1. "/" matches only itself; every other
// route also owns its subtree, so /settings/notifications still resolves to /settings.
export function primaryRouteIndex(
  pathname: string,
  routes: readonly Route[] = PRIMARY_PATHS,
): number {
  return routes.findIndex((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route),
  );
}

// The route a swipe lands on: direction 1 is forward (swipe left), -1 is back. Returns
// null at either end of the set, and for a pathname outside it.
export function adjacentPrimaryRoute(
  pathname: string,
  direction: 1 | -1,
  routes: readonly Route[] = PRIMARY_PATHS,
): Route | null {
  const index = primaryRouteIndex(pathname, routes);
  if (index < 0) return null;
  return routes[index + direction] ?? null;
}
