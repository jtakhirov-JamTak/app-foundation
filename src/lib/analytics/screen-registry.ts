import type { ScreenName } from "./catalog";

const paths = new Map<string, ScreenName>([
  ["/settings", "settings"],
  ["/", "home"]
]);

export function registerScreenPath(prefix: string, screen: ScreenName): void {
  paths.set(prefix, screen);
}

export function screenFromPath(pathname: string): ScreenName {
  const ordered = [...paths.entries()].sort((left, right) => right[0].length - left[0].length);
  for (const [prefix, screen] of ordered) {
    if (prefix === "/" ? pathname === "/" : pathname.startsWith(prefix)) return screen;
  }
  return "home";
}
