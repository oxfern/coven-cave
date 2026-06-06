# Board v2 Design Spec

**Date:** 2026-06-06  
**Status:** Approved

## Overview

Redesign `BoardView` with: kanban + table view modes, group-by axis, refactored filter toolbar with active chips, slide-over inspector drawer, sidebar settings footer removed.

## Sidebar Change

Remove `sidebar-bottom` div and `sidebar-settings-row` button from `sidebar-minimal.tsx`. Remove `onOpenSettings` prop from `SidebarMinimalProps` and `workspace.tsx`.

## Header Toolbar (single row)

```
Board   5 cards · 2 running · 1 blocked     [Group by: Status ▾] [Filter ▾] [⊞|≡] [+ New card]
```

Left: title + muted stats. Right: Group by select · Filter button · view toggle (kanban/table icons) · New card button. No second row unless active filters exist.

## Filter System

**Popover:** Triggered by Filter button. Sections: Priority / Familiar / Status / Labels (all checkboxes). Footer: Clear all + Done.

**Active chips row:** Appears only when ≥1 filter active. Dismissible chips (`Priority: Urgent ×`). `Clear all` at end. Hidden when empty.

**FilterState type:**
```ts
type FilterState = {
  priorities: Set<CardPriority>;
  familiarIds: Set<string>;
  statuses: Set<CardStatus>;
  labels: Set<string>;
};
```
All filtering is client-side.

## Group By

`GroupBy = "status" | "familiar" | "priority" | "none"`. Default: `"status"`.

- **kanban + status:** existing 6-column layout
- **kanban + familiar/priority:** vertical swimlane sections, each with scrollable 6-column row
- **table + any:** collapsible group header rows between data rows

## Table View

Columns: Title · Status · Priority · Familiar · Lifecycle · Updated. Sortable by any header. Click row → inspector drawer. Selected row = accent left border + bg tint.

Grouping: collapsible section headers with disclosure triangle + count badge. Done groups collapsed by default.

## Inspector Drawer

Slides in from right, 480px wide, full viewport height, semi-transparent backdrop. Escape/backdrop click closes. Does NOT narrow board — overlays on top. Animation: `translateX(100%) → translateX(0)`, 220ms ease-out.

Content: Title (editable), Status + Priority selects, Familiar select, Session link, Notes textarea, Labels chips + add, Lifecycle badge + transition buttons, Created/Updated timestamps, Delete (with confirm).

## Persistence

- `localStorage["cave:board:viewMode"]` — "kanban" | "table"
- `localStorage["cave:board:groupBy"]` — "status" | "familiar" | "priority" | "none"
- Filter state: session-only, not persisted

## File Map

| File | Action |
|------|--------|
| `src/components/board-view.tsx` | Rewrite — thin shell |
| `src/components/board-kanban.tsx` | Create — kanban + swimlanes |
| `src/components/board-table.tsx` | Create — table view |
| `src/components/board-inspector.tsx` | Create — slide-over drawer |
| `src/components/board-filter-popover.tsx` | Create — filter popover |
| `src/styles/board.css` | Create — all board styles |
| `src/components/sidebar-minimal.tsx` | Modify — remove settings footer |
| `src/components/workspace.tsx` | Modify — remove onOpenSettings prop |
| `src/lib/icon.tsx` | Modify — add new icons |

## Non-Goals

No server-side filtering, no drag-to-reorder in table, no bulk select, no column resizing, no infinite scroll.
