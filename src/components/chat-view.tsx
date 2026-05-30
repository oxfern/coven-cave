"use client";

import { useEffect, useRef, useState } from "react";
import type { Familiar } from "@/lib/types";

const PROJECT_ROOT =
  process.env.NEXT_PUBLIC_COVEN_PROJECT_ROOT ??
  "/Users/buns/Documents/GitHub/OpenCoven/coven-cave";

type Turn = {
  id: string;
  role: "user" | "assistant" | "system";
  speaker?: string;
  text: string;
  pending?: boolean;
  error?: boolean;
};

type Props = {
  familiar: Familiar;
  sessionId: string | null;
  daemonRunning?: boolean;
  onSessionStarted?: (sessionId: string) => void;
  onBack?: () => void;
};

type StreamEvent =
  | { kind: "session"; sessionId: string }
  | { kind: "user"; text: string }
  | { kind: "assistant_chunk"; text: string }
  | { kind: "done"; durationMs?: number; isError?: boolean; sessionId?: string }
  | { kind: "error"; message: string };

const HINTS = [
  'Try "review this branch" or /help',
  'Try "fix the failing tests" or /sessions',
  'Try "summarize recent changes" or /help',
];

export function ChatView({
  familiar,
  sessionId,
  daemonRunning,
  onSessionStarted,
  onBack,
}: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentSessionRef = useRef<string | null>(sessionId);
  const tailRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Load history on attach; show "ready" greeting on a new chat
  useEffect(() => {
    currentSessionRef.current = sessionId;
    if (!sessionId) {
      setTurns([
        {
          id: "ready",
          role: "system",
          speaker: "coven",
          text: `Ready. Type a task or /help.`,
        },
      ]);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`/api/chat/conversation/${sessionId}`, { cache: "no-store" });
        if (!res.ok) {
          setTurns([]);
          return;
        }
        const json = await res.json();
        if (json.ok && json.conversation) {
          setTurns(
            json.conversation.turns
              .filter((t: { role: string }) => t.role === "user" || t.role === "assistant")
              .map((t: { id: string; role: "user" | "assistant"; text: string }) => ({
                id: t.id,
                role: t.role,
                speaker: t.role === "assistant" ? familiar.harness : undefined,
                text: t.text,
              })),
          );
        }
      } catch {
        /* fall through */
      }
    })();
  }, [sessionId, familiar.harness]);

  useEffect(() => {
    tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [sessionId]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setInput("");

    const userTurn: Turn = { id: crypto.randomUUID(), role: "user", text };
    const assistantId = crypto.randomUUID();
    const assistantTurn: Turn = {
      id: assistantId,
      role: "assistant",
      speaker: familiar.harness ?? "codex",
      text: "",
      pending: true,
    };
    setTurns((prev) => [...prev.filter((t) => t.id !== "ready"), userTurn, assistantTurn]);

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          familiarId: familiar.id,
          prompt: text,
          sessionId: currentSessionRef.current,
          projectRoot: PROJECT_ROOT,
        }),
      });
      if (!res.ok || !res.body) {
        setError(`request failed (${res.status})`);
        markAssistantError(assistantId);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!frame.startsWith("data:")) continue;
          const payload = frame.slice(5).trim();
          if (!payload) continue;
          try {
            const ev = JSON.parse(payload) as StreamEvent;
            handleEvent(ev, assistantId);
          } catch {
            /* skip malformed */
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "send failed");
      markAssistantError(assistantId);
    } finally {
      setBusy(false);
    }
  };

  const handleEvent = (ev: StreamEvent, assistantId: string) => {
    switch (ev.kind) {
      case "session": {
        if (!currentSessionRef.current) {
          currentSessionRef.current = ev.sessionId;
          onSessionStarted?.(ev.sessionId);
        }
        return;
      }
      case "assistant_chunk": {
        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistantId
              ? { ...t, text: (t.text + ev.text).replace(/\n{3,}/g, "\n\n"), pending: true }
              : t,
          ),
        );
        return;
      }
      case "done": {
        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistantId ? { ...t, pending: false, error: ev.isError ?? false } : t,
          ),
        );
        if (ev.sessionId && !currentSessionRef.current) {
          currentSessionRef.current = ev.sessionId;
          onSessionStarted?.(ev.sessionId);
        }
        return;
      }
      case "error": {
        setError(ev.message);
        markAssistantError(assistantId);
        return;
      }
    }
  };

  const markAssistantError = (id: string) => {
    setTurns((prev) =>
      prev.map((t) => (t.id === id ? { ...t, pending: false, error: true } : t)),
    );
  };

  const hint = HINTS[Math.floor(Date.now() / 30000) % HINTS.length];
  const projectName = PROJECT_ROOT.split("/").slice(-2).join("/");

  return (
    <section className="flex h-full flex-col bg-zinc-950 font-mono text-[13px] text-zinc-200">
      {/* Compact status row — matches the TUI's "Coven codex · path · daemon: running" header */}
      <header className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2 text-[11px] text-zinc-400">
        {onBack ? (
          <button
            onClick={onBack}
            className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300 transition-colors hover:bg-zinc-800"
            title="Back to chats"
          >
            ← chats
          </button>
        ) : null}
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
        <span className="ml-auto text-zinc-500">
          {busy ? (
            <span className="text-amber-400">streaming…</span>
          ) : currentSessionRef.current ? (
            <span className="text-emerald-400">● live</span>
          ) : (
            <span>new</span>
          )}
        </span>
      </header>

      {/* Transcript — left-aligned blocks, no bubbles */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {turns.map((t) => (
          <Block key={t.id} turn={t} familiarName={familiar.display_name} />
        ))}
        <div ref={tailRef} />
      </div>

      {error ? (
        <div className="border-t border-amber-700/40 bg-amber-900/20 px-4 py-1.5 text-xs text-amber-200">
          {error}
        </div>
      ) : null}

      {/* Composer — bottom bar with a `>` indicator like the TUI */}
      <footer className="border-t border-zinc-800 px-4 py-3">
        <div className="flex items-start gap-2">
          <span className="pt-1 text-violet-400 select-none">{">"}</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={hint}
            rows={1}
            disabled={busy}
            className="flex-1 resize-none bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-50"
          />
          <button
            onClick={() => void send()}
            disabled={busy || !input.trim()}
            className="self-start rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            title="Send (Enter)"
          >
            send
          </button>
        </div>
        <div className="mt-1 flex items-center gap-3 text-[10px] text-zinc-600">
          <span>↵ send</span>
          <span>⇧↵ newline</span>
          <span>/help</span>
        </div>
      </footer>
    </section>
  );
}

function Block({ turn, familiarName }: { turn: Turn; familiarName: string }) {
  if (turn.role === "user") {
    return (
      <div className="my-3 flex items-start gap-2">
        <span className="select-none text-violet-400">{">"}</span>
        <span className="whitespace-pre-wrap break-words text-zinc-100">{turn.text}</span>
      </div>
    );
  }

  const speaker =
    turn.speaker ?? (turn.role === "assistant" ? familiarName.toLowerCase() : "coven");
  const speakerColor = turn.error ? "text-amber-300" : "text-violet-300";

  return (
    <div className="my-3">
      <div className={`flex items-center gap-2 ${speakerColor}`}>
        <span className="select-none">✦</span>
        <span className="text-[12px] uppercase tracking-widest">{speaker}</span>
      </div>
      <div
        className={`mt-1 ml-4 whitespace-pre-wrap break-words leading-relaxed ${
          turn.error ? "text-amber-200" : "text-zinc-200"
        }`}
      >
        {turn.text || (turn.pending ? "…" : "")}
        {turn.pending && turn.text ? (
          <span className="ml-1 inline-block animate-pulse text-zinc-400">▌</span>
        ) : null}
      </div>
    </div>
  );
}
