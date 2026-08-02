"use client";

import type { ErrorArea, ErrorCode, EventName, EventProperties, ScreenName } from "./catalog";
import { assertSafeEventProperties } from "./privacy";
import { clientEnv } from "@/lib/env/client";

let identifiedUserId: string | null = null;
let currentScreen: ScreenName | null = null;

function platform(): "web" | "pwa" {
  if (typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches) {
    return "pwa";
  }
  return "web";
}

export function identifyUser(userId: string): void {
  identifiedUserId = userId;
}

export function resetUser(): void {
  identifiedUserId = null;
  currentScreen = null;
}

export async function trackEvent<TName extends EventName>(
  eventName: TName,
  properties: EventProperties[TName],
): Promise<boolean> {
  if (!identifiedUserId || typeof window === "undefined") return false;
  assertSafeEventProperties(properties);

  try {
    const response = await fetch("/api/events", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        event_name: eventName,
        properties,
        occurred_at: new Date().toISOString(),
        platform: platform(),
        app_version: clientEnv.NEXT_PUBLIC_APP_VERSION,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function trackScreen(screen: ScreenName): Promise<boolean> {
  const previous = currentScreen;
  currentScreen = screen;
  return trackEvent("screen_viewed", {
    screen,
    ...(previous && previous !== screen ? { referrer_screen: previous } : {}),
  });
}

export async function recordError(
  area: ErrorArea,
  code: ErrorCode,
  recoverable: boolean,
  digest?: string,
): Promise<boolean> {
  // Spread, never a bare `digest,` — assertSafeEventProperties rejects
  // undefined values as non-scalar, and digest is undefined for every
  // client-side error, which would throw on the common path.
  return trackEvent("app_error_recorded", {
    area,
    code,
    recoverable,
    ...(digest ? { digest } : {}),
  });
}
