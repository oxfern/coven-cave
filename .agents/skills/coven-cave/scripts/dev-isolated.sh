#!/usr/bin/env bash
# Isolated dev launcher for coven-cave — never touches the real $HOME.
# Self-contained toolchain: node + pnpm are downloaded into $ROOT/.bin on
# first run (pinned by .nvmrc / package.json "packageManager"), so the
# launcher works from GUI-spawned shells, cron, CI, or any host without
# homebrew/nvm on PATH.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export COVEN_CAVE_ISOLATED_ROOT="$ROOT"
export HOME="$ROOT/.isolated-home"
export USERPROFILE="$HOME"
export HOMEDRIVE=""
export HOMEPATH=""
export COVEN_HOME="$HOME/.coven"
export COVEN_CAVE_HOME="$HOME/.coven/cave"
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_STATE_HOME="$HOME/.local/state"
export XDG_CACHE_HOME="$HOME/.cache"
export PNPM_HOME="$ROOT/.pnpm-home"
export npm_config_cache="$HOME/.npm"
export npm_config_userconfig="$HOME/.npmrc"
export npm_config_globalconfig="$HOME/.npmrc-global"
export PNPM_STORE_PATH="$HOME/.pnpm-store"
export CARGO_HOME="$HOME/.cargo"
export RUSTUP_HOME="$HOME/.rustup"
export CARGO_TARGET_DIR="$ROOT/src-tauri/target"
# macOS app support paths under fake home
export TMPDIR="$HOME/tmp"
unset CLAUDE_CONFIG_DIR 2>/dev/null || true

BIN="$ROOT/.bin"
TOOLCHAIN="$BIN/toolchain"
# $BIN first so the pinned toolchain always wins; $CARGO_HOME/bin picks up an
# isolated rustup install; homebrew/usr-local sit at the END as fallback only —
# nothing here requires them.
export PATH="$BIN:$CARGO_HOME/bin:$PNPM_HOME:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/sbin"

cd "$ROOT"
mkdir -p \
  "$COVEN_HOME" "$COVEN_CAVE_HOME" \
  "$XDG_CONFIG_HOME" "$XDG_DATA_HOME" "$XDG_STATE_HOME" "$XDG_CACHE_HOME" \
  "$PNPM_STORE_PATH" "$npm_config_cache" "$PNPM_HOME" \
  "$CARGO_HOME" "$CARGO_TARGET_DIR" "$TMPDIR" \
  "$BIN" "$TOOLCHAIN" \
  "$HOME/Library/Application Support" \
  "$HOME/Library/Caches" \
  "$HOME/Library/Logs" \
  "$HOME/Library/Preferences" \
  "$HOME/Library/WebKit"

fetch() { # fetch <url> <dest>
  local partial
  partial="$(mktemp "$2.part.XXXXXX")"
  curl -fsSL --retry 3 --proto '=https' -o "$partial" "$1" \
    || { echo "[isolated] FATAL: download failed: $1" >&2; rm -f "$partial"; exit 1; }
  mv -f "$partial" "$2"
}

