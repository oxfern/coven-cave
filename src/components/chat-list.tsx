"use client";

import { useMemo, useState } from "react";
import type { Familiar, SessionRow } from "@/lib/types";
import { Icon } from "@/lib/icon";
import { useKeySymbols } from "@/lib/platform-keys";
import { OriginChip } from "@/components/ui/origin-chip";

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

/** Show only the last two path segments — enough to identify the project. */
function shortPath(p: string): string {
  if (!p) return "";
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}

const STATUS_STYLES: Record<string, { dot: string; label: string; text: string }> = {
  running:   { dot: "bg-emerald-400 animate-pulse", label: "running",   text: "text-emerald-400" },
  completed: { dot: "bg-[var(--text-muted)]",        label: "done",      text: "text-[var(--text-muted)]" },
  failed:    { dot: "bg-rose-400",                   label: "failed",    text: "text-rose-400" },
  queued:    { dot: "bg-amber-400",                  label: "queued",    text: "text-amber-400" },
  paused:    { dot: "bg-sky-400",                    label: "paused",    text: "text-sky-400" },
};

function statusStyle(s: string) {
  return STATUS_STYLES[s] ?? STATUS_STYLES.completed;
}

export function ChatList({ familiar, sessions, daemonRunning, onOpen, onNewChat }: Props) {
  const [busyTuiId, setBusyTuiId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keys = useKeySymbols();

  const mine = useMemo(() => {
    const DEAD = new Set(["killed", "orphaned", "stopped", "archived"]);
    return sessions
      .filter((s) => s.familiarId === familiar.id && !DEAD.has(s.status))
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

  const running = mine.filter((s) => s.status === "running");
  const idle    = mine.filter((s) => s.status !== "running");

  return (
    <section className="flex h-full flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* ── Header ── */}
      <header className="flex items-center gap-2 border-b border-[var(--border-hairline)] px-4 py-2.5 text-[11px]">
        {/* Agent name + harness */}
        <span className="font-semibold text-[var(--text-primary)]">{familiar.display_name}</span>
        <span className="text-[var(--text-muted)]">·</span>
        <span className="font-mono text-[var(--text-muted)]">{familiar.harness ?? "codex"}</span>

        {/* Daemon pill */}
        <span
          className={`ml-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            daemonRunning
              ? "bg-emerald-950/60 text-emerald-400"
              : "bg-rose-950/60 text-rose-400"
          }`}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${daemonRunning ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
          {daemonRunning ? "daemon running" : "daemon offline"}
        </span>

        {/* Chat count */}
        {mine.length > 0 && (
          <span className="rounded-full bg-[var(--bg-raised)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
            {mine.length} {mine.length === 1 ? "chat" : "chats"}
          </span>
        )}

        {/* New chat CTA */}
        <button
          onClick={onNewChat}
          className="ml-auto flex items-center gap-1 rounded-full bg-[var(--accent-presence)] px-3 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-80 active:scale-95"
        >
          <span className="text-base leading-none">+</span> New chat
        </button>
      </header>

      {/* ── Error banner ── */}
      {error && (
        <div className="border-b border-amber-700/40 bg-amber-900/20 px-4 py-1.5 text-xs text-amber-200">
          {error}
        </div>
      )}

      {/* ── Body ── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {mine.length === 0 ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-raised)]/60 text-2xl">
              ✦
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)]">No chats yet</p>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                {familiar.display_name} runs on{" "}
                <code className="rounded bg-[var(--bg-raised)] px-1 font-mono text-[11px] text-[var(--text-secondary)]">
                  {familiar.harness}
                </code>
                {familiar.model ? (
                  <>
                    {" "}with{" "}
                    <code className="rounded bg-[var(--bg-raised)] px-1 font-mono text-[11px] text-[var(--text-secondary)]">
                      {familiar.model}
                    </code>
                  </>
                ) : null}
                .
              </p>
            </div>
            <button
              onClick={onNewChat}
              className="rounded-full bg-[var(--accent-presence)] px-5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
            >
              + New chat
            </button>
          </div>
        ) : (
          <div className="px-4 py-4">
            {/* ── Active section ── */}
            {running.length > 0 && (
              <div className="mb-4">
                <p className="mb-1.5 px-1 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Active</p>
                <ChatRows rows={running} onOpen={onOpen} busyTuiId={busyTuiId} openInTui={openInTui} />
              </div>
            )}

            {/* ── Recent section ── */}
            {idle.length > 0 && (
              <div>
                {running.length > 0 && (
                  <p className="mb-1.5 px-1 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Recent</p>
                )}
                <ChatRows rows={idle} onOpen={onOpen} busyTuiId={busyTuiId} openInTui={openInTui} />
              </div>
            )}

            {/* ── Start something new nudge (sparse lists) ── */}
            {mine.length <= 3 && (
              <button
                onClick={onNewChat}
                className="mt-4 w-full rounded-xl border border-dashed border-[var(--border-hairline)] py-3 text-[12px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent-presence)] hover:text-[var(--accent-presence)]"
              >
                + start a new conversation
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--border-hairline)] px-4 py-2 text-[10px] text-[var(--text-muted)]">
        {keys.enter} open · {keys.mod}K palette · / commands in chat
      </footer>
    </section>
  );
}

/* ── Row sub-component ── */
type RowProps = {
  rows: SessionRow[];
  onOpen: (id: string) => void;
  busyTuiId: string | null;
  openInTui: (e: React.MouseEvent, id: string) => void;
};

function ChatRows({ rows, onOpen, busyTuiId, openInTui }: RowProps) {
  return (
    <ul className="overflow-hidden rounded-xl border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)]">
      {rows.map((s) => {
        const st = statusStyle(s.status);
        return (
          <li key={s.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpen(s.id)}
              onKeyDown={(e) => { if (e.key === "Enter") onOpen(s.id); }}
              className="group flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--bg-raised)]/50"
            >
              {/* Status dot */}
              <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${st.dot}`} title={st.label} />

              {/* Title + meta */}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                    {s.title || "(untitled chat)"}
                  </span>
                  {s.origin ? <OriginChip origin={s.origin} /> : null}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                  <span className={`font-mono ${st.text}`}>{st.label}</span>
                  {s.project_root && (
                    <>
                      <span>·</span>
                      <span className="truncate font-mono">{shortPath(s.project_root)}</span>
                    </>
                  )}
                </span>
              </span>

              {/* Age */}
              <span className="shrink-0 text-[10px] text-[var(--text-muted)]">{age(s.updated_at)}</span>

              {/* TUI button — revealed on hover */}
              <button
                onClick={(e) => openInTui(e, s.id)}
                disabled={busyTuiId === s.id}
                title="Open in Coven Code TUI"
                className="shrink-0 rounded border border-[var(--border-hairline)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] opacity-0 transition-all hover:bg-[var(--bg-raised)] group-hover:opacity-100 disabled:opacity-40"
              >
                {busyTuiId === s.id ? "…" : "tui →"}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
