"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSWRConfig } from "swr";
import { z } from "zod";

import { identifyUser, resetUser } from "@/lib/analytics/client";
import { clearBackNavigationState } from "@/lib/navigation/use-back-navigation-state";

// Loaded via dynamic import only: a static import would chain @supabase/ssr into
// the shell's first-paint chunks, and nothing here needs it before first render.
const loadSupabaseClient = async () => {
  const { createBrowserSupabaseClient } = await import("@/lib/supabase/client");
  return createBrowserSupabaseClient();
};

const sessionResponseSchema = z.discriminatedUnion("authenticated", [
  z.object({
    authenticated: z.literal(true),
    user: z.object({ id: z.uuid() }),
  }),
  z.object({ authenticated: z.literal(false) }),
]);

type SessionState =
  | { status: "loading"; userId: null }
  | { status: "authenticated"; userId: string }
  | { status: "unauthenticated"; userId: null }
  | { status: "error"; userId: null };

type SessionContextValue = SessionState & {
  verify: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [state, setState] = useState<SessionState>({ status: "loading", userId: null });
  const { cache } = useSWRConfig();
  const router = useRouter();
  const pathname = usePathname();
  const requestSequence = useRef(0);

  const clearProtectedCache = useCallback(() => {
    for (const key of Array.from(cache.keys())) {
      cache.delete(key);
    }
  }, [cache]);

  const verify = useCallback(async () => {
    const sequence = ++requestSequence.current;

    try {
      const response = await fetch("/api/session", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (sequence !== requestSequence.current) return;

      if (response.status === 401) {
        clearProtectedCache();
        resetUser();
        clearBackNavigationState();
        setState({ status: "unauthenticated", userId: null });
        return;
      }

      if (!response.ok) {
        setState({ status: "error", userId: null });
        return;
      }

      const parsed = sessionResponseSchema.safeParse(await response.json());
      if (!parsed.success || !parsed.data.authenticated) {
        clearProtectedCache();
        resetUser();
        clearBackNavigationState();
        setState({ status: "unauthenticated", userId: null });
        return;
      }

      identifyUser(parsed.data.user.id);
      setState({ status: "authenticated", userId: parsed.data.user.id });
    } catch {
      if (sequence === requestSequence.current) {
        setState({ status: "error", userId: null });
      }
    }
  }, [clearProtectedCache]);

  useEffect(() => {
    // Deferred to a microtask so the effect body never sets state synchronously;
    // verify() is async, so its setState timing is unchanged.
    queueMicrotask(() => void verify());

    const onFocus = () => void verify();
    const onOnline = () => void verify();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    let disposed = false;
    let subscription: { unsubscribe: () => void } | null = null;
    void loadSupabaseClient().then((supabase) => {
      if (disposed) return;
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") {
          void verify();
        }
      });
      subscription = data.subscription;
    });

    return () => {
      disposed = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      subscription?.unsubscribe();
    };
  }, [verify]);

  const signOut = useCallback(async () => {
    const supabase = await loadSupabaseClient();
    await supabase.auth.signOut();
    clearProtectedCache();
    resetUser();
    clearBackNavigationState();
    setState({ status: "unauthenticated", userId: null });
    const next = encodeURIComponent(pathname || "/");
    router.replace(`/sign-in?next=${next}` as Route);
    router.refresh();
  }, [clearProtectedCache, pathname, router]);

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, verify, signOut }),
    [signOut, state, verify],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
