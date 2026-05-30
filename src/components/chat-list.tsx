"use client";

import { useMemo, useState } from "react";
import type { Familiar, SessionRow } from "@/lib/types";

const PROJECT_ROOT =
  process.env.NEXT_PUBLIC_COVEN_PROJECT_ROOT ??
  "/Users/buns/Documents/GitHub/OpenCoven/coven-cave";

type Props = {
  familiar: Familiar;
  sessions: SessionRow[];
  daemonRunning?: boolean;
  onOpen: (sessionId: string) => void;
  onNewChat: () => void;
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

export function ChatList({ familiar, sessions, daemonRunning, onOpen, onNewChat }: Props) {
  const [busyTuiId, setBusyTuiId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mine = useMemo(() => {
    return sessions
      .filter((s) => s.familiarId === familiar.id)
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  }, [sessions, familiar.id]);

  const openInTui = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setBusyTuiId(sessionId);
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
      setBusyTuiId(null);
    }
  };

  const projectName = PROJECT_ROOT.split("/").slice(-2).join("/");

  return (
    <section className="flex h-full flex-col bg-zinc-950 font-mono text-[13px] text-zinc-200">
      {/* TUI-style status row */}
      <header className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2 text-[11px] text-zinc-400">
        <span className="text-zinc-100">
          Coven <span className="text-violet-300">{familiar.harness ?? "codex"}</span>
        </span>
        <span className="text-zinc-600">·</span>
        <span className="truncate text-zinc-500">{projectName}</span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-500">
          daemon:{" "}
          <span className={daemonRunning ? "text-emerald-400" : "text-rose-400"}>
            {daemonRunning ? "running" : "offline"}
          </span>
        </span>
        <span className="text-zinc-600">·</span>
        <span className="truncate text-zinc-500">
          <span className="text-zinc-400">{familiar.display_name}</span>
          <span className="ml-1.5 text-zinc-600">{familiar.model ?? ""}</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-zinc-600">{mine.length} chat{mine.length === 1 ? "" : "s"}</span>
          <button
            onClick={onNewChat}
            className="rounded border border-violet-500 px-2 py-0.5 text-[11px] text-violet-200 hover:bg-violet-500/10"
            title="Start a new chat (Ctrl+N)"
          >
            + new chat
          </button>
        </span>
      </header>

      {error ? (
        <div className="border-b border-amber-700/40 bg-amber-900/20 px-4 py-1.5 text-xs text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {/* Standing "✦ coven" greeting block */}
        <div className="my-3">
          <div className="flex items-center gap-2 text-violet-300">
            <span className="select-none">✦</span>
            <span className="text-[12px] uppercase tracking-widest">coven</span>
          </div>
          <div className="mt-1 ml-4 text-zinc-300">
            {mine.length === 0 ? (
              <>
                No chats with <span className="text-zinc-100">{familiar.display_name}</span> yet.
                Type <span className="text-violet-300">+ new chat</span> above or press{" "}
                <span className="text-zinc-100">N</span>.
              </>
            ) : (
              <>
                Chats with <span className="text-zinc-100">{familiar.display_name}</span> — pick
                one or start a new thread.
              </>
            )}
          </div>
        </div>

        {/* Sessions listed plain, with `✦` accents */}
        {mine.length > 0 ? (
          <ul className="space-y-1">
            {mine.map((s) => {
              const running = s.status === "running";
              return (
                <li key={s.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpen(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onOpen(s.id);
                    }}
                    className="group grid cursor-pointer grid-cols-[20px_minmax(0,1fr)_auto_auto] items-center gap-3 px-2 py-1.5 transition-colors hover:bg-zinc-900/60"
                  >
                    <span
                      className={
                        running
                          ? "text-emerald-400 animate-pulse"
                          : "text-zinc-600"
                      }
                      title={running ? "running" : "idle"}
                    >
                      {running ? "●" : "○"}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-zinc-100">
                        {s.title || "(untitled chat)"}
                      </span>
                      <span className="truncate text-[10px] text-zinc-500">
                        <span className="text-zinc-400">{s.harness}</span>
                        <span className="mx-1 text-zinc-700">·</span>
                        {s.project_root}
                      </span>
                    </span>
                    <span className="text-[10px] text-zinc-500">{age(s.updated_at)}</span>
                    <button
                      onClick={(e) => openInTui(e, s.id)}
                      disabled={busyTuiId === s.id}
                      title="Open this session in Coven Code TUI (external terminal)"
                      className="rounded border border-zinc-700 px-1.5 py-0 text-[10px] text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-800 group-hover:opacity-100 disabled:opacity-40"
                    >
                      {busyTuiId === s.id ? "…" : "tui"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {/* TUI-style hint footer */}
      <footer className="border-t border-zinc-800 px-4 py-2 text-[10px] text-zinc-600">
        ↵ open · n new · t toggle tui · /help
      </footer>
    </section>
  );
}
