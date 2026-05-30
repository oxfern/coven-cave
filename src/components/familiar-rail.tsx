"use client";

import { useState } from "react";

type Familiar = {
  id: string;
  name: string;
  role: string;
  glyph: string;
  harness: string;
  model: string;
};

const FAMILIARS: Familiar[] = [
  { id: "nova", name: "Nova", role: "Companion", glyph: "✨", harness: "openclaw", model: "claude-opus-4-7" },
  { id: "sage", name: "Sage", role: "Research", glyph: "🜂", harness: "openclaw", model: "openai/gpt-5.5" },
  { id: "echo", name: "Echo", role: "Memory", glyph: "🜄", harness: "openclaw", model: "openai/gpt-5.5" },
  { id: "cody", name: "Cody", role: "Code", glyph: "🜔", harness: "claude-code", model: "claude-sonnet-4-6" },
  { id: "charm", name: "Charm", role: "Voice", glyph: "🜍", harness: "openclaw", model: "openai/gpt-5.4-mini" },
  { id: "astra", name: "Astra", role: "Navigator", glyph: "🜚", harness: "openclaw", model: "openai/gpt-5.5" },
];

export function FamiliarRail() {
  const [active, setActive] = useState<string>("nova");
  const current = FAMILIARS.find((f) => f.id === active)!;

  return (
    <aside className="flex h-full flex-col border-r border-zinc-800 bg-zinc-900/40">
      <header className="border-b border-zinc-800 px-4 py-3">
        <div className="text-xs uppercase tracking-widest text-zinc-500">Coven</div>
        <div className="text-sm font-semibold text-zinc-100">Familiars</div>
      </header>

      <ul className="flex-1 overflow-y-auto py-2">
        {FAMILIARS.map((f) => (
          <li key={f.id}>
            <button
              onClick={() => setActive(f.id)}
              className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                active === f.id
                  ? "bg-zinc-800/80 text-zinc-50"
                  : "text-zinc-300 hover:bg-zinc-800/40"
              }`}
            >
              <span className="text-lg">{f.glyph}</span>
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-zinc-500">{f.role}</span>
            </button>
          </li>
        ))}
      </ul>

      <section className="border-t border-zinc-800 px-4 py-3 text-xs">
        <div className="mb-2 text-zinc-500">Configurator</div>
        <dl className="grid grid-cols-[64px_1fr] gap-y-1 text-zinc-300">
          <dt className="text-zinc-500">Harness</dt>
          <dd className="font-mono">{current.harness}</dd>
          <dt className="text-zinc-500">Model</dt>
          <dd className="font-mono truncate">{current.model}</dd>
        </dl>
      </section>
    </aside>
  );
}
