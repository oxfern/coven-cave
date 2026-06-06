# Sessions Center Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move session lists out of the sidebar and into the main center area as a card grid, with familiars in the sidebar acting as nav-only items that surface their sessions in the center when selected.

**Architecture:** The sidebar's `FamiliarSection` (header + collapsible session list) is replaced with flat `FamiliarRow` nav items (glyph + name + session count badge). Clicking a familiar sets `mode = "sessions"` in Workspace and renders a new `SessionsView` component in the center detail pane. `SessionsView` renders a responsive card grid grouped per familiar (all) or filtered to one (when a familiar is selected). Clicking a card transitions to `mode = "chats"` and opens that session.

**Tech Stack:** React, TypeScript, Tailwind v4, CSS modules in `src/styles/`, Phosphor icons via `Icon`, existing `FamiliarGlyph` + `FamiliarGlyphPicker` pattern.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/sessions-view.tsx` | Card grid for sessions, grouped by familiar |
| Create | `src/styles/sessions-view.css` | Card grid styles |
| Modify | `src/components/sidebar-minimal.tsx` | Replace `FamiliarSection` with flat `FamiliarRow`; remove session list |
| Modify | `src/styles/sidebar-minimal.css` | Remove session-row styles; add/update familiar-row styles |
| Modify | `src/components/workspace.tsx` | Add `"sessions"` mode; wire `SessionsView`; pass `onFamiliarSelect` to show sessions |
| Modify | `src/lib/icon.tsx` | Add any new Phosphor icons needed |

---

## Task 1: Create `SessionsView` component

**Files:**
- Create: `src/components/sessions-view.tsx`
- Create: `src/styles/sessions-view.css`

### What it does

Full-center view that shows sessions as cards. When `activeFamiliarId` is set it filters to that familiar's sessions; otherwise shows all sessions grouped by familiar with a section header per familiar.

Each card shows:
- Top-left: familiar glyph chip (small)
- Title (truncated to 2 lines)
- Last message preview / origin label
- Bottom row: status pill + relative timestamp
- Hover: subtle card lift + border brightens
- Active session: accent border

A **New chat** CTA card sits as the first item in the grid when a familiar is selected (or at the top of each group when showing all).

- [ ] **Step 1: Create the CSS file**

```css
/* src/styles/sessions-view.css */

.sessions-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.sessions-view-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px 12px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-hairline);
}

.sessions-view-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.sessions-view-new-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-primary);
  background: var(--accent-presence);
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}
.sessions-view-new-btn:hover { opacity: 0.85; }

.sessions-view-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
.sessions-view-scroll::-webkit-scrollbar { width: 4px; }
.sessions-view-scroll::-webkit-scrollbar-thumb {
  background: var(--border-hairline);
  border-radius: 2px;
}

/* ── Group (one per familiar when showing all) ─────────────── */
.sessions-group {
  margin-bottom: 24px;
}
.sessions-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.sessions-group-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.sessions-group-count {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-raised);
  border-radius: 8px;
  padding: 1px 6px;
}

/* ── Card grid ─────────────────────────────────────────────── */
.sessions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

/* ── Session card ──────────────────────────────────────────── */
.session-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--bg-raised);
  border: 1px solid var(--border-hairline);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, transform 0.12s;
  text-align: left;
  min-height: 88px;
}
.session-card:hover {
  background: var(--bg-elevated);
  border-color: var(--border-strong);
  transform: translateY(-1px);
}
.session-card--active {
  border-color: var(--accent-presence);
  background: color-mix(in oklch, var(--accent-presence) 8%, var(--bg-raised));
}

/* New-chat card */
.session-card--new {
  border-style: dashed;
  border-color: var(--border-strong);
  background: transparent;
  align-items: center;
  justify-content: center;
  flex-direction: row;
  gap: 6px;
  min-height: 88px;
  color: var(--text-muted);
  font-size: 12px;
}
.session-card--new:hover {
  border-color: var(--accent-presence);
  color: var(--accent-presence);
  background: color-mix(in oklch, var(--accent-presence) 5%, transparent);
  transform: translateY(-1px);
}

