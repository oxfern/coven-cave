# Coven Cave QA

This directory contains opt-in quality harnesses that are intentionally kept
separate from the application and its existing CI. The native VNC harness runs
the real Linux Tauri window inside an isolated desktop, exposes that desktop to
VNC automation, and serves the same screen through noVNC for a human observer.

## Native VNC harness

The harness creates a temporary home directory and XDG profile, starts a real
Coven daemon, opens Cave as a centered `1180x760` window on a `1440x900`
Openbox desktop, and binds VNC and noVNC to loopback only. The desktop includes
a wallpaper, Applications menu, taskbar, and clock, so app activity stays
visible in context instead of filling the screen.

Install the Linux dependencies:

```text
build-essential dbus-x11 feh ffmpeg imagemagick
libayatana-appindicator3-dev libgtk-3-dev libjavascriptcoregtk-4.1-dev
librsvg2-dev libsoup-3.0-dev libssl-dev libwebkit2gtk-4.1-dev libxdo-dev
lxpanel novnc openbox pkg-config websockify x11-utils x11vnc xauth xdotool xvfb
```

Install a compatible Coven CLI, then start the harness in the foreground:

```bash
bun qa/native-vnc/cli/start.ts
```

The launcher prints the loopback VNC endpoint, noVNC URL, app URL, and artifact
directory. Open the viewer in the operating system's default browser:

```bash
bun qa/native-vnc/cli/view.ts
```

From another terminal, verify connectivity, input, daemon health, and a real
screenshot:

```bash
bun qa/native-vnc/cli/smoke.ts
```

The principal overrides are `CAVE_VNC_DISPLAY`, `CAVE_VNC_PORT`,
`CAVE_VNC_VIEWER_PORT`, `CAVE_VNC_APP_PORT`, `CAVE_VNC_GEOMETRY`,
`CAVE_VNC_WINDOW_SIZE`, `CAVE_VNC_COVEN_BIN`, `CAVE_VNC_NOVNC_ROOT`, and
`CAVE_VNC_ARTIFACT_DIR`.

## Credential-free runtime matrix

Set `CAVE_VNC_FAKE_RUNTIMES=1` before starting the harness to replace only the
credential-bearing vendor processes with deterministic local doubles. The
Tauri shell, Next server, Coven daemon, application routes, persistence, VNC
transport, and desktop remain real.

```bash
CAVE_VNC_FAKE_RUNTIMES=1 bun qa/native-vnc/cli/start.ts
bun qa/native-vnc/cli/record-scenarios.ts
```

The runtime contract is deliberately asymmetric:

| Runtime | Inventory | Summon flow | Chat contract |
| --- | --- | --- | --- |
| Codex | Supported | Supported | Generic stream |
| Claude Code | Supported | Supported | Generic stream |
| Copilot | Supported | Supported | Copilot JSONL |
| Hermes | Supported | Supported | One-shot manifest |
| OpenCode | Supported | Not yet offered | One-shot manifest |
| OpenClaw | Supported | Dedicated agent path | Local OpenClaw bridge |
| External manifests | Visible | Not trusted | Rejected before spawn |

The 11 scenarios cover first launch, familiar creation, daemon recovery,
runtime inventory, summon choices, chat round trips, resume fallback,
permissions and directory scope, process failure UX, trust boundaries, and
OpenClaw limitations. Results are written to `artifacts/openvnc-qa/`, including
`scenario-manifest.json` and optional recordings. Generated media is evidence,
not source: keep it out of Git and link externally hosted previews from the PR.

For the design and process model, see [architecture](native-vnc/docs/architecture.md).
For extending coverage, see [adding scenarios](native-vnc/docs/adding-scenarios.md).
For the hardening roadmap, see [future steps](native-vnc/docs/future-steps.md).
