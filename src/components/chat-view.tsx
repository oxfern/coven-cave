"use client";

import { useEffect, useRef, useState } from "react";
import type { Familiar } from "@/lib/types";

const PROJECT_ROOT =
  process.env.NEXT_PUBLIC_COVEN_PROJECT_ROOT ??
  "/Users/buns/Documents/GitHub/OpenCoven/coven-cave";

type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
  error?: boolean;
};

type Props = {
  familiar: Familiar;
  sessionId: string | null;
  onSessionStarted?: (sessionId: string) => void;
  onBack?: () => void;
};

type StreamEvent =
  | { kind: "session"; sessionId: string }
  | { kind: "user"; text: string }
  | { kind: "assistant_chunk"; text: string }
  | { kind: "done"; durationMs?: number; isError?: boolean; sessionId?: string }
  | { kind: "error"; message: string };

export function ChatView({ familiar, sessionId, onSessionStarted, onBack }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentSessionRef = useRef<string | null>(sessionId);
  const tailRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Load persisted history for an attached session
  useEffect(() => {
    currentSessionRef.current = sessionId;
    if (!sessionId) {
      setTurns([]);
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
                text: t.text,
              })),
          );
        }
      } catch {
        /* fall through */
      }
    })();
  }, [sessionId]);

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
    const assistantTurn: Turn = { id: assistantId, role: "assistant", text: "", pending: true };
    setTurns((prev) => [...prev, userTurn, assistantTurn]);

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
            t.id === assistantId
              ? { ...t, pending: false, error: ev.isError ?? false }
              : t,
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

  return (
    <section className="flex h-full flex-col bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {onBack ? (
            <button
              onClick={onBack}
              className="shrink-0 rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-800"
              title="Back to chats"
            >
              ← chats
            </button>
          ) : null}
          <span className="shrink-0 text-lg">{familiar.emoji}</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{familiar.display_name}</div>
            <div className="truncate text-[11px] text-zinc-500">
              {familiar.harness ?? "?"} ·{" "}
              <span className="font-mono">{familiar.model ?? "?"}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {busy ? (
            <span className="font-mono text-amber-400/80">streaming…</span>
          ) : currentSessionRef.current ? (
            <span className="font-mono text-emerald-400/80">● live</span>
          ) : (
            <span className="font-mono">new</span>
          )}
        </div>
      </header>

      <ol className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
        {turns.length === 0 ? (
          <li className="mx-auto max-w-md py-10 text-center text-sm text-zinc-600">
            Start a chat with {familiar.display_name}. Runs on{" "}
            <span className="font-mono text-zinc-400">{familiar.harness}</span> via the{" "}
            <span className="font-mono text-zinc-400">coven</span> CLI under the hood.
          </li>
        ) : null}
        {turns.map((t) => (
          <li key={t.id} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                t.role === "user"
                  ? "bg-violet-600/80 text-white"
                  : t.error
                    ? "border border-amber-700/40 bg-amber-900/20 text-amber-200"
                    : "bg-zinc-800/80 text-zinc-100"
              }`}
            >
              {t.text || (t.pending ? "…" : "")}
              {t.pending && t.text ? (
                <span className="ml-1 inline-block animate-pulse text-zinc-400">▌</span>
              ) : null}
            </div>
          </li>
        ))}
        <div ref={tailRef} />
      </ol>

      {error ? (
        <div className="border-t border-amber-700/40 bg-amber-900/20 px-4 py-1.5 text-xs text-amber-200">
          {error}
        </div>
      ) : null}

      <footer className="border-t border-zinc-800 p-3">
        <div className="flex items-end gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
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
            placeholder={`Message ${familiar.display_name}…`}
            rows={1}
            disabled={busy}
            className="flex-1 resize-none bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500 disabled:opacity-50"
          />
          <button
            onClick={() => void send()}
            disabled={busy || !input.trim()}
            className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
      </footer>
    </section>
  );
}
