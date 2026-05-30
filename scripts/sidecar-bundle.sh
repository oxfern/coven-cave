#!/usr/bin/env bash
# Copy the Next.js standalone server into src-tauri/resources/server/ so
# the Tauri bundle can ship it alongside the .app. Run after `next build`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/.next/standalone"
STATIC="$ROOT/.next/static"
PUBLIC="$ROOT/public"
DEST="$ROOT/src-tauri/resources/server"

if [ ! -f "$SRC/server.js" ]; then
  echo "==> running pnpm build to produce standalone output"
  (cd "$ROOT" && pnpm build)
fi

if [ ! -f "$SRC/server.js" ]; then
  echo "ERROR: $SRC/server.js still missing after build" >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"
echo "==> copying standalone server → $DEST"
cp -a "$SRC/." "$DEST/"

if [ -d "$STATIC" ]; then
  mkdir -p "$DEST/.next/static"
  echo "==> copying .next/static → $DEST/.next/static"
  cp -a "$STATIC/." "$DEST/.next/static/"
fi

if [ -d "$PUBLIC" ]; then
  mkdir -p "$DEST/public"
  echo "==> copying public/ → $DEST/public"
  cp -a "$PUBLIC/." "$DEST/public/"
fi

echo "==> sidecar bundle ready"
