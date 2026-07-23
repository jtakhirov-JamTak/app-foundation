"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const credentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
});

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [status, setStatus] = useState<"idle" | "pending" | "error" | "success">("idle");
  const [message, setMessage] = useState<string | null>(() =>
    searchParams.get("error") === "confirmation"
      ? "The confirmation link was invalid or expired. Request a new one."
      : null,
  );

  async function submit(formData: FormData) {
    const parsed = credentialsSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      setStatus("error");
      setMessage("Enter a valid email and a password of at least eight characters.");
      return;
    }

    setStatus("pending");
    setMessage(null);

    const supabase = createBrowserSupabaseClient();
    const result =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword(parsed.data)
        : await supabase.auth.signUp(parsed.data);

    if (result.error) {
      setStatus("error");
      setMessage("Authentication failed. Check your details and try again.");
      return;
    }

    if (mode === "sign-up" && !result.data.session) {
      setStatus("success");
      setMessage("Check your email to confirm the account, then sign in.");
      return;
    }

    router.replace(safeNextPath(searchParams.get("next")) as Route);
    router.refresh();
  }

  return (
    <form action={submit} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-semibold">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 min-h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3"
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Password</span>
        <input
          name="password"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          minLength={8}
          required
          className="mt-1 min-h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3"
        />
      </label>

      {message ? (
        <p
          role={status === "error" ? "alert" : "status"}
          className={`text-sm ${status === "error" ? "text-[var(--danger)]" : "text-[var(--success)]"}`}
        >
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "pending"}
        className="min-h-12 w-full rounded-full bg-[var(--accent)] px-5 font-bold text-white disabled:opacity-60"
      >
        {status === "pending" ? "Working…" : mode === "sign-in" ? "Sign in" : "Create account"}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode((value) => (value === "sign-in" ? "sign-up" : "sign-in"));
          setStatus("idle");
          setMessage(null);
        }}
        className="min-h-11 w-full rounded-full px-4 text-sm font-semibold text-[var(--accent)]"
      >
        {mode === "sign-in" ? "Create an account" : "Use an existing account"}
      </button>
    </form>
  );
}
