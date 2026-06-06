"use client";

import { Icon } from "@/lib/icon";
import type { IconName } from "@/lib/icon";
import type { LibraryCollection, LibrarySectionKind } from "@/lib/library-types";

type ListSection = {
  id: LibrarySectionKind;
  label: string;
  icon: IconName;
};

const LIST_SECTIONS: ListSection[] = [
  { id: "bookmarks", label: "Bookmarks", icon: "ph:bookmark-simple" },
  { id: "reading",   label: "Reading",   icon: "ph:book-open" },
  { id: "github",    label: "GitHub",    icon: "ph:github-logo" },
];

type Props = {
  collections: LibraryCollection[];
  activeId: string;
  docCounts: Record<string, number>;
  onSelect: (id: string) => void;
};

export function LibraryCollectionRail({ collections, activeId, docCounts, onSelect }: Props) {
  return (
    <div className="library-rail">
      <div className="library-rail-header">Research</div>
      <div className="library-rail-list">
        {collections.map((col) => {
          const count = docCounts[col.id] ?? 0;
          const isActive = col.id === activeId;
          return (
            <button
              key={col.id}
              type="button"
              className={`library-rail-item${isActive ? " library-rail-item--active" : ""}`}
              onClick={() => onSelect(col.id)}
            >
              <span className="library-rail-label">{col.label}</span>
              {count > 0 && <span className="library-rail-badge">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Divider between Research and Lists */}
      <div style={{ height: 1, margin: "8px 12px", background: "var(--border-hairline)" }} />

      <div className="library-rail-header">Lists</div>
      <div className="library-rail-list">
        {LIST_SECTIONS.map((section) => {
          const isActive = section.id === activeId;
          return (
            <button
              key={section.id}
              type="button"
              className={`library-rail-item${isActive ? " library-rail-item--active" : ""}`}
              onClick={() => onSelect(section.id)}
            >
              <span style={{ marginRight: 6, flexShrink: 0, display: "inline-flex" }}><Icon name={section.icon} width={13} /></span>
              <span className="library-rail-label">{section.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
