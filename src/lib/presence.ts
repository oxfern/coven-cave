import type { Familiar, SessionRow } from "@/lib/types";

export type PresenceState =
  | "focused"
  | "blocked"
  | "dreaming"
  | "idle"
  | "offline"
  | "remote"
  | "failed"
  | "missing";

export type Presence = {
  state: PresenceState;
  label: string;
  /** Tailwind classes for the pill background + text. */
  pill: string;
  /** Tailwind class for the small status dot. */
  dot: string;
};

/**
 * Harness IDs that indicate a familiar lives in a remote lane (e.g. Telegram
 * via OpenClaw) and has no local daemon session. These should read as
 * "remote" rather than "offline" — the familiar is reachable, just not via
 * the local Coven daemon.
 */
export const REMOTE_HARNESSES = new Set(["openclaw", "telegram", "signal", "whatsapp"]);

const PRESETS: Record<PresenceState, Pick<Presence, "label" | "pill" | "dot">> = {
  focused: { label: "focused", pill: "bg-[color-mix(in_oklch,var(--color-success)_15%,transparent)] text-[var(--color-success)]", dot: "bg-[var(--color-success)]" },
  blocked: { label: "needs reply", pill: "bg-[color-mix(in_oklch,var(--color-warning)_20%,transparent)] text-[var(--color-warning)]", dot: "bg-[var(--color-warning)]" },
  dreaming: { label: "dreaming", pill: "bg-[color-mix(in_oklch,var(--accent-presence)_15%,transparent)] text-[var(--accent-presence)]", dot: "bg-[var(--accent-presence)]" },
  failed: { label: "failed", pill: "bg-[color-mix(in_oklch,var(--color-danger)_20%,transparent)] text-[var(--color-danger)]", dot: "bg-[var(--color-danger)]" },
  offline: { label: "offline", pill: "bg-[var(--bg-raised)]/60 text-[var(--text-secondary)]", dot: "bg-[var(--text-muted)]" },
  remote:  { label: "remote",  pill: "bg-[color-mix(in_oklch,var(--accent-presence-soft)_30%,transparent)] text-[var(--accent-presence-soft)]",  dot: "bg-[var(--accent-presence-soft)]" },
  missing: { label: "missing", pill: "bg-[color-mix(in_oklch,var(--color-danger)_30%,transparent)] text-[var(--color-danger)]", dot: "bg-[var(--color-danger)]" },
  idle: { label: "idle", pill: "bg-[var(--bg-raised)] text-[var(--text-secondary)]", dot: "bg-[var(--text-muted)]" },
};

type Args = {
  familiar: Familiar;
  sessions: SessionRow[];
  needsReply: boolean;
  harnessInstalled?: boolean;
  /** True when the harness is installed locally. Remote-only harnesses pass false here. */
  isRemoteHarness?: boolean;
};

const DREAM_WINDOW_HOURS = 24;

/** Crude "X minutes ago" → minutes converter that handles the daemon's
 * memory_freshness format ("5m ago", "3h ago", "2d ago"). */
function freshMinutes(raw?: string): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+)\s*([smhd])/i);
  if (!m) return null;
  const value = parseInt(m[1], 10);
  switch (m[2].toLowerCase()) {
    case "s":
      return value / 60;
    case "m":
      return value;
    case "h":
      return value * 60;
    case "d":
      return value * 60 * 24;
    default:
      return null;
  }
}

export function computePresence({ familiar, sessions, needsReply, harnessInstalled, isRemoteHarness }: Args): Presence {
  const mine = sessions.filter((s) => s.familiarId === familiar.id);
  const running = mine.some((s) => s.status === "running");
  const recentlyFailed = mine
    .filter((s) => s.status === "failed")
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))[0];

  // Was the most recent session a failure in the last hour?
  const failedFresh =
    recentlyFailed &&
    Date.now() - new Date(recentlyFailed.updated_at).getTime() < 60 * 60 * 1000 &&
    !running;

  const onlineByDaemon = familiar.status === "online";
  const dreamMinutes = freshMinutes(familiar.memory_freshness);
  const dreaming =
    dreamMinutes != null && dreamMinutes < DREAM_WINDOW_HOURS * 60 && !running && !needsReply;

  // Remote-only harnesses (openclaw/Telegram lanes) are never "offline" —
  // they simply have no local daemon session. Show "remote" instead.
  if (isRemoteHarness) {
    if (needsReply) return { state: "blocked", ...PRESETS.blocked };
    return { state: "remote", ...PRESETS.remote };
  }

  if (harnessInstalled === false) return { state: "missing", ...PRESETS.missing };
  if (needsReply) return { state: "blocked", ...PRESETS.blocked };
  if (running) return { state: "focused", ...PRESETS.focused };
  if (failedFresh) return { state: "failed", ...PRESETS.failed };
  if (dreaming) return { state: "dreaming", ...PRESETS.dreaming };
  if (!onlineByDaemon && mine.length === 0) return { state: "offline", ...PRESETS.offline };
  return { state: "idle", ...PRESETS.idle };
}
