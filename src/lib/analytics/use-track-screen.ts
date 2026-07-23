"use client";

import { useEffect } from "react";

import type { ScreenName } from "./catalog";
import { trackScreen } from "./client";
import { useSession } from "@/components/app-shell/session-provider";

export function useTrackScreen(screen: ScreenName): void {
  const session = useSession();

  useEffect(() => {
    if (session.status === "authenticated") {
      void trackScreen(screen);
    }
  }, [screen, session.status]);
}
