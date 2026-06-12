# CovenCave Native Mobile Over Tailscale

Native mobile mode runs the Tauri iOS shell as a thin webview and points it at the Cave dev server through Tailscale Serve.

```text
iPhone CovenCave.app
  -> Tailscale tailnet HTTPS (*.ts.net)
  -> Tailscale Serve on the Mac
  -> http://127.0.0.1:3000
  -> Next.js Cave server
```

## Security Properties

- Network isolation: the iPhone reaches Cave only through the same Tailscale tailnet. The Next.js server stays bound to loopback.
- Origin allowlist: the Rust mobile entry point only accepts `https://*.ts.net`, `https://localhost`, `http://localhost`, and `http://127.0.0.1`.
- Loopback binding: `scripts/mobile-tailscale.sh native` refuses non-loopback `HOST` values before starting Next.js.
- ATS: iOS arbitrary loads stay disabled. The generated plist only allows insecure HTTP for `localhost`.
- No shared token: native mode does not pass a handoff query token or cookie. Access depends on tailnet membership plus the native URL allowlist.

## Prerequisites

- Tailscale installed and connected on the Mac.
- Tailscale installed and connected on the iPhone.
- Both devices are in the same tailnet.
- Tailscale Serve is available for the Mac account.
- Xcode and Tauri iOS dependencies are installed.
- The Apple development team is configured as `9LR8Z8UQ9X`.

## Quickstart

Initialize or refresh the generated iOS project:

```bash
pnpm exec tauri ios init
```

Run on the iOS simulator:

```bash
pnpm mobile:tailscale:native
```

Run on a physical iPhone:

```bash
pnpm mobile:tailscale:native:device
```

Inspect or stop the loopback server and Serve state:

```bash
pnpm mobile:tailscale:status
pnpm mobile:tailscale:stop
```

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `CAVE_MOBILE_DEV_URL` | Resolved from `tailscale serve status --json` | URL injected into the native Tauri webview. Must satisfy the Rust allowlist. |
| `CAVE_MOBILE_DEVICE` | `0` | Set to `1` to run `pnpm exec tauri ios dev --device`. |
| `CAVE_MOBILE_NATIVE` | Set internally by `native` | Starts the loopback Next.js server without the browser invite token. |
| `PORT` | `3000` | Loopback Next.js port published through Tailscale Serve. |
| `HOST` | `127.0.0.1` | Loopback host. Non-loopback values are rejected. |
| `TAILSCALE_TIMEOUT_MS` | `8000` | Timeout for Tailscale CLI calls. |
| `USE_TMUX` | `1` | Keeps the Next.js server alive in a tmux session when tmux is available. |
| `COVEN_CAVE_MOBILE_STATE_ROOT` | `${XDG_STATE_HOME:-$HOME/.local/state}/coven-cave` | Root for native/mobile runner state. |
| `COVEN_CAVE_MOBILE_STATE_DIR` | `$COVEN_CAVE_MOBILE_STATE_ROOT/mobile-tailscale-$PORT` | State directory for logs and process metadata. |
| `COVEN_CAVE_MOBILE_LOG` | `$STATE_DIR/next.log` | Next.js dev server log path. |
| `COVEN_CAVE_MOBILE_TMUX_SESSION` | `coven-cave-mobile-$PORT` | tmux session name for the persistent dev server. |
