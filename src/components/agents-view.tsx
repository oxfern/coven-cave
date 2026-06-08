"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/lib/icon";
import type { Familiar, SessionRow } from "@/lib/types";
import {
  buildAgentCardStats,
  type AgentCardStats,
  type CovenMemoryEntry,
} from "@/components/agents-view-stats";

type FileMemoryEntry = {
  root: string;
  rootLabel: string;
  relPath: string;
  fullPath: string;
  size: number;
  modified: string;
};

type CovenMemoryResponse =
  | { ok: true; entries: CovenMemoryEntry[] }
  | { ok: false; entries?: CovenMemoryEntry[]; error?: string };

type FileMemoryResponse =
  | { ok: true; entries: FileMemoryEntry[] }
  | { ok: false; entries?: FileMemoryEntry[]; error?: string };

type ViewMode = "roster" | "detail" | "global-memory";

const LAST_SELECTED_KEY = "cave:agents.lastSelected";

type AgentsViewProps = {
  familiars: Familiar[];
  sessions: SessionRow[];
  daemonRunning: boolean;
  responseNeeded: Set<string>;
  onStartChat: (familiarId: string) => void;
  onOpenSession: (sessionId: string, familiarId?: string | null) => void;
  onOpenMemoryFile: (path: string) => void;
  onOpenOnboarding: () => void;
};

function age(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function familiarMatches(familiar: Familiar, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    familiar.display_name.toLowerCase().includes(q) ||
    (familiar.role ?? "").toLowerCase().includes(q) ||
    (familiar.harness ?? "").toLowerCase().includes(q) ||
    familiar.id.toLowerCase().includes(q)
  );
}

