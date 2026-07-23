"use client";

import type { ScreenName } from "@/lib/analytics/catalog";
import { trackEvent } from "@/lib/analytics/client";

type PendingNavigation = {
  from: ScreenName;
  to: ScreenName;
  startedAt: number;
};

let pendingNavigation: PendingNavigation | null = null;

export function markNavigationStart(from: ScreenName, to: ScreenName): void {
  if (typeof performance === "undefined") return;
  pendingNavigation = { from, to, startedAt: performance.now() };
}

export function reportNavigationFeedback(to: ScreenName): void {
  if (typeof performance === "undefined") return;
  const pending = pendingNavigation;
  if (!pending || pending.to !== to) return;

  pendingNavigation = null;
  void trackEvent("navigation_feedback_measured", {
    from: pending.from,
    to,
    feedback_ms: Math.max(0, Math.round(performance.now() - pending.startedAt))
  });
}