ensure_toolchain() {
  local node_os pnpm_os arch pnpm_arch
  case "$(uname -s)" in
    Darwin) node_os="darwin"; pnpm_os="macos" ;;
    Linux)  node_os="linux";  pnpm_os="linux" ;;
    *) echo "[isolated] FATAL: unsupported OS: $(uname -s)" >&2; exit 1 ;;
  esac
  case "$(uname -m)" in
    arm64|aarch64) arch="arm64"; pnpm_arch="arm64" ;;
    x86_64|amd64)  arch="x64";   pnpm_arch="x64" ;;
    *) echo "[isolated] FATAL: unsupported arch: $(uname -m)" >&2; exit 1 ;;
  esac

  # --- node: pinned by .nvmrc ---
  local node_version="24.18.0"
  if [ -f "$ROOT/.nvmrc" ]; then
    node_version="$(head -1 "$ROOT/.nvmrc" | tr -d '[:space:]' | sed 's/^v//')"
  fi
  if ! printf '%s' "$node_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    # partial pin (e.g. "24") — resolve newest matching release
    local major="${node_version%%.*}" resolved
    resolved="$(curl -fsSL https://nodejs.org/dist/index.json \
      | grep -oE "\"v$major\.[0-9]+\.[0-9]+\"" | head -1 | tr -d '"' | sed 's/^v//')" || resolved=""
    [ -n "$resolved" ] || { echo "[isolated] FATAL: cannot resolve node $node_version.x" >&2; exit 1; }
    node_version="$resolved"
  fi
  if [ "$("$BIN/node" --version 2>/dev/null || true)" != "v$node_version" ]; then
    local ndir="node-v$node_version-$node_os-$arch"
    if [ ! -x "$TOOLCHAIN/$ndir/bin/node" ]; then
      echo "[isolated] fetching node v$node_version → .bin/toolchain/$ndir"
      fetch "https://nodejs.org/dist/v$node_version/$ndir.tar.gz" "$TOOLCHAIN/$ndir.tar.gz"
      tar -xzf "$TOOLCHAIN/$ndir.tar.gz" -C "$TOOLCHAIN"
      rm -f "$TOOLCHAIN/$ndir.tar.gz"
    fi
    ln -sfn "$TOOLCHAIN/$ndir/bin/node" "$BIN/node"
    ln -sfn "$TOOLCHAIN/$ndir/bin/npm"  "$BIN/npm"
    ln -sfn "$TOOLCHAIN/$ndir/bin/npx"  "$BIN/npx"
    [ -e "$TOOLCHAIN/$ndir/bin/corepack" ] && ln -sfn "$TOOLCHAIN/$ndir/bin/corepack" "$BIN/corepack"
  fi

  # --- pnpm: standalone binary, pinned by package.json "packageManager" ---
  local pnpm_version=""
  if [ -f "$ROOT/package.json" ]; then
    pnpm_version="$(sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"pnpm@\([0-9][0-9.]*\).*/\1/p' "$ROOT/package.json" | head -1)"
  fi
  [ -n "$pnpm_version" ] || pnpm_version="10.34.0"
  # --version from / so pnpm reports the binary's own version instead of
  # self-switching to the repo's packageManager pin (a network fetch).
  if [ "$(cd / && "$BIN/pnpm" --version 2>/dev/null | tail -1 || true)" != "$pnpm_version" ]; then
    echo "[isolated] fetching pnpm v$pnpm_version → .bin/pnpm"
    fetch "https://github.com/pnpm/pnpm/releases/download/v$pnpm_version/pnpm-$pnpm_os-$pnpm_arch" "$BIN/pnpm"
    chmod +x "$BIN/pnpm"
  fi

  # --- rust: opt-in (large download); installs into the ISOLATED cargo/rustup homes ---
  if ! command -v cargo >/dev/null 2>&1; then
    if [ "${COVEN_CAVE_ENSURE_RUST:-0}" = "1" ]; then
      echo "[isolated] installing rust (rustup) into $RUSTUP_HOME / $CARGO_HOME"
      fetch "https://sh.rustup.rs" "$BIN/rustup-init.sh"
      sh "$BIN/rustup-init.sh" -y --no-modify-path --profile minimal --default-toolchain stable
      rm -f "$BIN/rustup-init.sh"
    else
      echo "[isolated] WARN: cargo not found — Tauri dev needs it. Re-run with COVEN_CAVE_ENSURE_RUST=1 to install rustup into the isolated home." >&2
    fi
  fi
}

# Concurrent sessions are the norm in this repo — serialize provisioning so
# two launchers can't clobber each other's downloads (mkdir is atomic).
LOCKDIR="$BIN/.provision.lock"
waited=0
until mkdir "$LOCKDIR" 2>/dev/null; do
  if [ "$waited" -eq 0 ]; then
    echo "[isolated] waiting for concurrent toolchain provisioning ($LOCKDIR)…"
  fi
  waited=$((waited + 1))
  if [ "$waited" -gt 300 ]; then
    echo "[isolated] FATAL: provisioning lock held >5m — remove $LOCKDIR if stale" >&2
    exit 1
  fi
  sleep 1
done
trap 'rmdir "$LOCKDIR" 2>/dev/null || true' EXIT INT TERM
ensure_toolchain
rmdir "$LOCKDIR" 2>/dev/null || true
trap - EXIT INT TERM

echo "[isolated] HOME=$HOME"
echo "[isolated] COVEN_HOME=$COVEN_HOME"
echo "[isolated] COVEN_CAVE_HOME=$COVEN_CAVE_HOME"
echo "[isolated] CARGO_HOME=$CARGO_HOME"
echo "[isolated] CARGO_TARGET_DIR=$CARGO_TARGET_DIR"
echo "[isolated] BIN=$BIN"
echo "[isolated] cwd=$(pwd)"
echo "[isolated] node=$(command -v node) ($(node --version 2>/dev/null || echo missing))"
echo "[isolated] pnpm=$(command -v pnpm) ($(pnpm --version 2>/dev/null || echo missing))"
echo "[isolated] cargo=$(command -v cargo) ($(cargo --version 2>/dev/null || echo missing))"

REAL_HOME="$(dscl . -read /Users/"$(whoami)" NFSHomeDirectory 2>/dev/null | awk '{print $2}')" || REAL_HOME="/Users/$(whoami)"
if [ "$HOME" = "$REAL_HOME" ] || [ "$HOME" = "/Users/$(whoami)" ]; then
  echo "[isolated] FATAL: HOME still points at real home: $HOME" >&2
  exit 1
fi
if [[ "$CARGO_HOME" == "$REAL_HOME"/* ]]; then
  echo "[isolated] FATAL: CARGO_HOME under real home: $CARGO_HOME" >&2
  exit 1
fi
if [[ "$RUSTUP_HOME" == "$REAL_HOME"/* ]]; then
  echo "[isolated] FATAL: RUSTUP_HOME under real home: $RUSTUP_HOME" >&2
  exit 1
fi
if command -v node >/dev/null 2>&1 && [[ "$(command -v node)" != "$BIN/"* ]]; then
  echo "[isolated] WARN: node resolves outside .bin: $(command -v node)" >&2
fi

exec "$@"
