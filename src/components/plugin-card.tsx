"use client";

import { Icon } from "@/lib/icon";

export type HarnessReport = {
  id: string;
  label: string;
  binary: string;
  chatSupported: boolean;
  installed: boolean;
  path: string | null;
  version: string | null;
};

const HARNESS_TAGLINE: Record<string, string> = {
  codex: "Run Codex sessions from this Cave",
  claude: "Drive Claude Code from a familiar",
  openclaw: "Bring OpenClaw into the Coven",
  copilot: "Wire up GitHub Copilot CLI",
  opencode: "Run OpenCode locally",
  gemini: "Talk to Google Gemini CLI",
  hermes: "Light a Hermes runtime",
  openhands: "Open up OpenHands tasks",
  aider: "Pair with Aider in-repo",
};

export function PluginCard({
  harness,
  onLaunch,
  onClick,
}: {
  harness: HarnessReport;
  onLaunch: () => void;
  onClick?: () => void;
}) {
  const initial = (harness.label.match(/[a-z0-9]/i)?.[0] ?? "?").toUpperCase();
  const tagline =
    HARNESS_TAGLINE[harness.id] ?? `Run ${harness.label} from a familiar`;

  return (
    <button
      type="button"
      onClick={onClick ?? onLaunch}
      className="group flex min-w-0 w-full items-center gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Icon */}
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-raised)] text-[15px] font-semibold text-[var(--text-primary)]">
        {initial}
      </span>

      {/* Name + tagline */}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">
          {harness.label}
        </span>
        <span className="block truncate text-[12px] text-[var(--text-muted)]">
          {tagline}
        </span>
      </span>

      {/* Status icon flush right */}
      {harness.installed ? (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--accent-presence)]"
          title="Installed"
          aria-label="Installed"
        >
          <Icon name="ph:check-bold" width={14} />
        </span>
      ) : (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-hairline)] text-[var(--text-muted)] transition-colors group-hover:border-[var(--border-strong)] group-hover:text-[var(--text-primary)]"
          title="Not installed"
          aria-label="Not installed"
        >
          <Icon name="ph:plus-bold" width={12} />
        </span>
      )}
    </button>
  );
}
