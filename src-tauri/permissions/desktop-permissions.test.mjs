import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const capability = JSON.parse(readFileSync(new URL("../capabilities/default.json", import.meta.url), "utf8"));
const defaultPermissions = readFileSync(new URL("./default.toml", import.meta.url), "utf8");
const commandPermissions = readFileSync(new URL("./pty.toml", import.meta.url), "utf8");
const browserRust = readFileSync(new URL("../src/browser.rs", import.meta.url), "utf8");
const browserPane = readFileSync(new URL("../../src/components/browser-pane.tsx", import.meta.url), "utf8");
const bottomTerminal = readFileSync(new URL("../../src/components/bottom-terminal.tsx", import.meta.url), "utf8");

const requiredPermissionIds = [
  "allow-pty-start",
  "allow-pty-write",
  "allow-pty-resize",
  "allow-pty-stop",
  "allow-pty-list",
  "allow-pty-diagnose",
  "allow-browser-navigate",
  "allow-browser-set-bounds",
  "allow-browser-hide",
  "allow-browser-hide-all-except",
  "allow-browser-close",
  "allow-browser-reload",
  "allow-shell-open",
];

const requiredCommands = [
  "pty_start",
  "pty_write",
  "pty_resize",
  "pty_stop",
  "pty_list",
  "pty_diagnose",
  "browser_navigate",
  "browser_set_bounds",
  "browser_hide",
  "browser_hide_all_except",
  "browser_close",
  "browser_reload",
  "shell_open",
];

function capabilityAllowsOrigin(origin) {
  const patterns = capability.remote?.urls ?? [];
  return patterns.some((pattern) => new URLPattern(pattern).test(origin));
}

test("packaged desktop app can use native browser and terminal commands", () => {
  assert.equal(capability.local, true, "packaged local app origin must receive the default capability");
  assert.ok(capability.permissions.includes("default"), "default capability should include custom app permissions");

  for (const permissionId of requiredPermissionIds) {
    const escapedPermissionId = permissionId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      defaultPermissions,
      new RegExp(String.raw`"${escapedPermissionId}"`),
      `${permissionId} must be in default permission group`,
    );
  }

  for (const command of requiredCommands) {
    const escapedCommand = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      commandPermissions,
      new RegExp(String.raw`commands\.allow\s*=\s*\[[^\]]*"${escapedCommand}"[^\]]*\]`),
      `${command} must have a Tauri allow permission`,
    );
  }
});

test("packaged sidecar loopback origins can use native browser commands", () => {
  assert.ok(capabilityAllowsOrigin("http://127.0.0.1:3000/"), "dev 127.0.0.1 origin should be allowed");
  assert.ok(capabilityAllowsOrigin("http://localhost:3000/"), "dev localhost origin should be allowed");
  assert.ok(capabilityAllowsOrigin("http://127.0.0.1:64203/"), "packaged random 127.0.0.1 sidecar port should be allowed");
  assert.ok(capabilityAllowsOrigin("http://localhost:64203/"), "packaged random localhost sidecar port should be allowed");
  assert.equal(capabilityAllowsOrigin("http://example.com:64203/"), false, "remote non-loopback origins should stay denied");
});

test("browser event labels use the same native prefix in Rust and React", () => {
  assert.match(browserRust, /const BROWSER_LABEL_PREFIX: &str = "cave-browser-";/);
  assert.match(browserPane, /const NATIVE_BROWSER_LABEL_PREFIX = "cave-browser-";/);
  assert.match(browserPane, /return `\$\{NATIVE_BROWSER_LABEL_PREFIX\}\$\{label\}-tab-`;/);
  assert.equal(browserPane.match(/startsWith\(eventPrefix\)/g)?.length, 2);
  assert.equal(browserPane.match(/slice\(eventPrefix\.length\)/g)?.length, 2);
});

test("terminal commands use Tauri camelCase command arguments", () => {
  assert.match(
    bottomTerminal,
    /invoke\("pty_write", \{[\s\S]*threadId: threadId,[\s\S]*bytes:/,
    "pty_write must pass threadId so desktop keystrokes reach Rust",
  );
  assert.match(
    bottomTerminal,
    /invoke\("pty_resize", \{[\s\S]*threadId: threadId,[\s\S]*cols:[\s\S]*rows:/,
    "pty_resize must pass threadId so desktop resize reaches Rust",
  );
  assert.match(
    bottomTerminal,
    /invoke\("pty_stop", \{ threadId: threadId \}/,
    "pty_stop must pass threadId so desktop cleanup reaches Rust",
  );
  assert.doesNotMatch(
    bottomTerminal,
    /invoke\("pty_(?:write|resize|stop)", \{[\s\S]{0,120}thread_id:/,
    "direct Tauri command args should not use snake_case without rename_all",
  );
});
