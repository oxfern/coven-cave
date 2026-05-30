"use client";

import { useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SEED: Message[] = [
  {
    id: "seed-1",
    role: "assistant",
    content:
      "Welcome to CovenBoard. Pick a familiar from the rail. /commands and @mentions are coming.",
  },
];

export function ChatPane() {
  const [messages, setMessages] = useState<Message[]>(SEED);
  const [input, setInput] = useState("");

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "(streaming not wired yet — v0 stub)",
      },
    ]);
    setInput("");
  };

  return (
    <section className="flex h-full flex-col bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <div>
            <div className="text-sm font-semibold">Nova</div>
            <div className="text-xs text-zinc-500">openclaw · claude-opus-4-7</div>
          </div>
        </div>
        <div className="text-xs text-zinc-500">⌘K · slash · mentions</div>
      </header>

      <ol className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <li
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-violet-600/80 text-white"
                  : "bg-zinc-800/80 text-zinc-100"
              }`}
            >
              {m.content}
            </div>
          </li>
        ))}
      </ol>

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
            placeholder="Message the coven…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <button
            onClick={send}
            className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-500"
          >
            Send
          </button>
        </div>
      </footer>
    </section>
  );
}