/* Card internals */
.session-card-top {
  display: flex;
  align-items: center;
  gap: 6px;
}
.session-card-familiar-chip {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 5px;
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}
.session-card-status {
  margin-left: auto;
  flex-shrink: 0;
}
.session-card-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.session-card-status-dot--running { background: #4ade80; box-shadow: 0 0 4px #4ade8080; }
.session-card-status-dot--error   { background: #f87171; }
.session-card-status-dot--idle    { background: var(--text-muted); opacity: 0.5; }

.session-card-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.session-card-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
}
.session-card-origin {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-panel);
  border-radius: 4px;
  padding: 1px 5px;
  text-transform: capitalize;
}
.session-card-ts {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: auto;
}

/* Empty state */
.sessions-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 10px;
  color: var(--text-muted);
  font-size: 13px;
  padding: 40px;
  text-align: center;
}
.sessions-empty-icon {
  font-size: 32px;
  opacity: 0.25;
}
```

- [ ] **Step 2: Create `sessions-view.tsx`**

```tsx
// src/components/sessions-view.tsx
"use client";

import "@/styles/sessions-view.css";
import { useMemo } from "react";
import { Icon } from "@/lib/icon";
import { FamiliarGlyph } from "@/components/familiar-glyph";
import { resolveFamiliarGlyph } from "@/lib/familiar-glyph";
import { useGlyphOverrides } from "@/lib/cave-glyph-overrides";
import type { Familiar, SessionRow, SessionOrigin } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "narrow" });

