"use client";

import { useEffect, useState } from "react";
import { ChatList } from "@/components/chat-list";
import { ChatView } from "@/components/chat-view";
import type { Familiar, SessionRow } from "@/lib/types";

type View =
  | { kind: "list" }
  | { kind: "chat"; sessionId: string | null };

type Props = {
  familiar: Familiar | null;
  sessions: SessionRow[];
  daemonRunning?: boolean;
  onSessionStarted?: () => void;
};

export function ChatRouter({ familiar, sessions, daemonRunning, onSessionStarted }: Props) {
  const [view, setView] = useState<View>({ kind: "list" });

  useEffect(() => {
    setView({ kind: "list" });
  }, [familiar?.id]);

  if (!familiar) {
    return (
      <section className="flex h-full items-center justify-center bg-zinc-950 text-sm text-zinc-500">
        Pick a familiar from the rail to start chatting.
      </section>
    );
  }

  if (view.kind === "list") {
    return (
      <ChatList
        familiar={familiar}
        sessions={sessions}
        daemonRunning={daemonRunning}
        onOpen={(sessionId) => setView({ kind: "chat", sessionId })}
        onNewChat={() => setView({ kind: "chat", sessionId: null })}
      />
    );
  }

  return (
    <ChatView
      familiar={familiar}
      sessionId={view.sessionId}
      daemonRunning={daemonRunning}
      onBack={() => setView({ kind: "list" })}
      onSessionStarted={(sid) => {
        setView({ kind: "chat", sessionId: sid });
        onSessionStarted?.();
      }}
    />
  );
}
