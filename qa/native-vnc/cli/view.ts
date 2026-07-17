#!/usr/bin/env bun

import { $ } from "bun";

const label = "[qa:native-vnc:view]";
const viewerPort = Number(process.env.CAVE_VNC_VIEWER_PORT ?? 6080);
if (!Number.isInteger(viewerPort) || viewerPort < 1 || viewerPort > 65_535) {
  throw new Error("CAVE_VNC_VIEWER_PORT must be between 1 and 65535");
}

const viewerUrl = process.env.CAVE_VNC_VIEWER_URL
  ?? `http://127.0.0.1:${viewerPort}/vnc.html?host=127.0.0.1&port=${viewerPort}&autoconnect=1&resize=scale`;
const response = await fetch(viewerUrl, { signal: AbortSignal.timeout(3_000) }).catch(() => null);
if (!response?.ok || !(await response.text()).includes("noVNC")) {
  throw new Error(`the live viewer is not responding at ${viewerUrl}`);
}

switch (process.platform) {
  case "darwin":
    await $`open ${viewerUrl}`.quiet();
    break;
  case "linux":
    await $`xdg-open ${viewerUrl}`.quiet();
    break;
  case "win32":
    await $`cmd.exe /c start "" ${viewerUrl}`.quiet();
    break;
  default:
    throw new Error(`unsupported operating system: ${process.platform}`);
}

console.log(`${label} opened ${viewerUrl}`);