function shortRelTime(iso: string | undefined): string {
  if (!iso) return "";
  try {
    const diffSec = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diffSec < 60) return `${Math.round(diffSec)}s`;
    if (diffSec < 3600) return `${Math.round(diffSec / 60)}m`;
    if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h`;
    const days = Math.round(diffSec / 86400);
    if (days < 30) return `${days}d`;
    return `${Math.round(days / 30)}mo`;
  } catch {
    return "";
  }
}

function statusDotClass(status: string): string {
  if (status === "running") return "session-card-status-dot session-card-status-dot--running";
  if (status === "error" || status === "failed") return "session-card-status-dot session-card-status-dot--error";
  return "session-card-status-dot session-card-status-dot--idle";
}

function originLabel(origin: SessionOrigin | undefined): string {
  if (!origin) return "chat";
  const map: Record<SessionOrigin, string> = {
    chat: "chat",
    mention: "mention",
    board: "board",
    cron: "cron",
    heartbeat: "hb",
    call: "call",
  };
  return map[origin] ?? origin;
}

// ── SessionCard ──────────────────────────────────────────────

function SessionCard({
  session,
  familiar,
  active,
  onClick,
}: {
  session: SessionRow;
  familiar: Familiar | undefined;
  active: boolean;
  onClick: () => void;
}) {
  const overrides = useGlyphOverrides();
  const glyph = familiar ? resolveFamiliarGlyph(familiar, overrides) : null;
  const ts = shortRelTime(session.updated_at || session.created_at);
  const title = session.title || "Untitled session";

  return (
    <button
      type="button"
      className={`session-card${active ? " session-card--active" : ""}`}
      onClick={onClick}
      title={title}
    >
      <div className="session-card-top">
        <div className="session-card-familiar-chip">
          {glyph ? (
            <FamiliarGlyph glyph={glyph} size="xs" />
          ) : (
            <Icon name="ph:user" width={11} />
          )}
        </div>
        <div className="session-card-status">
          <div className={statusDotClass(session.status)} />
        </div>
      </div>
      <div className="session-card-title">{title}</div>
      <div className="session-card-footer">
        {session.origin && (
          <span className="session-card-origin">{originLabel(session.origin)}</span>
        )}
        {ts && <span className="session-card-ts">{ts}</span>}
      </div>
    </button>
  );
}

// ── NewChatCard ───────────────────────────────────────────────

function NewChatCard({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="session-card session-card--new" onClick={onClick}>
      <Icon name="ph:plus" width={14} />
      <span>New chat</span>
    </button>
  );
}

// ── SessionGroup ─────────────────────────────────────────────

function SessionGroup({
  familiar,
  sessions,
  activeSessionId,
  onOpenSession,
  onNewChat,
  showNewChat,
}: {
  familiar: Familiar | undefined;
  sessions: SessionRow[];
  activeSessionId: string | null | undefined;
  onOpenSession: (id: string) => void;
  onNewChat: () => void;
  showNewChat: boolean;
}) {
  return (
    <div className="sessions-group">
      {familiar && (
        <div className="sessions-group-header">
          <span className="sessions-group-label">{familiar.display_name}</span>
          <span className="sessions-group-count">{sessions.length}</span>
        </div>
      )}
      <div className="sessions-grid">
        {showNewChat && <NewChatCard onClick={onNewChat} />}
        {sessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            familiar={familiar}
            active={s.id === activeSessionId}
            onClick={() => onOpenSession(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── SessionsView (exported) ───────────────────────────────────

export type SessionsViewProps = {
  familiars: Familiar[];
  sessions: SessionRow[];
  activeFamiliarId: string | null;
  activeSessionId: string | null | undefined;
  onOpenSession: (id: string, familiarId?: string) => void;
  onNewChat: (familiarId?: string) => void;
};

export function SessionsView({
  familiars,
  sessions,
  activeFamiliarId,
  activeSessionId,
  onOpenSession,
  onNewChat,
}: SessionsViewProps) {
  const activeFamiliar = familiars.find((f) => f.id === activeFamiliarId) ?? null;

  // Sort sessions newest-first
  const sorted = useMemo(
    () => [...sessions].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)),
    [sessions]
  );

  // Filter to familiar if one is selected
  const filtered = useMemo(
    () =>
      activeFamiliarId
        ? sorted.filter((s) => s.familiarId === activeFamiliarId)
        : sorted,
    [sorted, activeFamiliarId]
  );

  // Group by familiar when showing all
  const groups = useMemo(() => {
    if (activeFamiliarId) return null;
    const map = new Map<string | null, SessionRow[]>();
    for (const s of filtered) {
      const key = s.familiarId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [filtered, activeFamiliarId]);

  const title = activeFamiliar
    ? `${activeFamiliar.display_name} — Sessions`
    : "All Sessions";

  return (
    <div className="sessions-view">
      {/* Header */}
      <div className="sessions-view-header">
        <span className="sessions-view-title">{title}</span>
        <button
          type="button"
          className="sessions-view-new-btn"
          onClick={() => onNewChat(activeFamiliarId ?? undefined)}
        >
          <Icon name="ph:plus" width={12} />
          New chat
        </button>
      </div>

      {/* Content */}
      <div className="sessions-view-scroll">
        {filtered.length === 0 && !groups ? (
          <div className="sessions-empty">
            <Icon name="ph:chat-circle-dots" className="sessions-empty-icon" />
            <span>No sessions yet</span>
            <span style={{ fontSize: 11, opacity: 0.6 }}>
              Start a new chat to get going
            </span>
          </div>
        ) : activeFamiliarId ? (
          /* Single-familiar grid */
          <SessionGroup
            familiar={activeFamiliar ?? undefined}
            sessions={filtered}
            activeSessionId={activeSessionId}
            onOpenSession={onOpenSession}
            onNewChat={() => onNewChat(activeFamiliarId)}
            showNewChat
          />
        ) : (
          /* All-familiars grouped */
          <>
            {familiars
              .filter((f) => (groups?.get(f.id) ?? []).length > 0)
              .map((f) => (
                <SessionGroup
                  key={f.id}
                  familiar={f}
                  sessions={groups?.get(f.id) ?? []}
                  activeSessionId={activeSessionId}
                  onOpenSession={(id) => onOpenSession(id, f.id)}
                  onNewChat={() => onNewChat(f.id)}
                  showNewChat={false}
                />
              ))}
            {/* Unassigned */}
            {(groups?.get(null) ?? []).length > 0 && (
              <SessionGroup
                familiar={undefined}
                sessions={groups?.get(null) ?? []}
                activeSessionId={activeSessionId}
                onOpenSession={onOpenSession}
                onNewChat={() => onNewChat(undefined)}
                showNewChat={false}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave && pnpm typecheck 2>&1 | grep "sessions-view"
```

Expected: no errors on `sessions-view.tsx`

- [ ] **Step 4: Commit**

```bash
git add src/components/sessions-view.tsx src/styles/sessions-view.css
git commit -m "feat(sessions-view): add SessionsView card grid component"
```

---

## Task 2: Refactor `SidebarMinimal` — flat familiar nav rows

**Files:**
- Modify: `src/components/sidebar-minimal.tsx`
- Modify: `src/styles/sidebar-minimal.css`

Replace `FamiliarSection` (header + collapsible session list) with a flat `FamiliarRow` that just shows glyph + name + session count. Clicking it calls `onFamiliarSelect(id)` which Workspace uses to set `mode = "sessions"` and `activeId`. Remove all session-row styles.

- [ ] **Step 1: Replace `FamiliarSection` with `FamiliarRow` in `sidebar-minimal.tsx`**

Remove the `SessionItem` and `FamiliarSection` components entirely. Add a `FamiliarRow` component:

```tsx
// Replace SessionItem + FamiliarSection with:

function FamiliarRow({
  familiar,
  sessionCount,
  active,
  onSelect,
}: {
  familiar: Familiar;
  sessionCount: number;
  active: boolean;
  onSelect: () => void;
}) {
  const overrides = useGlyphOverrides();
  const glyph = resolveFamiliarGlyph(familiar, overrides);

  return (
    <button
      type="button"
      className={`sidebar-familiar-row${active ? " sidebar-familiar-row--active" : ""}`}
      onClick={onSelect}
    >
      <span className="sidebar-familiar-row-glyph">
        <FamiliarGlyph glyph={glyph} size="sm" />
      </span>
      <span className="sidebar-familiar-row-name">{familiar.display_name}</span>
      {sessionCount > 0 && (
        <span className="sidebar-familiar-row-count">{sessionCount}</span>
      )}
    </button>
  );
}
```

Then replace the `SidebarMinimal` familiar section JSX:

```tsx
{/* ── Familiar rows ────────────────────────────────────────── */}
<div className="sidebar-familiar-list">
  {familiars.map((f) => {
    const count = sessions.filter((s) => s.familiarId === f.id).length;
    return (
      <FamiliarRow
        key={f.id}
        familiar={f}
        sessionCount={count}
        active={f.id === activeId}
        onSelect={() => {
          onFamiliarSelect?.(f.id);
          onModeChange("sessions");
        }}
      />
    );
  })}
</div>
```

Also remove `sessionsByFamiliar`, `unassignedSessions`, `chatSessions`, `defaultOpenId` memos that were used only for the old session list.

- [ ] **Step 2: Update `sidebar-minimal.css` — remove session-row rules, keep familiar-row**

Remove these CSS classes (they're no longer rendered):
- `.sidebar-familiar-section`
- `.sidebar-familiar-section + .sidebar-familiar-section`
- `.sidebar-familiar-header`
- `.sidebar-familiar-header:hover`
- `.sidebar-familiar-header--plain`
- `.sidebar-familiar-header-glyph`
- `.sidebar-familiar-header-name`
- `.sidebar-familiar-header-meta`
- `.sidebar-familiar-header-count`
- `.sidebar-familiar-header-chevron`
- `.sidebar-familiar-sessions`
- `.sidebar-familiar-sessions-empty`
- `.sidebar-session-row`
- `.sidebar-session-row--active`
- `.sidebar-session-row:hover`
- `.sidebar-session-title`
- `.sidebar-session-ts`

Keep/update `.sidebar-familiar-row`, `.sidebar-familiar-row--active`, `.sidebar-familiar-row-glyph`, `.sidebar-familiar-row-name`, `.sidebar-familiar-row-count`, `.sidebar-familiar-list`.

Ensure `.sidebar-familiar-row` has these styles:

```css
.sidebar-familiar-row {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 5px 10px;
  border-radius: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.12s;
  text-align: left;
}
.sidebar-familiar-row:hover {
  background: var(--bg-hover);
}
.sidebar-familiar-row--active {
  background: color-mix(in oklch, var(--accent-presence) 12%, transparent);
}
.sidebar-familiar-row-glyph {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sidebar-familiar-row-name {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary);
  truncate: true;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sidebar-familiar-row--active .sidebar-familiar-row-name {
  color: var(--accent-presence);
  font-weight: 500;
}
.sidebar-familiar-row-count {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-raised);
  border-radius: 8px;
  padding: 1px 5px;
  flex-shrink: 0;
}
.sidebar-familiar-row--active .sidebar-familiar-row-count {
  background: color-mix(in oklch, var(--accent-presence) 20%, transparent);
  color: var(--accent-presence);
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck 2>&1 | grep "sidebar-minimal"
```

Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add src/components/sidebar-minimal.tsx src/styles/sidebar-minimal.css
git commit -m "refactor(sidebar): replace FamiliarSection with flat FamiliarRow nav items"
```

---

## Task 3: Wire `SessionsView` into `Workspace`

**Files:**
- Modify: `src/components/workspace.tsx`

Add `"sessions"` to the `Mode` union, import `SessionsView`, render it in the detail pane.

- [ ] **Step 1: Add import**

```tsx
import { SessionsView } from "@/components/sessions-view";
```

- [ ] **Step 2: Add `"sessions"` to Mode**

`Mode` is inferred from `DaemonBar`'s `mode` prop. Check `daemon-bar.tsx` for its mode union and add `"sessions"` if not already there. If DaemonBar doesn't need to know about it (it's a center-pane-only mode), declare a local union override in workspace:

```tsx
type WorkspaceMode = Parameters<typeof DaemonBar>[0]["mode"] | "sessions";
// then change: const [mode, setMode] = useState<WorkspaceMode>("home");
```

- [ ] **Step 3: Handle `onFamiliarSelect` → sessions mode**

In the `<SidebarMinimal>` JSX in workspace, update `onFamiliarSelect`:

```tsx
onFamiliarSelect={(id) => {
  setActiveId(id);
  setMode("sessions");
}}
```

- [ ] **Step 4: Add `SessionsView` to the detail pane render**

In the `const detail = (...)` block, add after the `mode === "home"` branch:

```tsx
) : mode === "sessions" ? (
  <SessionsView
    familiars={familiars}
    sessions={sessions}
    activeFamiliarId={activeId}
    activeSessionId={routerRef.current?.currentSessionId() ?? null}
    onOpenSession={(id, familiarId) => {
      if (familiarId) setActiveId(familiarId);
      setMode("chats");
      setTimeout(() => routerRef.current?.openSession(id), 0);
    }}
    onNewChat={(familiarId) => {
      if (familiarId) setActiveId(familiarId);
      setMode("chats");
      setTimeout(() => routerRef.current?.newChat(), 0);
    }}
  />
```

- [ ] **Step 5: Update slash-command and palette handlers**

Any place in workspace that does `setMode("chats")` after selecting a familiar should now do `setMode("sessions")` first if no session id is being opened. Specifically:

- `/familiar <name>` with no session: `setMode("sessions")` not `"chats"`
- Sidebar `onFamiliarSelect`: already handled in step 3

- [ ] **Step 6: Typecheck**

```bash
pnpm typecheck 2>&1 | grep -v "eval-loop-panel"
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/workspace.tsx
git commit -m "feat(workspace): wire SessionsView as center panel for sessions mode"
```

---

## Task 4: Add missing icon to allowlist

**Files:**
- Modify: `src/lib/icon.tsx`

`SessionsView` uses `ph:user` and `ph:plus` — verify both are in the allowlist.

- [ ] **Step 1: Check and add**

```bash
grep "ph:user\|ph:plus" src/lib/icon.tsx
```

If missing, add them to the `ICONS` array in `icon.tsx`.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck 2>&1 | grep "icon"
```

- [ ] **Step 3: Commit (if changed)**

```bash
git add src/lib/icon.tsx
git commit -m "fix(icon): add ph:user, ph:plus to allowlist"
```

---

## Task 5: Visual polish pass

**Files:**
- Modify: `src/styles/sessions-view.css`
- Modify: `src/components/sessions-view.tsx`

- [ ] **Step 1: Verify `FamiliarGlyph` accepts `size="xs"`**

Check `familiar-glyph.tsx` for accepted `size` values. If `"xs"` isn't supported, use `"sm"` instead and reduce the chip container size via CSS.

- [ ] **Step 2: Add keyboard navigation to session cards**

Each `.session-card` is a `<button>` so tab/enter work by default. Verify no `div`s were accidentally used as cards.

- [ ] **Step 3: Ensure sessions-view.css is imported in globals or layout**

Either import in `sessions-view.tsx` directly (`import "@/styles/sessions-view.css"`) — already done in Task 1 — or verify Next.js picks it up. The component-level import is the canonical approach and should work.

- [ ] **Step 4: Screenshot check**

With `pnpm dev` running, navigate to a familiar in the sidebar and verify:
- Sessions render as cards in the center
- New chat button works
- Clicking a card opens the chat
- Sidebar shows flat familiar nav (no session list)

- [ ] **Step 5: Commit**

```bash
git add src/styles/sessions-view.css src/components/sessions-view.tsx
git commit -m "polish(sessions-view): visual refinements after live review"
```

---

## Task 6: Push and screenshot for Val

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Take a screenshot of the sessions view and send it**

Use the screen capture tool to take a screenshot of `http://localhost:3000` with a familiar selected, showing the card grid. Send via Telegram.

---

## Self-Review

### Spec coverage
- ✅ Sessions moved out of sidebar → `FamiliarSection` removed, `FamiliarRow` is nav-only
- ✅ Sessions in center