"use client";

import { Icon } from "@/lib/icon";
import type { SkillEntry } from "@/components/skill-detail-drawer";

export function SkillCard({
  skill,
  onClick,
}: {
  skill: SkillEntry;
  onClick: () => void;
}) {
  const initial = (skill.name.match(/[a-z0-9]/i)?.[0] ?? "?").toUpperCase();
  const meta =
    [skill.owner, skill.category].filter(Boolean).join(" · ") || "Skill";

  return (
    <button
      onClick={onClick}
      className="group flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-4 py-3 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-raised)]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-raised)] text-[15px] font-semibold text-[var(--text-primary)]">
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">
          {skill.name}
        </span>
        <span className="block truncate text-[12px] text-[var(--text-muted)]">
          {meta}
        </span>
        {skill.description && (
          <span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)] opacity-70">
            {skill.description}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {skill.version && (
          <span className="rounded-full bg-[var(--bg-raised)] px-1.5 py-0.5 text-[9px] text-[var(--text-muted)]">
            v{skill.version}
          </span>
        )}
        <Icon
          name="ph:info-bold"
          width={13}
          className="text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100"
        />
      </span>
    </button>
  );
}
