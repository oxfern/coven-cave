"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { DaemonStatus, Familiar } from "@/lib/types";
import type { InboxItem } from "@/lib/cave-inbox";
import type { InboxPrefs } from "@/lib/cave-inbox-prefs";
import { NotificationBell } from "@/components/notification-bell";
import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/lib/icon";

export type Mode =
  | "agents"
  | "board"
  | "inbox"
  | "plugins"
  | "browser"
  | "schedules"
  | "terminal"
  | "projects"
  | "home"
  | "github"
  | "calendar"
  | "library";

type Props = {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onOpenSearch: () => void;
  onOpenFamiliarChat?: () => void;
  inboxBadgeCount?: number;
  onRunningChange?: (running: boolean) => void;
  inboxItems?: InboxItem[];
  inboxPrefs?: InboxPrefs;
  familiars?: Familiar[];
  activeFamiliar?: Familiar | null;
  onOpenInbox?: () => void;
  onOpenInboxItem?: (item: InboxItem) => void;
  onPrefsChanged?: () => void;
};

const MODE_LABEL: Record<Mode, string> = {
  home: "Home",
  agents: "Agents",
  board: "Tasks",
  inbox: "Inbox",
  plugins: "Plugins",
  browser: "Browser",
  schedules: "Automations",
  terminal: "Terminal",
  projects: "Projects",
  github: "GitHub",
  calendar: "Calendar",
  library: "Library",
};

export function DaemonBar({
  mode,
  onModeChange: _onModeChange,
  onOpenSearch,
  onOpenFamiliarChat,
  inboxBadgeCount = 0,
  onRunningChange,
  inboxItems = [],
  inboxPrefs,
  familiars = [],
  activeFamiliar = null,
  onOpenInbox,
  onOpenInboxItem,
  onPrefsChanged,
}: Props) {
  const router = useRouter();

  // Poll daemon status silently — other panes react via onRunningChange
  useEffect(() => {
    if (!onRunningChange) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/daemon/status", { cache: "no-store" });
        const json = (await res.json()) as DaemonStatus;
        if (!cancelled) onRunningChange(json.running === true);
      } catch {
        if (!cancelled) onRunningChange(false);
      }
    };
    void tick();
    const t = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, [onRunningChange]);

  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b border-[var(--border-hairline)] bg-[var(--bg-raised)]/60 px-3">

      {/* Left — brand + current view */}
      <div className="flex w-[160px] min-w-0 shrink-0 items-center gap-2 text-[12px]">
        <span className="bg-gradient-to-r from-[var(--accent-presence)] to-[var(--accent-presence-soft)] bg-clip-text font-semibold tracking-tight text-transparent">
          CovenCave
        </span>
        <span className="text-[var(--text-muted)]" aria-hidden>·</span>
        <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">
          {MODE_LABEL[mode] ?? mode}
        </span>
        {mode === "inbox" && inboxBadgeCount > 0 ? (
          <span
            className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--accent-presence)_30%,transparent)] px-1.5 text-[10px] font-semibold text-[var(--text-primary)]"
            aria-label={`${inboxBadgeCount} unread inbox items`}
          >
            {inboxBadgeCount}
          </span>
        ) : null}
      </div>

      {/* Center — familiar chat trigger */}
      <button
        type="button"
        onClick={() => {
          if (onOpenFamiliarChat) onOpenFamiliarChat();
          else onOpenSearch();
        }}
        title="Open familiar chat"
        aria-label="Open familiar chat"
        className="focus-ring flex flex-1 items-center gap-2 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-base)] px-3 py-1 text-[12px] text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
      >
        <Icon name="ph:chats" width={12} className="shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">
          {activeFamiliar ? `Chat with ${activeFamiliar.display_name}` : "Chat with familiars"}
        </span>
        <kbd className="hidden rounded bg-[var(--bg-raised)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] sm:inline">
          ⌘J
        </kbd>
      </button>

      {/* Right — notifications + settings */}
      <div className="flex w-[160px] shrink-0 items-center justify-end gap-1">
        {onOpenInbox && inboxPrefs && onPrefsChanged ? (
          <NotificationBell
            items={inboxItems}
            familiars={familiars}
            prefs={inboxPrefs}
            badgeCount={inboxBadgeCount}
            onOpenInbox={onOpenInbox}
            onOpenItem={onOpenInboxItem}
            onPrefsChanged={onPrefsChanged}
          />
        ) : null}

        <IconButton
          icon="ph:gear-six"
          aria-label="Settings"
          title="Settings"
          onClick={() => router.push("/settings")}
        />
      </div>
    </header>
  );
}
