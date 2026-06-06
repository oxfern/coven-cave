"use client";

import type { LibraryCollection } from "@/lib/library-types";

type Props = {
  collections: LibraryCollection[];
  activeId: string;
  docCounts: Record<string, number>;
  onSelect: (id: string) => void;
};

export function LibraryCollectionRail({ collections, activeId, docCounts, onSelect }: Props) {
  return (
    <div className="library-rail">
      <div className="library-rail-header">Collections</div>
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
              {count > 0 && (
                <span className="library-rail-badge">{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
