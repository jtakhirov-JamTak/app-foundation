import type { Metadata } from "next";
import { Suspense } from "react";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in"
};

export const dynamic = "force-static";

export default function SignInPage() {
  return (
    <main className="grid min-h-dvh place-items-center p-5">
      <section className="card w-full max-w-md p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Secure access
        </p>
        <h1 className="mt-2 text-2xl font-bold">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          The application shell contains no protected information. Your data loads only after the
          server verifies this session.
        </p>
        <Suspense
          fallback={<div className="skeleton mt-6 h-64 w-full rounded-2xl" aria-hidden="true" />}
        >
          <SignInForm />
        </Suspense>
      </section>
    </main>
  );
}
