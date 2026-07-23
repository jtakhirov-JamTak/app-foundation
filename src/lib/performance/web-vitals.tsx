"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { Metric } from "web-vitals";

import { useSession } from "@/components/app-shell/session-provider";
import type { NavigationType } from "@/lib/analytics/catalog";
import { trackEvent } from "@/lib/analytics/client";
import { screenFromPath } from "@/lib/analytics/screen-registry";

function navigationType(value: Metric["navigationType"]): NavigationType {
  if (value === "reload") return "reload";
  if (value === "back-forward" || value === "back-forward-cache") return "back-forward";
  if (value === "prerender") return "prerender";
  return "navigate";
}

export function WebVitalsReporter() {
  const session = useSession();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const registered = useRef(false);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (session.status !== "authenticated" || registered.current) return;
    registered.current = true;

    const report = (metric: Metric) => {
      if (metric.name !== "LCP" && metric.name !== "INP" && metric.name !== "CLS") return;
      void trackEvent("web_vital_recorded", {
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        navigation_type: navigationType(metric.navigationType),
        screen: screenFromPath(pathnameRef.current)
      });
    };

    void import("web-vitals").then(({ onCLS, onINP, onLCP }) => {
      onLCP(report);
      onINP(report);
      onCLS(report);
    });
  }, [session.status]);

  return null;
}
