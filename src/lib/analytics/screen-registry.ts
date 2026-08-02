import type { ScreenName } from "./catalog";

// Longest prefix wins, so the sort is what makes "/settings" beat "/". Sorting
// here rather than relying on declaration order means a screen can be added
// anywhere in the list without silently changing which path it claims.
const paths: readonly (readonly [string, ScreenName])[] = (
  [
    ["/settings", "settings"],
    ["/", "home"],
    // EXAMPLE-ONLY: delete with src/app/(app)/(example-feature)
    ["/example", "example"],
    // END EXAMPLE-ONLY
  ] satisfies (readonly [string, ScreenName])[]
).sort((left, right) => right[0].length - left[0].length);

export function screenFromPath(pathname: string): ScreenName {
  for (const [prefix, screen] of paths) {
    if (prefix === "/" ? pathname === "/" : pathname.startsWith(prefix)) return screen;
  }

  // A silent fallback attributes one screen's analytics to another, which stays
  // invisible until the data is already wrong. Fail loudly in development and
  // tests; in production keep the shell rendering and label the gap instead.
  if (process.env.NODE_ENV !== "production") {
    throw new Error(`Unregistered screen path: ${pathname}`);
  }
  return "unregistered";
}
