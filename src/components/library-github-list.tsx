"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/lib/icon";
import type { LibraryGitHubItem, GitHubItemKind } from "@/lib/library-types";

// ── Helpers ────────────────────────────────────────────────────────────────

type SortKey = "title" | "repo" | "savedAt";
type SortDir = "asc" | "desc";
type GroupBy = "repo" | "kind" | "none";

function relTime(iso: string): string {
  try {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return `${Math.round(s)}s`;
    if (s < 3600) return `${Math.round(s / 60)}m`;
    if (s < 86400) return `${Math.round(s / 3600)}h`;
    const d = Math.round(s / 86400);
    return d < 30 ? `${d}d` : `${Math.round(d / 30)}mo`;
  } catch { return ""; }
}

function sortItems(items: LibraryGitHubItem[], key: SortKey, dir: SortDir): LibraryGitHubItem[] {
  return [...items].sort((a, b) => {
    let cmp = 0;
    if (key === "title") cmp = a.title.localeCompare(b.title);
    else if (key === "repo") cmp = a.repo.localeCompare(b.repo);
    else cmp = a.savedAt.localeCompare(b.savedAt);
    return dir === "asc" ? cmp : -cmp;
  });
}

function groupItems(items: LibraryGitHubItem[], by: GroupBy): { key: string; label: string; items: LibraryGitHubItem[] }[] {
  if (by === "none") return [{ key: "all", label: "", items }];
  const map = new Map<string, LibraryGitHubItem[]>();
  for (const item of items) {
    const key = by === "repo" ? item.repo : item.kind;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({ key, label: key, items }));
}

function kindIcon(kind: GitHubItemKind) {
  switch (kind) {
    case "repo":        return <Icon name="ph:github-logo" width={12} />;
    case "issue":       return <Icon name="ph:git-diff" width={12} />;
    case "pr":          return <Icon name="ph:git-pull-request" width={12} />;
    case "discussion":  return <Icon name="ph:chat-centered-text" width={12} />;
  }
}

function stateStyle(state?: LibraryGitHubItem["state"]): React.CSSProperties & { label: string } {
  if (state === "open")   return { color: "#34d399", label: "open" };
  if (state === "merged") return { color: "oklch(0.65 0.18 280)", label: "merged" };
  if (state === "closed") return { color: "#f87171", label: "closed" };
  return { color: "var(--text-muted)", label: "—" };
}

/**
 * Try to parse a GitHub URL into { repo, kind, number, title }.
 * Falls back gracefully if the URL doesn't match expected patterns.
 */
function parseGitHubUrl(url: string): { repo: string; kind: GitHubItemKind; number?: number } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("github.com")) return null;
    const parts = u.pathname.replace(/^\//, "").split("/");
    if (parts.length < 2) return null;
    const repo = `${parts[0]}/${parts[1]}`;
    if (parts.length === 2) return { repo, kind: "repo" };
    if (parts[2] === "issues" && parts[3]) return { repo, kind: "issue", number: parseInt(parts[3], 10) };
    if (parts[2] === "pull" && parts[3]) return { repo, kind: "pr", number: parseInt(parts[3], 10) };
    if (parts[2] === "discussions" && parts[3]) return { repo, kind: "discussion", number: parseInt(parts[3], 10) };
    return { repo, kind: "repo" };
  } catch { return null; }
}

// ── Add form ───────────────────────────────────────────────────────────────

