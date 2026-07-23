"use client";

import type { Route } from "next";

export type NavigationRouter = {
  push: (href: Route) => void;
  prefetch: (href: Route) => void;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

export function navigate(router: NavigationRouter, href: Route): void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const documentWithTransition = document as ViewTransitionDocument;

  if (!reduced && documentWithTransition.startViewTransition) {
    documentWithTransition.startViewTransition(() => router.push(href));
    return;
  }

  router.push(href);
}
