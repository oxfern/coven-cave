"use client";

import { useEffect, useRef, useState } from "react";
import type { Familiar } from "@/lib/types";
import { stripAnsi } from "@/lib/ansi";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

type CovenEvent = {
  seq: number;
  kind: string;
  payload_json: string;
};

type Props = { familiar: Familiar | null };

const POLL_MS = 600;
const PROJECT_ROOT =
  process.env.NEXT_PUBLIC_COVEN_PROJECT_ROOT ??
  "/Users/buns/Documents/GitHub/OpenCoven/coven-cave";

export function ChatPane({ familiar }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSeqRef = useRef<number>(0);
  const assistantIdRef = useRef<string | null>(null);
  const tailRef = useRef<HTMLLIElement | null>(null);

  // reset chat when active familiar changes
  useEffect(() => {
    setMessages([]);
    setSessionId(null);
    setError(null);
    lastSeqRef.current = 0;
    assistantIdRef.current = null;
  }, [familiar?.id]);

  // poll events for the active session
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/events?afterSeq=${lastSeqRef.current}&limit=500`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as { ok: boolean; events?: CovenEvent[]; error?: string };
        if (!json.ok || cancelled) return;
        const events = json.events ?? [];
        if (!events.length) return;

        let chunk = "";
        for (const ev of events) {
          if (ev.seq > lastSeqRef.current) lastSeqRef.current = ev.seq;
          if (ev.kind !== "output") continue;
          try {
            const payload = JSON.parse(ev.payload_json) as { data?: string };
            if (payload.data) chunk += payload.data;
          } catch {
            /* ignore malformed */
          }
        }

        if (chunk) appendAssistant(chunk);
      } catch {
        /* transient — next tick will retry */
      }
    };

    tick();
    const t = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [sessionId]);

  useEffect(() => {
    tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const appendAssistant = (text: string) => {
    const clean = stripAnsi(text);
    if (!clean.trim() && !clean.includes("\n")) return;
    setMessages((prev) => {
      const existingId = assistantIdRef.current;
      if (existingId && prev.length && prev[prev.length - 1].id === existingId) {
        const next = prev.slice(0, -1);
        next.push({ ...prev[prev.length - 1], content: prev[prev.length - 1].content + clean });
        return next;
      }
      const id = crypto.randomUUID();
      assistantIdRef.current = id;
      return [...prev, { id, role: "assistant", content: clean }];
    });
  };

  const ensureSession = async (prompt: string): Promise<string | null> => {
    if (sessionId) return sessionId;
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectRoot: PROJECT_ROOT, harness: "codex", prompt }),
    });
    const json = (await res.json()) as { ok: boolean; session?: { id: string }; error?: string };
    if (!json.ok || !json.session) {
      setError(json.error ?? "session create failed");
      return null;
    }
    setSessionId(json.session.id);
    return json.session.id;
  };

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || !familiar || sending) return;
    setSending(true);
    setError(null);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
    ]);
    assistantIdRef.current = null;

    try {
      const sid = await ensureSession(trimmed);
      if (!sid) return;

      // If this was the first message, the daemon used `prompt` to start the
      // session — no follow-up input needed. Otherwise push it as live input.
      if (sid !== sessionId) {
        // first send: prompt already consumed at session create
      } else {
        const res = await fetch(`/api/sessions/${sid}/input`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: trimmed + "\n" }),
        });
        const json = (await res.json()) as { ok: boolean; error?: string };
        if (!json.ok) setError(json.error ?? "input send failed");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="flex h-full flex-col bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        {familiar ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg shrink-0">{familiar.emoji}</span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{familiar.display_name}</div>
              <div className="truncate text-xs text-zinc-500">{familiar.role}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-zinc-500">No familiar selected</div>
        )}
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          {sessionId ? (
            <span className="font-mono text-emerald-400/80">live</span>
          ) : (
            <span>idle</span>
          )}
          <span>codex</span>
        </div>
      </header>

      <ol className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <li className="text-center text-xs text-zinc-600">
            {familiar
              ? `Start a conversation with ${familiar.display_name}.`
              : "Pick a familiar from the rail."}
          </li>
        ) : null}
        {messages.map((m) => (
          <li
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-violet-600/80 text-white"
                  : "bg-zinc-800/80 font-mono text-[12px] text-zinc-100"
              }`}
            >
              {m.content}
            </div>
          </li>
        ))}
        <li ref={tailRef} />
      </ol>

      {error ? (
        <div className="border-t border-amber-700/40 bg-amber-900/20 px-4 py-1.5 text-xs text-amber-200">
          {error}
        </div>
      ) : null}

      <footer className="border-t border-zinc-800 p-3">
        <div className="flex items-end gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={familiar ? `Message ${familiar.display_name}…` : "Pick a familiar to chat…"}
            rows={1}
            disabled={!familiar || sending}
            className="flex-1 resize-none bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!familiar || sending}
            className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </footer>
    </section>
  );
}
