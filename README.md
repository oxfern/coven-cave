# CovenCave

Coven desktop cave — a Tauri + Next.js workspace for talking to OpenCoven
familiars, inspecting their memory, and watching their tools.

## Stack

- Tauri 2 (native shell, macOS/Windows/Linux)
- Next.js 16 (App Router, Turbopack, Tailwind v4)
- Talks to the local `coven` daemon over `~/.coven/coven.sock`

## Develop

```bash
pnpm install
pnpm tauri dev    # native window, hot-reloads Next.js
# or
pnpm dev          # browser-only at http://localhost:3000
```

## Keybinds

- `⌘B` toggle familiar rail
- `⇧⌘B` toggle inspector pane
- drag the vertical handles to resize side panels
