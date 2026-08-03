import { describe, expect, it } from "vitest";

import { adjacentPrimaryRoute, primaryRouteIndex, PRIMARY_PATHS, PRIMARY_ROUTES } from "./routes";

// Every expectation below is derived from the real exported route set, never from a
// restated copy of it. The version this replaced declared `const routes = ["/", "/settings"]`
// and asserted that literal had length 2 with no duplicates — it never imported the app's
// routes, so it could not fail and asserted nothing (docs/FIX_LOG.md, 2026-08-02).

describe("primary route set", () => {
  it("has no duplicate paths", () => {
    expect(new Set(PRIMARY_PATHS).size).toBe(PRIMARY_PATHS.length);
  });

  it("has no duplicate labels", () => {
    const labels = PRIMARY_ROUTES.map((route) => route.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("starts at the root and every path is absolute", () => {
    expect(PRIMARY_PATHS[0]).toBe("/");
    for (const path of PRIMARY_PATHS) expect(path.startsWith("/")).toBe(true);
  });

  it("holds at least two routes, or swiping has nowhere to go", () => {
    expect(PRIMARY_PATHS.length).toBeGreaterThanOrEqual(2);
  });
});

describe("primaryRouteIndex", () => {
  it("resolves each route to its own index", () => {
    PRIMARY_PATHS.forEach((path, index) => {
      expect(primaryRouteIndex(path)).toBe(index);
    });
  });

  it("matches the root exactly rather than as a prefix", () => {
    const nonRoot = PRIMARY_PATHS.find((path) => path !== "/");
    if (!nonRoot) throw new Error("Expected a non-root primary route");
    expect(primaryRouteIndex(nonRoot)).not.toBe(primaryRouteIndex("/"));
  });

  it("resolves a nested path to its owning route", () => {
    const nonRoot = PRIMARY_PATHS.find((path) => path !== "/");
    if (!nonRoot) throw new Error("Expected a non-root primary route");
    expect(primaryRouteIndex(`${nonRoot}/deeper`)).toBe(primaryRouteIndex(nonRoot));
  });

  it("returns -1 for a path outside the primary set", () => {
    expect(primaryRouteIndex("/not-a-primary-route")).toBe(-1);
  });
});

describe("adjacentPrimaryRoute", () => {
  it("moves forward through the set in declared order", () => {
    PRIMARY_PATHS.forEach((path, index) => {
      const next = PRIMARY_PATHS[index + 1];
      if (!next) return;
      expect(adjacentPrimaryRoute(path, 1)).toBe(next);
    });
  });

  it("moves back through the set in declared order", () => {
    PRIMARY_PATHS.forEach((path, index) => {
      const previous = PRIMARY_PATHS[index - 1];
      if (!previous) return;
      expect(adjacentPrimaryRoute(path, -1)).toBe(previous);
    });
  });

  it("stops at both ends instead of wrapping", () => {
    const first = PRIMARY_PATHS[0];
    const last = PRIMARY_PATHS[PRIMARY_PATHS.length - 1];
    if (!first || !last) throw new Error("Expected a non-empty primary route set");
    expect(adjacentPrimaryRoute(first, -1)).toBeNull();
    expect(adjacentPrimaryRoute(last, 1)).toBeNull();
  });

  it("returns null for a path outside the primary set", () => {
    expect(adjacentPrimaryRoute("/not-a-primary-route", 1)).toBeNull();
  });
});
