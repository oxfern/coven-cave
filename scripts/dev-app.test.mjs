import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  fileURLToPath(new URL("./dev-app.sh", import.meta.url)),
  "utf8",
);

assert.match(
  source,
  /source scripts\/whisper-runtime-dev-env\.sh/,
  "the development launcher must stage and export Whisper before starting Tauri",
);
assert.match(
  source,
  /if \[ -n "\$\{PORT:-\}" \]; then[\s\S]*?dev_port="\$PORT"[\s\S]*?for candidate in \$\(seq 3000 3010\)/,
  "explicit PORT and automatic 3000-3010 discovery must remain part of the launcher contract",
);
assert.match(
  source,
  /dev_url="http:\/\/127\.0\.0\.1:\$\{dev_port\}"[\s\S]*?origin_is_ready "\$dev_port" "\$initial_timeout_ms"/,
  "the configured loopback devUrl and initial readiness probe must always target the same selected port",
);

assert.match(
  source,
  /HOSTNAME=127\.0\.0\.1 PORT="\$dev_port" pnpm dev &/,
  "the launcher must bind its owned dev server to the Tauri loopback devUrl on Windows and POSIX",
);
assert.match(
  source,
  /"beforeDevCommand": null,[\s\S]*?"devUrl": "\$\{dev_url\}"/,
  "Tauri must not launch a second server after the launcher has verified the first root document",
);

assert.match(
  source,
  /"productName": "ocd"/,
  "the development shell must have an unmistakable application name",
);
assert.match(
  source,
  /"identifier": "ai\.opencoven\.cave\.dev"/,
  "the development shell must use a distinct OS and WebView data identity",
);
for (const icon of ["32x32.png", "128x128.png", "128x128@2x.png", "icon.icns", "icon.ico"]) {
  assert.match(
    source,
    new RegExp(`"icons/dev/${icon.replace(".", "\\.")}"`),
    `the development override must select ${icon}`,
  );
  assert.ok(
    readFileSync(new URL(`../src-tauri/icons/dev/${icon}`, import.meta.url)).length > 0,
    `${icon} must be a non-empty development icon asset`,
  );
}
assert.notDeepEqual(
  readFileSync(new URL("../src-tauri/icons/dev/128x128.png", import.meta.url)),
  readFileSync(new URL("../src-tauri/icons/128x128.png", import.meta.url)),
  "the development icon must remain visually distinct from the production icon",
);

const productionConfig = JSON.parse(
  readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"),
);
assert.equal(productionConfig.productName, "CovenCave");
assert.equal(productionConfig.identifier, "ai.opencoven.cave");
assert.ok(
  productionConfig.bundle.icon.every((icon) => !icon.includes("icons/dev/")),
  "production bundles must keep the production icon set",
);

const nativeWindows = ["tauri_setup.rs", "window_geometry.rs"]
  .map((file) => readFileSync(new URL(`../src-tauri/src/${file}`, import.meta.url), "utf8"))
  .join("\n");
assert.doesNotMatch(
  nativeWindows,
  /\.title\("CovenCave(?: Quick Chat| Notch)?"\)/,
  "native window titles must follow the configured product name in both development and production",
);
assert.match(
  nativeWindows,
  /app\.config\(\)\.product_name/,
  "native window titles must be derived from Tauri's active product configuration",
);

assert.match(
  source,
  /if \[ "\$\(uname -s\)" = "Darwin" \]; then[\s\S]*?CARGO_TARGET_[\s\S]*?_RUNNER[\s\S]*?tauri-dev-macos-runner\.sh[\s\S]*?pnpm exec tauri dev/,
  "macOS development must launch through the app-bundle runner instead of a generic raw binary",
);
const macosRunner = readFileSync(
  new URL("./tauri-dev-macos-runner.sh", import.meta.url),
  "utf8",
);
assert.match(macosRunner, /ocd\.app/);
assert.match(macosRunner, /<string>ocd<\/string>/);
assert.match(macosRunner, /<string>ai\.opencoven\.cave\.dev<\/string>/);
assert.match(macosRunner, /icons\/dev\/icon\.icns/);
assert.match(
  macosRunner,
  /exec "\$bundle_executable" "\$@"/,
  "the runner must preserve Cargo's child-process lifecycle for Tauri's watcher and teardown",
);

assert.match(
  source,
  /if \[ -n "\$\{COVEN_CAVE_AUTH_TOKEN:-\}" \]; then[\s\S]*?encodeURIComponent\(process\.env\.COVEN_CAVE_AUTH_TOKEN\)[\s\S]*?dev_url\+="#covenCaveToken=\$\{sidecar_token_fragment\}"/,
  "an inherited sidecar token must reach the desktop webview through the URL hash",
);
assert.match(
  source,
  /"devUrl": "\$\{dev_url\}"/,
  "both launcher paths must use the token-bearing dev URL",
);

assert.doesNotMatch(
  source,
  /^exec pnpm exec tauri dev/m,
  "the launcher must stay alive to own teardown instead of exec'ing into Tauri",
);
assert.match(
  source,
  /trap cleanup EXIT[\s\S]*?trap 'cleanup; exit 130' INT[\s\S]*?trap 'cleanup; exit 143' TERM HUP/,
  "an interrupted launcher must run the same teardown as a clean exit",
);
assert.match(
  source,
  /terminate_process_tree\(\) \{[\s\S]*?signal_process_tree "\$pid" TERM[\s\S]*?signal_process_tree "\$pid" KILL/,
  "teardown must escalate from TERM to KILL so no owned process survives",
);
assert.match(
  source,
  /cleanup\(\) \{[\s\S]*?terminate_process_tree "\$tauri_pid"[\s\S]*?terminate_process_tree "\$server_pid"[\s\S]*?rm -f "\$TAURI_OVERRIDE_CONFIG"/,
  "cleanup must reap only its Tauri and owned server trees before removing the generated override config",
);
assert.match(
  source,
  /DEV_SERVER_GRACE_SECONDS="\$\{COVEN_CAVE_DEV_SERVER_GRACE_SECONDS:-180\}"/,
  "the dev-server watchdog must have a documented, overridable grace window",
);
assert.match(
  source,
  /origin_is_ready\(\) \{[\s\S]*?node scripts\/dev-app-origin-health\.mjs --port "\$1" --timeout-ms "\$\{2:-1500\}"/,
  "the launcher must require a bounded HTTP response rather than only a TCP socket",
);
assert.match(
  source,
  /initial_timeout_ms=\$\(\(DEV_SERVER_GRACE_SECONDS \* 1000\)\)[\s\S]*?origin_is_ready "\$dev_port" "\$initial_timeout_ms"[\s\S]*?desktop shell was not opened[\s\S]*?beforeDevCommand": null[\s\S]*?pnpm exec tauri dev/,
  "the launcher must validate the root document before opening Tauri, avoiding an initial black window",
);
assert.match(
  source,
  /watch_dev_server\(\) \{[\s\S]*?if origin_is_ready "\$dev_port"; then[\s\S]*?down_for=\$\(\(down_for \+ 2\)\)[\s\S]*?terminate_process_tree "\$tauri_pid"/,
  "the running shell must still tear down its owned Tauri tree when the loopback origin later becomes unavailable or HTTP-hung",
);

console.log("dev-app: ok");
