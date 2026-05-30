"use client";

import { useMemo, useState } from "react";
import type { Familiar, SessionRow } from "@/lib/types";

const PROJECT_ROOT =
  process.env.NEXT_PUBLIC_COVEN_PROJECT_ROOT ??
  "/Users/buns/Documents/GitHub/OpenCoven/coven-cave";

type Props = {
  familiar: Familiar | null;
  sessions: SessionRow[];
};

function age(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ChatList({ familiar, sessions }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newChatBusy, setNewChatBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mine = useMemo(() => {
    if (!familiar) return [];
    return sessions
      .filter((s) => s.familiarId === familiar.id)
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  }, [sessions, familiar]);

  const openInTui = async (sessionId: string) => {
    setBusyId(sessionId);
    setError(null);
    try {
      const res = await fetch("/api/launch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "attach", sessionId }),
      });
      const json = await res.json();
      if (!json.ok) setError(json.error ?? "launch failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "launch failed");
    } finally {
      setBusyId(null);
    }
  };

  const newChat = async () => {
    setNewChatBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/launch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "chat", cwd: PROJECT_ROOT }),
      });
      const json = await res.json();
      if (!json.ok) setError(json.error ?? "launch failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "launch failed");
    } finally {
      setNewChatBusy(false);
    }
  };

  if (!familiar) {
    return (
      <section className="flex h-full items-center justify-center bg-zinc-950 text-sm text-zinc-500">
        Pick a familiar from the rail to see their chats.
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-lg">{familiar.emoji}</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{familiar.display_name}</div>
            <div className="truncate text-[11px] text-zinc-500">
              {familiar.harness ?? "?"} ·{" "}
              <span className="font-mono">{familiar.model ?? "?"}</span>
            </div>
          </div>
        </div>
        <button
          onClick={newChat}
          disabled={newChatBusy}
          className="rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
        >
          {newChatBusy ? "opening…" : "+ New chat"}
        </button>
      </header>

      {error ? (
        <div className="border-b border-amber-700/40 bg-amber-900/20 px-4 py-1.5 text-xs text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {mine.length === 0 ? (
          <div className="mx-auto mt-12 max-w-sm text-center text-sm text-zinc-500">
            <p className="mb-3 text-zinc-400">
              No chats with {familiar.display_name} yet.
            </p>
            <p className="text-xs text-zinc-600">
              Start one — {familiar.display_name} runs on{" "}
              <span className="font-mono text-zinc-400">{familiar.harness}</span> with{" "}
              <span className="font-mono text-zinc-400">{familiar.model}</span>.
            </p>
            <button
              onClick={newChat}
              disabled={newChatBusy}
              className="mt-5 rounded-md bg-violet-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
            >
              {newChatBusy ? "opening…" : "+ New chat in Coven Code"}
            </button>
          </div>
        ) : (
          <ul className="space-y-1">
            {mine.map((s) => {
              const running = s.status === "running";
              const busy = busyId === s.id;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => openInTui(s.id)}
                    disabled={busy}
                    className="group flex w-full items-start gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:border-zinc-800 hover:bg-zinc-900/60 disabled:opacity-60"
                    title="Open this session in Coven Code TUI"
                  >
                    <span
                      className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                        running ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
                      }`}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-zinc-100">
                          {s.title || "(untitled chat)"}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                          {busy ? "opening…" : age(s.updated_at)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-500">
                        <span className="rounded bg-zinc-800 px-1 py-px font-mono text-zinc-400">
                          {s.harness}
                        </span>
                        <span className="truncate">{s.project_root}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="border-t border-zinc-800 px-4 py-2 text-[10px] text-zinc-600">
        Click a session to open it in Coven Code (external terminal).
      </footer>
    </section>
  );
}
