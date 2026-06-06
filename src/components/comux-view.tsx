"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BottomTerminal } from "@/components/bottom-terminal";
import { Icon } from "@/lib/icon";
import { ProjectTree, type ProjectTreeHandle } from "@/components/project-tree";
import { SyntaxBlock } from "@/components/message-bubble";
import {
  deriveComuxProjects,
  projectName,
  type ComuxProject,
} from "@/lib/comux-projects";
import type { SessionRow } from "@/lib/types";

type ComuxTab = "comux" | "project";

type TerminalSession = {
  id: string;
  label: string;
  projectRoot?: string;
};

type Props = {
  sessions: SessionRow[];
  onOpenSession: (sessionId: string, familiarId?: string | null) => void;
  onNewChat: (projectRoot: string) => void;
};

const STORAGE_TAB = "cave:comux:tab";
const STORAGE_SESSIONS = "cave:comux:sessions";

function readTab(): ComuxTab {
  if (typeof window === "undefined") return "comux";
  const v = window.localStorage.getItem(STORAGE_TAB);
  return v === "project" ? "project" : "comux";
}

function readSessions(): TerminalSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_SESSIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is TerminalSession =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as Record<string, unknown>).id === "string" &&
        typeof (s as Record<string, unknown>).label === "string",
    ).map((s) => ({
      id: s.id,
      label: s.label,
      projectRoot:
        typeof (s as Record<string, unknown>).projectRoot === "string"
          ? ((s as Record<string, unknown>).projectRoot as string)
          : undefined,
    }));
  } catch {
    return [];
  }
}

function uid(): string {
  return crypto.randomUUID();
}

function shortProjectTime(iso: string | null): string {
  if (!iso) return "No sessions yet";
  try {
    const diffSec = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
    const days = Math.round(diffSec / 86400);
    if (days < 30) return `${days}d ago`;
    return `${Math.round(days / 30)}mo ago`;
  } catch {
    return "No sessions yet";
  }
}