function AddGitHubForm({ onAdd, onCancel }: {
  onAdd: (url: string, title: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  function handleUrlBlur() {
    if (url && !title) {
      const parsed = parseGitHubUrl(url);
      if (parsed) {
        const label = parsed.number ? `${parsed.repo}#${parsed.number}` : parsed.repo;
        setTitle(label);
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || !title.trim()) return;
    onAdd(url.trim(), title.trim());
  }

  return (
    <form className="library-list-add-form" onSubmit={handleSubmit}>
      <input
        autoFocus
        className="board-drawer-field-input library-list-add-input"
        placeholder="https://github.com/owner/repo/issues/123"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={handleUrlBlur}
        type="url"
      />
      <input
        className="board-drawer-field-input library-list-add-input"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button type="submit" className="board-toolbar-btn board-toolbar-btn--active">Save</button>
      <button type="button" className="board-toolbar-btn" onClick={onCancel}>Cancel</button>
    </form>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type Props = {
  selectedId: string | null;
  onSelect: (item: LibraryGitHubItem) => void;
  onDelete?: (id: string) => void;
};

const COLS: { key: SortKey; label: string; width?: string }[] = [
  { key: "title",   label: "Title" },
  { key: "repo",    label: "Repo",    width: "150px" },
  { key: "savedAt", label: "Saved",   width: "80px" },
];

export function LibraryGitHubList({ selectedId, onSelect, onDelete }: Props) {
  const [items, setItems] = useState<LibraryGitHubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("savedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [groupBy, setGroupBy] = useState<GroupBy>("repo");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/library/github", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setItems(json.items ?? []);
    } catch { /* keep */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sorted = useMemo(() => sortItems(items, sortKey, sortDir), [items, sortKey, sortDir]);
  const groups = useMemo(() => groupItems(sorted, groupBy), [sorted, groupBy]);

  function handleCol(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }

  async function handleAdd(url: string, title: string) {
    setAdding(false);
    const res = await fetch("/api/library/github", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, title }),
    });
    const json = await res.json();
    if (json.ok) setItems((prev) => [json.item, ...prev]);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/library/github?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
    onDelete?.(id);
  }

  return (
    <div className="library-list-shell">
      {/* Header */}
      <div className="library-list-header">
        <span className="library-list-header-title">
          <Icon name="ph:github-logo" width={14} />
          GitHub
          <span className="board-table-group-badge">{items.length}</span>
        </span>
        <div className="library-list-header-controls">
          <select
            className="board-toolbar-select"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          >
            <option value="repo">Group: Repo</option>
            <option value="kind">Group: Kind</option>
            <option value="none">No grouping</option>
          </select>
          <button type="button" className="board-toolbar-btn" onClick={() => setAdding((v) => !v)}>
            <Icon name="ph:plus" width={12} /> Add
          </button>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <AddGitHubForm onAdd={handleAdd} onCancel={() => setAdding(false)} />
      )}

      {/* Table */}
      {loading ? (
        <div className="library-list-empty">Loading…</div>
      ) : items.length === 0 ? (
        <div className="library-list-empty">No GitHub items saved yet. Add one above.</div>
      ) : (
        <div className="board-table-wrap">
          <table className="board-table">
            <thead>
              <tr>
                {COLS.map((col) => (
                  <th key={col.key} style={col.width ? { width: col.width } : undefined}
                    className={sortKey === col.key ? "sorted" : ""}
                    onClick={() => handleCol(col.key)}>
                    {col.label}
                    <span className="board-table-sort-icon">
                      {sortKey === col.key
                        ? <Icon name={sortDir === "asc" ? "ph:caret-up" : "ph:caret-down-fill"} width={9} />
                        : <Icon name="ph:caret-up-down" width={9} />}
                    </span>
                  </th>
                ))}
                <th style={{ width: "80px" }}>Kind</th>
                <th style={{ width: "70px" }}>State</th>
                <th style={{ width: "160px" }}>Labels</th>
                <th style={{ width: "32px" }} />
              </tr>
            </thead>
            <tbody>
              {groups.map(({ key, label, items: gi }) => (
                <React.Fragment key={key}>
                  {groupBy !== "none" && (
                    <tr className="board-table-group-row" onClick={() => toggleGroup(key)}>
                      <td colSpan={7}>
                        <span className="board-table-group-caret">
                          <Icon name={collapsed.has(key) ? "ph:caret-right" : "ph:caret-down"} width={10} />
                        </span>
                        {label}
                        <span className="board-table-group-badge">{gi.length}</span>
                      </td>
                    </tr>
                  )}
                  {!collapsed.has(key) && gi.map((item) => {
                    const st = stateStyle(item.state);
                    return (
                      <tr key={item.id}
                        className={item.id === selectedId ? "selected" : ""}
                        onClick={() => onSelect(item)}>
                        <td>
                          <span className="board-table-title">{item.title}</span>
                          {item.number && (
                            <div className="board-table-muted" style={{ marginTop: 2 }}>
                              {item.repo}#{item.number}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="board-table-muted">{item.repo}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="board-table-muted">{relTime(item.savedAt)}</span>
                        </td>
                        <td>
                          <span className="board-table-muted library-source-type">
                            {kindIcon(item.kind)}
                            <span style={{ marginLeft: 3 }}>{item.kind}</span>
                          </span>
                        </td>
                        <td>
                          <span className="library-gh-state-dot" style={{ color: st.color }}>
                            ● {st.label}
                          </span>
                        </td>
                        <td>
                          <div className="library-tag-chips">
                            {item.labels.slice(0, 3).map((l: string) => (
                              <span key={l} className="library-doclist-tag">{l}</span>
                            ))}
                            {item.labels.length > 3 && (
                              <span className="board-table-muted">+{item.labels.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td onClick={(e) => { e.stopPropagation(); void handleDelete(item.id); }}>
                          <span className="library-row-delete" title="Remove">
                            <Icon name="ph:x" width={11} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
