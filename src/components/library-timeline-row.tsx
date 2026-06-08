"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/lib/icon";
import type { TimelineEntry } from "@/app/api/library/all/route";
import type { Familiar } from "@/lib/types";

function listIcon(list: TimelineEntry["list"]): IconName {
  if (list === "github") return "ph:github-logo";
  if (list === "reading") return "ph:book-open";
  return "ph:bookmark-simple";
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return "now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

function EntryIcon({ entry }: { entry: TimelineEntry }) {
  const [imgFailed, setImgFailed] = useState(false);
  const favicon = (entry.item as { favicon?: string }).favicon;
  const url = (entry.item as { url?: string }).url;
  const faviconSrc = favicon ||
    (url ? (() => { try { return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=32`; } catch { return null; } })() : null);

  if (faviconSrc && !imgFailed) {
    return (
      <img
        src={faviconSrc}
        alt=""
        width={16}
        height={16}
        className="h-4 w-4 rounded-sm object-contain"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <Icon
      name={listIcon(entry.list)}
      width={15}
      className="text-[var(--text-muted)]"
      aria-hidden
    />
  );
}

export function LibraryTimelineRow({
  entry,
  familiars,
  selected,
  onSelect,
}: {
  entry: TimelineEntry;
  familiars: Familiar[];
  selected: boolean;
  onSelect: () => void;
}) {
  const fam = familiars.find((f) => f.id === entry.familiar);
  const title = entry.item.title || (entry.item as { url?: string }).url || "Untitled";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`focus-ring-inset flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-colors ${
        selected
          ? "border-l-[var(--accent-presence)] bg-[var(--bg-hover)]"
          : "border-l-transparent hover:bg-[var(--bg-hover)]"
      }`}
      aria-current={selected ? "true" : undefined}
    >
      {/* icon / favicon */}
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        <EntryIcon entry={entry} />
      </span>

      {/* title + familiar */}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-[var(--text-primary)]">
          {title}
        </span>
        {fam && (
          <span className="block truncate text-[11px] text-[var(--text-muted)]">
            {fam.display_name}
          </span>
        )}
      </span>

      {/* recency */}
      <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">
        {relTime(entry.capturedAt)}
      </span>
    </button>
  );
}
