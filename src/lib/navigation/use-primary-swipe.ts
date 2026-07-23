"use client";

import type { PointerEventHandler } from "react";
import { useMemo, useRef } from "react";
import type { Route } from "next";

import { screenFromPath } from "@/lib/analytics/screen-registry";
import {
  markNavigationStart,
  reportNavigationFeedback
} from "@/lib/performance/navigation-metrics";

import { navigate, type NavigationRouter } from "./view-transition";

const MIN_DISTANCE = 64;
const DOMINANCE = 1.35;

export function usePrimarySwipe(
  pathname: string,
  router: NavigationRouter,
  routes: readonly string[]
) {
  const start = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const routeIndex = routes.findIndex((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route)
  );

  return useMemo(() => {
    const onPointerDown: PointerEventHandler<HTMLElement> = (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (
        event.target instanceof Element &&
        event.target.closest("a,button,input,textarea,select,[data-no-swipe]")
      ) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      start.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    };

    const onPointerUp: PointerEventHandler<HTMLElement> = (event) => {
      const initial = start.current;
      start.current = null;
      if (!initial || initial.pointerId !== event.pointerId || routeIndex < 0) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const dx = event.clientX - initial.x;
      const dy = event.clientY - initial.y;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * DOMINANCE) return;

      const nextIndex = dx < 0 ? routeIndex + 1 : routeIndex - 1;
      const href = routes[nextIndex];
      if (!href) return;

      router.prefetch(href);
      const from = screenFromPath(pathname);
      const to = screenFromPath(href);
      markNavigationStart(from, to);
      reportNavigationFeedback(to);
      navigate(router, href as Route);
    };

    const onPointerCancel: PointerEventHandler<HTMLElement> = () => {
      start.current = null;
    };

    return { onPointerDown, onPointerUp, onPointerCancel };
  }, [pathname, routeIndex, router, routes]);
}
