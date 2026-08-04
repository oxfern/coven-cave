#!/usr/bin/env bash
# Give the raw `cargo run` executable a real macOS development identity.

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "[dev:app] ERROR: macOS runner expected the compiled executable" >&2
  exit 1
fi

binary="$1"
shift
case "$binary" in
  /*) ;;
  *) binary="$PWD/$binary" ;;
esac

binary_dir="$(cd "$(dirname "$binary")" && pwd)"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
bundle_dir="$binary_dir/ocd.app"
contents_dir="$bundle_dir/Contents"
macos_dir="$contents_dir/MacOS"
resources_dir="$contents_dir/Resources"
bundle_executable="$macos_dir/ocd"

mkdir -p "$macos_dir" "$resources_dir"
cp "$binary" "$bundle_executable"
chmod +x "$bundle_executable"
cp "$repo_root/src-tauri/icons/dev/icon.icns" "$resources_dir/icon.icns"

cat >"$contents_dir/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>ocd</string>
  <key>CFBundleExecutable</key>
  <string>ocd</string>
  <key>CFBundleIconFile</key>
  <string>icon.icns</string>
  <key>CFBundleIdentifier</key>
  <string>ai.opencoven.cave.dev</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>ocd</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.developer-tools</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

/usr/bin/plutil -lint "$contents_dir/Info.plist" >/dev/null
exec "$bundle_executable" "$@"