export function ComuxView({ sessions: daemonSessions, onOpenSession, onNewChat }: Props) {
  const [tab, setTab] = useState<ComuxTab>(readTab);
  const [sessions, setSessions] = useState<TerminalSession[]>(readSessions);
  const [currentIdx, setCurrentIdx] = useState(0);

  // Project tab state
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const treeRef = useRef<ProjectTreeHandle | null>(null);

  // Daemon project root — forwarded to BottomTerminal so terminals open in
  // the right CWD instead of the app bundle dir.
  const [daemonProjectRoot, setDaemonProjectRoot] = useState<string | undefined>(undefined);
  const [selectedProjectRoot, setSelectedProjectRoot] = useState<string | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/daemon/status", { cache: "no-store" });
        const json = (await res.json()) as Record<string, unknown>;
        const root =
          (json.workspacePath as string | undefined) ??
          (json.projectRoot as string | undefined);
        if (root && typeof root === "string") {
          setDaemonProjectRoot(root);
        }
      } catch {
        // non-fatal — terminal will open in default shell dir
      }
    })();
  }, []);

  // Persist tab choice
  useEffect(() => {
    window.localStorage.setItem(STORAGE_TAB, tab);
  }, [tab]);

  // Persist sessions
  useEffect(() => {
    window.localStorage.setItem(STORAGE_SESSIONS, JSON.stringify(sessions));
  }, [sessions]);

  const projects = useMemo(
    () => deriveComuxProjects(daemonSessions, daemonProjectRoot),
    [daemonSessions, daemonProjectRoot],
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.root === selectedProjectRoot) ?? projects[0] ?? null,
    [projects, selectedProjectRoot],
  );

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectRoot(undefined);
      return;
    }
    setSelectedProjectRoot((current) =>
      current && projects.some((project) => project.root === current)
        ? current
        : projects[0].root,
    );
  }, [projects]);

  const addSession = useCallback((rootOverride?: string) => {
    const id = uid();
    const root = rootOverride ?? selectedProjectRoot ?? daemonProjectRoot;
    setSessions((prev) => {
      const next = [
        ...prev,
        {
          id,
          label: root ? `${projectName(root)} ${prev.length + 1}` : `Terminal ${prev.length + 1}`,
          projectRoot: root,
        },
      ];
      setCurrentIdx(next.length - 1);
      return next;
    });
    setTab("comux");
  }, [daemonProjectRoot, selectedProjectRoot]);

  const removeSession = useCallback(
    (idx: number) => {
      setSessions((prev) => {
        const next = prev.filter((_, i) => i !== idx);
        setCurrentIdx((ci) => {
          if (next.length === 0) return 0;
          if (ci >= next.length) return next.length - 1;
          if (ci > idx) return ci - 1;
          return ci;
        });
        return next;
      });
    },
    [],
  );

  const renameSession = useCallback((idx: number, label: string) => {
    setSessions((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, label } : s)),
    );
  }, []);

  const openFilePreview = useCallback(async (path: string) => {
    setPreviewPath(path);
    setPreviewLoading(true);
    setPreviewContent(null);
    try {
      const res = await fetch(
        `/api/project-file?path=${encodeURIComponent(path)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        ok: boolean;
        content?: string;
        error?: string;
      };
      if (json.ok && typeof json.content === "string") {
        setPreviewContent(json.content);
      } else {
        setPreviewContent(`// Error: ${json.error ?? "unknown"}`);
      }
    } catch (err) {
      setPreviewContent(`// Fetch failed: ${String(err)}`);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const selectProject = useCallback((project: ComuxProject) => {
    setSelectedProjectRoot(project.root);
    setPreviewPath(null);
    setPreviewContent(null);
    setTab("project");
  }, []);

  const recentProjectSessions = useMemo(() => {
    if (!selectedProject) return [];
    return daemonSessions
      .filter((session) => session.project_root === selectedProject.root)
      .sort((a, b) =>
        (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at),
      )
      .slice(0, 6);
  }, [daemonSessions, selectedProject]);

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-[var(--border-hairline)] bg-[var(--bg-raised)]/40 px-3 py-1.5 text-xs">
        <button
          type="button"
          onClick={() => setTab("comux")}
          className={`rounded px-2 py-0.5 transition-colors ${
            tab === "comux"
              ? "bg-[var(--bg-base)] text-[var(--text-primary)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          Coven Code
        </button>
        <button
          type="button"
          onClick={() => setTab("project")}
          className={`rounded px-2 py-0.5 transition-colors ${
            tab === "project"
              ? "bg-[var(--bg-base)] text-[var(--text-primary)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          Project
        </button>
      </div>

      {/* Tab content */}
      {tab === "comux" ? (
        <div className="flex flex-1 flex-col min-h-0">
          {/* Session tab strip */}
          <div className="flex items-center gap-0.5 border-b border-[var(--border-hairline)] bg-[var(--bg-raised)]/20 px-2 py-1 text-[11px]">
            {sessions.map((s, i) => (
              <div
                key={s.id}
                className={`group flex items-center gap-1 rounded px-2 py-0.5 cursor-pointer transition-colors ${
                  i === currentIdx
                    ? "bg-[var(--bg-base)] text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
                onClick={() => setCurrentIdx(i)}
              >
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    renameSession(i, e.currentTarget.textContent ?? s.label)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLElement).blur();
                    }
                  }}
                  className="outline-none max-w-[120px] truncate"
                >
                  {s.label}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSession(i);
                  }}
                  className="hidden group-hover:inline text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  x
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addSession()}
              className="rounded px-1.5 py-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-secondary)]"
            >
              +
            </button>
          </div>

          {/* Terminal area */}
          <div className="flex-1 min-h-0 relative">
            {sessions.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                <p>No terminal sessions.</p>
                <button
                  type="button"
                  onClick={() => addSession()}
                  className="rounded border border-[var(--border-hairline)] px-3 py-1 text-[var(--text-secondary)] hover:bg-[var(--bg-raised)]"
                >
                  + New terminal
                </button>
              </div>
            ) : (
              sessions.map((s, i) => (
                <div
                  key={s.id}
                  className="h-full w-full"
                  style={{
                    position: "absolute",
                    inset: 0,
                    visibility: i === currentIdx ? "visible" : "hidden",
                    pointerEvents: i === currentIdx ? "auto" : "none",
                  }}
                >
                  <BottomTerminal
                    threadId={`cave.comux.${s.id}`}
                    active={i === currentIdx}
                    projectRoot={s.projectRoot ?? selectedProjectRoot ?? daemonProjectRoot}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Project tab */
        <div className="flex flex-1 min-h-0">
          {/* Project list */}
          <div className="w-[260px] shrink-0 overflow-y-auto border-r border-[var(--border-hairline)] bg-[var(--bg-raised)]/20 p-2 text-xs">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="font-semibold text-[var(--text-secondary)]">Projects</span>
              <span className="rounded-full bg-[var(--bg-raised)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                {projects.length}
              </span>
            </div>
            <div className="space-y-1">
              {projects.map((project) => (
                <button
                  key={project.root}
                  type="button"
                  onClick={() => selectProject(project)}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    selectedProject?.root === project.root
                      ? "border-[var(--accent-presence)] bg-[var(--bg-base)]"
                      : "border-[var(--border-hairline)] bg-[var(--bg-base)]/50 hover:border-[var(--border-strong)] hover:bg-[var(--bg-base)]"
                  }`}
                  title={project.root}
                >
                  <span className="flex items-center gap-2">
                    <Icon name="ph:folder" width={13} className="shrink-0 text-[var(--text-muted)]" />
                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">
                      {project.name}
                    </span>
                    {project.runningCount > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    )}
                  </span>
                  <span className="mt-1 block truncate text-[10px] text-[var(--text-muted)]">
                    {project.root}
                  </span>
                  <span className="mt-1.5 flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                    <span>{project.sessionCount} chats</span>
                    <span>{project.familiarCount} familiars</span>
                    <span className="ml-auto">{shortProjectTime(project.updatedAt)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Project detail */}
          <div className="flex min-w-0 flex-1 flex-col">
            {selectedProject ? (
              <>
                <div className="border-b border-[var(--border-hairline)] px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon name="ph:folder-open" width={15} className="shrink-0 text-[var(--text-muted)]" />
                        <h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                          {selectedProject.name}
                        </h2>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">
                        {selectedProject.root}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => addSession(selectedProject.root)}
                        className="flex items-center gap-1 rounded-md border border-[var(--border-hairline)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-raised)]"
                      >
                        <Icon name="ph:plus" width={12} />
                        Terminal
                      </button>
                      <button
                        type="button"
                        onClick={() => onNewChat(selectedProject.root)}
                        className="flex items-center gap-1 rounded-md bg-[var(--accent-presence)] px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-85"
                      >
                        <Icon name="ph:chat-circle-dots" width={12} />
                        New chat
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(220px,32%)_minmax(0,1fr)]">
                  <div className="min-h-0 overflow-y-auto border-b border-[var(--border-hairline)] p-3 xl:border-b-0 xl:border-r">
                    <div className="mb-3">
                      <div className="mb-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                        Recent sessions
                      </div>
                      {recentProjectSessions.length === 0 ? (
                        <p className="text-[11px] text-[var(--text-muted)]">
                          No chats have been started in this project yet.
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {recentProjectSessions.map((session) => (
                            <button
                              key={session.id}
                              type="button"
                              onClick={() => onOpenSession(session.id, session.familiarId)}
                              className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-raised)]/60 px-2 py-1.5 text-left hover:bg-[var(--bg-raised)]"
                            >
                              <span className="block truncate text-[11px] font-medium text-[var(--text-primary)]">
                                {session.title || "(untitled chat)"}
                              </span>
                              <span className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                                <span>{session.status}</span>
                                <span className="ml-auto">{shortProjectTime(session.updated_at)}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                          Files
                        </span>
                        <button
                          type="button"
                          onClick={() => treeRef.current?.refresh()}
                          className="rounded px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-secondary)]"
                        >
                          refresh
                        </button>
                      </div>
                      <ProjectTree
                        ref={treeRef}
                        root={selectedProject.root}
                        onFileClick={openFilePreview}
                      />
                    </div>
                  </div>

                  <div className="min-w-0 overflow-auto p-3">
                    {previewPath ? (
                      <>
                        <div className="mb-2 truncate text-[11px] text-[var(--text-muted)]">
                          {previewPath}
                        </div>
                        {previewLoading ? (
                          <p className="text-xs text-[var(--text-muted)]">Loading...</p>
                        ) : (
                          <SyntaxBlock
                            text={previewContent ?? ""}
                            lang={previewPath?.split(".").pop()}
                            className="leading-relaxed"
                          />
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)]">
                        Select a file to preview.
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
                No projects found yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
