# Plugins view — design

A Cave-native emulation of the Codex "Plugins" gallery, rendered as a third Workspace mode alongside Chats and Coven Board.

## Goal

Visually emulate Codex's plugin gallery (per reference screenshot) inside Cave, with center-pane content wired to Cave's real harnesses and skills endpoints. The surrounding chrome remains the existing Cave shell (FamiliarRail on the left, InspectorPane on the right).

## Placement

Add `"plugins"` to the `Mode` union in `src/components/workspace.tsx`. The top nav grows from two entries to three:

```
Chats   Coven Board   Plugins
```

When `mode === "plugins"`, the center Panel renders `<PluginsView />`. FamiliarRail and InspectorPane behavior is unchanged — they collapse with ⌘B / ⇧⌘B as before.

## View structure

Top to bottom inside the center pane:

1. **Tab strip** — `Plugins` | `Skills` (left). `Manage` + `Create ▾` (right). Tabs are local state; `Manage` / `Create` are visual-only for v1.
2. **Headline** — centered, large: "Make Cave work your way".
3. **Filter row** — chip group on the left (`Curated by Cave` active, `Shared with you`, `Created by me`, `More ▾`) and a "Search plugins" input on the right. Filter chips toggle visually but do not change the dataset; the search input filters the grid client-side by name/description.
4. **Hero banner** — full-width rounded card with a purple/blue gradient. Centered chat pill ("✨ Codex · Draft replies for every email I'm behind on") and a "Try in chat" button below. Four small dot indicators stacked vertically on the right edge (decorative — not interactive).
5. **Featured section** — "Featured" heading. Two-column grid of plugin cards.

### Card shape

```
┌──────────────────────────────────────────────┐
│ [icon]  Title                            ✓   │
│         One-line description                 │
└──────────────────────────────────────────────┘
```

- Icon: tinted rounded square containing the harness emoji (or first letter for skills).
- Title: harness `label` or skill `name`.
- Description: harness — synthesized one-liner ("Run Claude Code sessions from this Cave"); skill — owner + category.
- Right indicator: `✓` when `installed === true` (harnesses) or always-shown for skills; otherwise `+`.

## Data sources

- **Plugins tab** → `GET /api/harnesses` → existing endpoint, returns `{ id, label, binary, chatSupported, installed, path, version }[]`. No new server code.
- **Skills tab** → `GET /api/skills` → existing endpoint, returns `{ id, name, owner?, category?, tags?, score? }[]`. Daemon must be running; if unavailable, the tab shows an inline "daemon offline" hint and an empty grid.

Loads happen on tab change; results cache in component state for the session.

## Interactivity

- **Tab switch** (Plugins ↔ Skills) — re-renders the grid, lazy-fetches the corresponding list once.
- **Card click — installed harness** — switches Workspace mode to `chats` and opens a new chat for the current active familiar. v1 does not pin a harness override; the new chat uses the familiar's default harness. (Threading a harness override into `ChatRouter.newChat()` is out of scope for v1; noted as follow-up.)
- **Card click — `+`** — `title` tooltip with install hint (e.g., "Install `codex` to enable"). No shell-out.
- **Hero "Try in chat"** — switches to `chats` and opens a new chat.
- **Search input** — filters cards in the current tab by case-insensitive substring match against title and description.
- **Filter chips** — purely cosmetic for v1; only `Curated by Cave` shows the full list. Selecting another chip shows the same list (placeholder behavior); document this in a comment so future work can wire real filters.

## Visual language

Follow existing Cave styling: `bg-zinc-950`, `text-zinc-100/400/500`, `border-zinc-800/900`, with the existing accent of `purple-500` for hover/active states. The hero gradient uses purple/blue (`from-purple-700/40 via-indigo-700/30 to-blue-700/30`) over a near-black base.

## Files

- `src/components/plugins-view.tsx` (new) — the full center-pane UI plus data loading.
- `src/components/workspace.tsx` (edit) — extend `Mode`, add nav button, render branch.

No new API routes. No new dependencies.

## Out of scope (v1)

- `Manage` modal and `Create` dropdown
- Wiring a harness override into "new chat"
- Server-side filtering / pagination / `Shared with you` semantics
- Skill detail / config modals
- Install/uninstall actions for harnesses
- The Codex-style left sidebar (New chat / Automations / Projects / etc.) — Cave's FamiliarRail occupies that space
