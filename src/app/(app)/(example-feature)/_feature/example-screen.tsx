"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";
import useSWR from "swr";

import { AuthBoundary } from "@/components/app-shell/auth-boundary";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { ScreenSkeleton } from "@/components/states/loading-skeleton";
import { OfflineState } from "@/components/states/offline-state";
import { recordError, trackEvent } from "@/lib/analytics/client";
import { useTrackScreen } from "@/lib/analytics/use-track-screen";
import { HttpError } from "@/lib/data/http-error";
import { useBackNavigationState } from "@/lib/navigation/use-back-navigation-state";
import { useOnlineStatus } from "@/lib/network/use-online-status";

import { exampleRecordsKey } from "./cache-keys";
import { createExampleRecord } from "./mutations";
import { fetchExampleRecords } from "./queries";
import type { ExampleList } from "./schemas";

function ExampleContent() {
  const online = useOnlineStatus();
  const { data, error, isLoading, isValidating, mutate } = useSWR<ExampleList>(
    exampleRecordsKey,
    fetchExampleRecords,
    { keepPreviousData: true },
  );
  const [title, setTitle] = useBackNavigationState("example:new-record-title", "");
  const [saveState, setSaveState] = useState<"idle" | "pending" | "error">("idle");
  const idempotencyKey = useRef<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || saveState === "pending") return;

    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setSaveState("pending");
    const key = idempotencyKey.current ?? crypto.randomUUID();
    idempotencyKey.current = key;

    try {
      const created = await createExampleRecord({
        title: cleanTitle,
        idempotency_key: key,
      });
      await mutate(
        (current) => ({
          records: current
            ? [created.record, ...current.records.filter((item) => item.id !== created.record.id)]
            : [created.record],
        }),
        { revalidate: true },
      );
      setTitle("");
      setSaveState("idle");
      idempotencyKey.current = null;
      void trackEvent("example_record_created", { source: "example_form" });
    } catch {
      setSaveState("error");
      void recordError("example", "EXAMPLE_SAVE_FAILED", true);
    }
  }

  if (isLoading && !data) return <ScreenSkeleton />;

  if (error && !data) {
    if (!online) return <OfflineState onRetry={() => void mutate()} />;
    const requestId = error instanceof HttpError ? error.requestId : undefined;
    return (
      <ErrorState
        code={error instanceof HttpError ? error.code : "EXAMPLE_LOAD_FAILED"}
        requestId={requestId}
        onRetry={() => void mutate()}
      />
    );
  }

  return (
    <section className="space-y-4">
      <form onSubmit={submit} className="card p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Example-only
        </p>
        <h1 className="mt-2 text-2xl font-bold">Create one record</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          The title is domain data. Analytics receives only a fixed event name and the source
          identifier, never this text.
        </p>
        <label className="mt-4 block">
          <span className="text-sm font-semibold">Record title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            disabled={!online || saveState === "pending"}
            className="mt-1 min-h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 disabled:opacity-60"
          />
        </label>

        {!online ? (
          <p role="status" className="mt-3 text-sm text-[var(--text-muted)]">
            Reconnect before saving. The foundation does not queue sensitive writes offline.
          </p>
        ) : null}

        {saveState === "error" ? (
          <p role="alert" className="mt-3 text-sm text-[var(--danger)]">
            Save failed. Your text is still here; try again.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!online || saveState === "pending" || !title.trim()}
          className="mt-4 min-h-12 rounded-full bg-[var(--accent)] px-5 font-bold text-white disabled:opacity-50"
        >
          {saveState === "pending" ? "Saving…" : saveState === "error" ? "Try save again" : "Save"}
        </button>
      </form>

      {isValidating && data ? (
        <p role="status" className="px-1 text-xs text-[var(--text-muted)]">
          Refreshing…
        </p>
      ) : null}

      {data?.records.length ? (
        <ul className="space-y-3" aria-label="Saved records">
          {data.records.map((record) => (
            <li key={record.id} className="card p-4">
              <p className="font-semibold">{record.title}</p>
              <time
                className="mt-1 block text-xs text-[var(--text-muted)]"
                dateTime={record.created_at}
              >
                {new Date(record.created_at).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No records yet"
          description="Create the first record to prove the complete protected data loop."
        />
      )}
    </section>
  );
}

export function ExampleScreen() {
  useTrackScreen("example");
  return (
    <AuthBoundary>
      <ExampleContent />
    </AuthBoundary>
  );
}
