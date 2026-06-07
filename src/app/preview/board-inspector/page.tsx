"use client";

import { useState } from "react";
import { BoardInspector } from "@/components/board-inspector";
import type { Card } from "@/lib/cave-board-types";
import type { Familiar, SessionRow } from "@/lib/types";
import "@/styles/board.css";

const FAMILIARS: Familiar[] = [
  { id: "fam-sage", display_name: "Sage", role: "Strategist", icon: "ph:cat-fill" },
  { id: "fam-ember", display_name: "Ember", role: "Builder", icon: "ph:fire-fill" },
  { id: "fam-tide", display_name: "Tide", role: "Reviewer", icon: "ph:wave-sine-bold" },
];

const SESSIONS: SessionRow[] = [];

const NOW = new Date("2026-06-06T15:00:00Z").toISOString();

const CARD: Card = {
  id: "card-demo",
  title: "Smoke test card",
  notes: "",
  status: "done",
  priority: "high",
  familiarId: "fam-sage",
  sessionId: null,
  cwd: null,
  links: [],
  github: [],
  labels: [],
  createdAt: NOW,
  updatedAt: NOW,
  lifecycle: "completed",
  lifecycleAt: NOW,
  retryCount: 0,
  maxRetries: 2,
  steps: [],
};

export default function Page() {
  const [card, setCard] = useState<Card>(CARD);
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base, #111)" }}>
      <BoardInspector
        card={card}
        familiars={FAMILIARS}
        sessions={SESSIONS}
        onClose={() => {}}
        onPatch={(_id, patch) => setCard((c) => ({ ...c, ...patch }))}
        onMoveStatus={(_id, status) => setCard((c) => ({ ...c, status }))}
        onDelete={async () => {}}
        onCardReplaced={(next) => setCard(next)}
      />
    </div>
  );
}
