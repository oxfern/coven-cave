#!/usr/bin/env bun

import { $ } from "bun";
import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "../core/paths.ts";

const label = "[qa:native-vnc:smoke]";

function positiveInteger(name: string, fallback: number, minimum = 1): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${name} must be at least ${minimum}`);
  return value;
}

async function runVnc(args: string[], options: { quiet?: boolean } = {}) {
  const version = process.env.CAVE_VNC_CLIENT_VERSION ?? "0.2.1";
  const local = process.env.CAVE_VNC_FORCE_UVX !== "1"
    && (await $`which vnc`.quiet().nothrow()).exitCode === 0;
  const command = local ? ["vnc", ...args] : ["uvx", "--from", `vnc-computer-use==${version}`, "vnc", ...args];
  const result = await $`${command}`.cwd(repoRoot).quiet().nothrow();
  if (!options.quiet) process.stdout.write(result.stdout);
  if (result.exitCode !== 0) {
    throw new Error(`VNC command failed: ${result.stderr.toString().trim()}`);
  }
  return result;
}

if (process.platform !== "linux") throw new Error("the native VNC smoke test requires Linux");

const vncPort = positiveInteger("CAVE_VNC_PORT", 5900);
const viewerPort = positiveInteger("CAVE_VNC_VIEWER_PORT", 6080);
const readyTimeout = positiveInteger("CAVE_VNC_READY_TIMEOUT", 300);
const minimumBytes = positiveInteger("CAVE_VNC_MIN_SCREENSHOT_BYTES", 16_384);
const minimumColors = positiveInteger("CAVE_VNC_MIN_SCREENSHOT_COLORS", 32, 2);
const artifactDir = path.resolve(repoRoot, process.env.CAVE_VNC_ARTIFACT_DIR ?? "artifacts/openvnc-qa");
const session = process.env.CAVE_VNC_SESSION ?? `covencave-qa-${process.pid}`;
const files = {
  ready: path.join(artifactDir, "native-window.ready"),
  viewerUrl: path.join(artifactDir, "viewer.url"),
  daemonReady: path.join(artifactDir, "daemon.ready"),
  daemonHealth: path.join(artifactDir, "daemon-health.json"),
  desktopReady: path.join(artifactDir, "desktop.ready"),
  screenshot: path.join(artifactDir, "native-window.png"),
  viewerProbe: path.join(artifactDir, "novnc-viewer.html"),
  websocketProbe: path.join(artifactDir, "novnc-websocket.json"),
};

await mkdir(artifactDir, { recursive: true });
await Promise.all([files.screenshot, files.viewerProbe, files.websocketProbe].map((file) => rm(file, { force: true })));

let connected = false;
try {
  for (let second = 0; second < readyTimeout; second += 1) {
    if (await Bun.file(files.ready).exists()) break;
    await Bun.sleep(1_000);
  }
  assert.equal(await Bun.file(files.ready).exists(), true, "native window readiness marker was not created");
  for (const evidence of [files.viewerUrl, files.daemonReady, files.daemonHealth, files.desktopReady]) {
    assert.equal(await Bun.file(evidence).exists(), true, `missing readiness evidence: ${path.basename(evidence)}`);
  }

  const health = await Bun.file(files.daemonHealth).json();
  assert.equal(health.ok, true);
  assert.equal(health.apiVersion, "coven.daemon.v1");

  const viewerUrl = (await Bun.file(files.viewerUrl).text()).trim();
  const viewerResponse = await fetch(viewerUrl);
  assert.equal(viewerResponse.ok, true, `noVNC viewer returned HTTP ${viewerResponse.status}`);
  const viewerHtml = await viewerResponse.text();
  assert.match(viewerHtml, /noVNC/);
  await Bun.write(files.viewerProbe, viewerHtml);

  const websocketUrl = `ws://127.0.0.1:${viewerPort}/websockify`;
  const socket = new WebSocket(websocketUrl);
  socket.binaryType = "arraybuffer";
  const banner = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("noVNC WebSocket probe timed out")), 5_000);
    socket.addEventListener("message", (event) => {
      clearTimeout(timeout);
      const text = Buffer.from(event.data).toString("ascii").trim();
      text.startsWith("RFB ") ? resolve(text) : reject(new Error(`unexpected VNC banner: ${text}`));
    }, { once: true });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("noVNC WebSocket could not reach the VNC server"));
    }, { once: true });
  });
  socket.close();
  await Bun.write(files.websocketProbe, `${JSON.stringify({ url: websocketUrl, banner }, null, 2)}\n`);

  await runVnc(["--help"], { quiet: true });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await runVnc(["-s", session, "connect", `127.0.0.1::${vncPort}`], { quiet: true });
      connected = true;
      break;
    } catch {
      await Bun.sleep(1_000);
    }
  }
  assert.equal(connected, true, `could not connect to 127.0.0.1::${vncPort}`);
  await runVnc(["-s", session, "get_screen_size"]);
  await runVnc(["-s", session, "mouse_move", "40", "40"]);

  let bytes = 0;
  let colors = 0;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await runVnc(["-s", session, "get_screenshot", "-o", files.screenshot], { quiet: true });
    bytes = Bun.file(files.screenshot).size;
    const probe = await $`identify -format %k ${files.screenshot}`.quiet().nothrow();
    colors = probe.exitCode === 0 ? Number(probe.stdout.toString()) : 0;
    if (bytes >= minimumBytes && colors >= minimumColors) break;
    await Bun.sleep(1_000);
  }
  assert.ok(bytes >= minimumBytes && colors >= minimumColors, `last frame: ${bytes} bytes, ${colors} colors`);
  console.log(`${label} native VNC control verified (${bytes} bytes, ${colors} colors)`);
  console.log(`${label} live noVNC viewer verified at ${viewerUrl}`);
} finally {
  if (connected) await runVnc(["-s", session, "disconnect"], { quiet: true }).catch(() => undefined);
}