export function AgentsView({
  familiars,
  sessions,
  daemonRunning,
  responseNeeded,
  onStartChat,
  onOpenSession,
  onOpenMemoryFile,
  onOpenOnboarding,
}: AgentsViewProps) {
  void onStartChat;
  void onOpenSession;
  void onOpenMemoryFile;
  const [covenEntries, setCovenEntries] = useState<CovenMemoryEntry[]>([]);
  const [fileEntries, setFileEntries] = useState<FileMemoryEntry[]>([]);
  void fileEntries;
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedFamiliarId, setSelectedFamiliarId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(LAST_SELECTED_KEY);
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "roster";
    return window.localStorage.getItem(LAST_SELECTED_KEY) ? "detail" : "roster";
  });
  void viewMode;
  void setViewMode;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedFamiliarId) window.localStorage.setItem(LAST_SELECTED_KEY, selectedFamiliarId);
    else window.localStorage.removeItem(LAST_SELECTED_KEY);
  }, [selectedFamiliarId]);

  const loadMemory = useCallback(async () => {
    try {
      const [covenRes, fileRes] = await Promise.all([
        fetch("/api/coven-memory", { cache: "no-store" }),
        fetch("/api/memory", { cache: "no-store" }),
      ]);
      const covenJson = (await covenRes.json()) as CovenMemoryResponse;
      const fileJson = (await fileRes.json()) as FileMemoryResponse;
      if (covenJson.ok) setCovenEntries(covenJson.entries ?? []);
      if (fileJson.ok) setFileEntries(fileJson.entries ?? []);
      const errors = [
        covenJson.ok ? null : covenJson.error ?? "Coven memory unavailable",
        fileJson.ok ? null : fileJson.error ?? "Memory files unavailable",
      ].filter(Boolean);
      setMemoryError(errors.length > 0 ? errors.join(" · ") : null);
    } catch (err) {
      setMemoryError(err instanceof Error ? err.message : "memory unavailable");
    } finally {
      setMemoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadMemory();
    const t = setInterval(loadMemory, 30_000);
    return () => clearInterval(t);
  }, [loadMemory]);

  const stats = useMemo(
    () => buildAgentCardStats({ familiars, sessions, covenEntries }),
    [familiars, sessions, covenEntries],
  );

  const visibleFamiliars = useMemo(
    () => familiars.filter((f) => familiarMatches(f, query)),
    [familiars, query],
  );

  return (
    <div className="agents-view flex h-full min-h-0 flex-col bg-[var(--bg-base)]">
      <header className="shrink-0 border-b border-[var(--border-hairline)] px-4 py-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Icon name="ph:users-three" width={16} className="text-[var(--accent-presence)]" />
              <h1 className="text-[14px] font-semibold text-[var(--text-primary)]">Agents</h1>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Roster of every familiar — identity, status, recent activity, memory at a glance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadMemory()}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border-hairline)] px-2.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-raised)]"
            >
              <Icon name="ph:arrows-clockwise" width={12} />
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Icon
              name="ph:magnifying-glass"
              width={12}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search agents…"
              className="h-8 w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-raised)]/40 pl-7 pr-3 text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent-presence)]"
            />
          </div>
          {memoryError ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-2 py-1 text-[11px] text-[var(--color-warning)]">
              <Icon name="ph:warning-circle" width={12} />
              Memory feed unavailable
              <button
                type="button"
                onClick={() => void loadMemory()}
                className="ml-1 underline underline-offset-2"
              >
                Refresh
              </button>
            </span>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {familiars.length === 0 ? (
          <AgentsEmptyState onOpenOnboarding={onOpenOnboarding} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleFamiliars.map((familiar) => (
              <AgentRosterCard
                key={familiar.id}
                familiar={familiar}
                stats={stats.get(familiar.id) ?? emptyStats()}
                daemonRunning={daemonRunning}
                responseNeeded={responseNeeded.has(familiar.id)}
                memoryStatus={memoryError ? "error" : memoryLoaded ? "ready" : "loading"}
                onSelect={() => setSelectedFamiliarId(familiar.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function emptyStats(): AgentCardStats {
  return {
    memoryCount: 0,
    latestMemory: null,
    lastSessionAt: null,
    sessionsLast7d: 0,
    hasActiveSession: false,
  };
}

function AgentsEmptyState({ onOpenOnboarding }: { onOpenOnboarding: () => void }) {
  return (
    <div className="agents-view__empty mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <Icon name="ph:sparkle" width={28} className="text-[var(--accent-presence)]" />
      <h2 className="mt-3 text-[14px] font-semibold text-[var(--text-primary)]">No familiars yet</h2>
      <p className="mt-1 text-[12px] text-[var(--text-muted)]">
        Set up your first familiar to populate the roster.
      </p>
      <button
        type="button"
        onClick={onOpenOnboarding}
        className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-raised)] px-3 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-raised)]/80"
      >
        <Icon name="ph:plus" width={12} />
        Set up your first familiar
      </button>
    </div>
  );
}

type MemoryStatus = "loading" | "error" | "ready";

type AgentRosterCardProps = {
  familiar: Familiar;
  stats: AgentCardStats;
  daemonRunning: boolean;
  responseNeeded: boolean;
  memoryStatus: MemoryStatus;
  onSelect: () => void;
};

function AgentRosterCard({
  familiar,
  stats,
  daemonRunning,
  responseNeeded,
  memoryStatus,
  onSelect,
}: AgentRosterCardProps) {
  const glyph = (familiar.icon ?? "ph:circle-half-tilt") as IconName;
  const lastSessionLabel = stats.lastSessionAt
    ? `Last session ${age(stats.lastSessionAt)}`
    : "No sessions yet";
  const sessionsLabel =
    stats.sessionsLast7d > 0 ? ` · ${stats.sessionsLast7d} this week` : "";
  return (
    <button
      type="button"
      onClick={onSelect}
      className="agents-view__card group flex h-full flex-col items-stretch gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-raised)]/35 p-3 text-left transition-colors hover:border-[var(--accent-presence)]/50 hover:bg-[var(--bg-raised)]/60"
      aria-label={`Open ${familiar.display_name}`}
    >
      <div className="flex items-center gap-2">
        <Icon name={glyph} width={18} className="text-[var(--accent-presence)]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-[var(--text-primary)]">
            {familiar.display_name}
          </span>
          <span className="block truncate text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            {familiar.role || familiar.harness || familiar.id}
          </span>
        </span>
        <Icon
          name="ph:caret-right"
          width={12}
          className="text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
        <span
          className={`inline-flex h-1.5 w-1.5 rounded-full ${daemonRunning ? "bg-[var(--accent-presence)]" : "bg-[var(--text-muted)]"}`}
          aria-hidden="true"
        />
        <span>{daemonRunning ? "online" : "offline"}</span>
        {stats.hasActiveSession ? (
          <span className="rounded bg-[var(--accent-presence)]/15 px-1.5 py-0.5 text-[9px] text-[var(--accent-presence)]">
            active session
          </span>
        ) : null}
        {responseNeeded ? (
          <span className="rounded bg-[var(--color-warning)]/15 px-1.5 py-0.5 text-[9px] text-[var(--color-warning)]">
            response needed
          </span>
        ) : null}
      </div>

      <p className="text-[11px] text-[var(--text-secondary)]">
        {lastSessionLabel}{sessionsLabel}
      </p>

      <div className="mt-auto border-t border-[var(--border-hairline)] pt-2 text-[11px] text-[var(--text-secondary)]">
        {memoryStatus === "loading" ? (
          <span className="text-[var(--text-muted)]">Loading memory…</span>
        ) : memoryStatus === "error" ? (
          <span className="text-[var(--text-muted)]">Memory unavailable</span>
        ) : stats.memoryCount === 0 ? (
          <span className="text-[var(--text-muted)]">No memories yet</span>
        ) : (
          <>
            <span className="block">
              {stats.memoryCount} memor{stats.memoryCount === 1 ? "y" : "ies"}
              {stats.latestMemory ? ` · last write ${age(stats.latestMemory.updatedAt)}` : ""}
            </span>
            {stats.latestMemory ? (
              <span className="mt-0.5 block truncate text-[10px] text-[var(--text-muted)]">
                {stats.latestMemory.title}
              </span>
            ) : null}
          </>
        )}
      </div>
    </button>
  );
}
