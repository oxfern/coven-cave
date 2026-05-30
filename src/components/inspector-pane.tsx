"use client";

import { useState } from "react";

type Tab = "memory" | "tools";

const MEMORY_STUB = [
  { kind: "user", title: "Val prefers warm-but-direct tone" },
  { kind: "feedback", title: "Verified commits only" },
  { kind: "project", title: "OpenCoven Feedback is canonical hub" },
];

const TOOLS_STUB = [
  { name: "browser", status: "ready" },
  { name: "memory_search", status: "ready" },
  { name: "wiki_get", status: "ready" },
  { name: "sessions_spawn", status: "ready" },
];

export function InspectorPane() {
  const [tab, setTab] = useState<Tab>("memory");

  return (
    <aside className="flex h-full flex-col border-l border-zinc-800 bg-zinc-900/40">
      <nav className="flex border-b border-zinc-800 text-xs">
        {(["memory", "tools"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-4 py-3 uppercase tracking-widest transition-colors ${
              tab === t
                ? "border-b-2 border-violet-500 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-4 text-sm">
        {tab === "memory" ? (
          <ul className="space-y-2">
            {MEMORY_STUB.map((m, i) => (
              <li key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">{m.kind}</div>
                <div className="text-zinc-200">{m.title}</div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-1 font-mono text-xs">
            {TOOLS_STUB.map((t) => (
              <li key={t.name} className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-zinc-800/40">
                <span className="text-zinc-200">{t.name}</span>
                <span className="text-emerald-400">{t.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
