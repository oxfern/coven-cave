#!/usr/bin/env bash
# Ensure an isolated coven-cave workspace exists. Never uses the real $HOME for app state.
set -euo pipefail
ROOT="${COVEN_CAVE_ISOLATED_ROOT:-/tmp/coven-cave-isolated}"
REPO_URL="${COVEN_CAVE_REPO_URL:-https://github.com/OpenCoven/coven-cave}"
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -d "$ROOT/.git" ]; then
  echo "[coven-cave] cloning $REPO_URL → $ROOT"
  git clone "$REPO_URL" "$ROOT"
fi

mkdir -p \
  "$ROOT/.isolated-home/.coven/cave" \
  "$ROOT/.isolated-home/.local/state" \
  "$ROOT/.isolated-home/.local/share" \
  "$ROOT/.isolated-home/.config" \
  "$ROOT/.isolated-home/.cache" \
  "$ROOT/.isolated-home/.pnpm-store" \
  "$ROOT/.isolated-home/.npm" \
  "$ROOT/.isolated-home/.cargo" \
  "$ROOT/.isolated-home/Library/Application Support" \
  "$ROOT/.isolated-home/Library/Caches" \
  "$ROOT/.isolated-home/Library/Logs" \
  "$ROOT/.isolated-home/Library/Preferences" \
  "$ROOT/.isolated-home/tmp" \
  "$ROOT/.pnpm-home" \
  "$ROOT/.bin" \
  "$ROOT/src-tauri/target"

# Install / refresh the isolation launcher from this skill
cp "$SKILL_DIR/scripts/dev-isolated.sh" "$ROOT/dev-isolated.sh"
chmod +x "$ROOT/dev-isolated.sh"

# Provision the self-contained toolchain (node + pnpm → $ROOT/.bin) now so the
# first real dev command doesn't pay the download mid-task.
"$ROOT/dev-isolated.sh" true

# Minimal seed state (empty familiars; onboarding free to run)
if [ ! -f "$ROOT/.isolated-home/.coven/familiars.toml" ]; then
  printf '# isolated dev familiars registry\n' > "$ROOT/.isolated-home/.coven/familiars.toml"
fi
if [ ! -f "$ROOT/.isolated-home/.coven/cave/config.json" ]; then
  cat > "$ROOT/.isolated-home/.coven/cave/config.json" <<'JSON'
{
  "version": 1,
  "profile": { "displayName": "Isolated Dev" },
  "onboarding": { "dismissed": true }
}
JSON
fi

# Seed cargo registry once from the real user cache if present (one-time host seed;
# runtime never points CARGO_HOME at real ~).
if [ -d "${REAL_CARGO_HOME:-$HOME/.cargo}/registry" ] && [ ! -d "$ROOT/.isolated-home/.cargo/registry" ]; then
  # Only seed when our isolation HOME is not already the process HOME
  REAL_HOME_PROBE="$(dscl . -read /Users/"$(whoami)" NFSHomeDirectory 2>/dev/null | awk '{print $2}')" || REAL_HOME_PROBE="/Users/$(whoami)"
  if [ -d "$REAL_HOME_PROBE/.cargo/registry" ]; then
    echo "[coven-cave] seeding isolated cargo registry from host (one-time)"
    rsync -a "$REAL_HOME_PROBE/.cargo/registry" "$ROOT/.isolated-home/.cargo/" || true
    [ -d "$REAL_HOME_PROBE/.cargo/git" ] && rsync -a "$REAL_HOME_PROBE/.cargo/git" "$ROOT/.isolated-home/.cargo/" || true
  fi
fi

echo "[coven-cave] ready: $ROOT"
echo "[coven-cave] run via: $ROOT/dev-isolated.sh <cmd>"
echo "$ROOT"
