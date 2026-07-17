import { $ } from "bun";
import { access } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { commandExists } from "./processes.ts";
import { firstFreePort, isPortFree } from "./network.ts";
import { fromHarness, repoRoot } from "./paths.ts";

export type HarnessConfig = {
  display: string;
  vncPort: number;
  viewerPort: number;
  appPort: number;
  geometry: string;
  screenWidth: number;
  screenHeight: number;
  windowWidth: number;
  windowHeight: number;
  windowX: number;
  windowY: number;
  readyTimeoutSeconds: number;
  daemonTimeoutSeconds: number;
  artifactDir: string;
  noVncRoot: string;
  covenBin: string;
  fakeRuntimes: boolean;
  wallpaperIcon: string;
  panelProfile: string;
  repoRoot: string;
};

function integer(name: string, fallback: number, minimum = 1, maximum = Number.MAX_SAFE_INTEGER): number {
  const raw = process.env[name];
  const value = raw == null || raw === "" ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function dimensions(name: string, value: string, includeDepth: boolean): number[] {
  const pattern = includeDepth ? /^(\d+)x(\d+)x(16|24|32)$/ : /^(\d+)x(\d+)$/;
  const match = value.match(pattern);
  if (!match) throw new Error(`${name} has an invalid format: ${value}`);
  return match.slice(1).map(Number);
}

async function executable(value: string | undefined, fallback: string): Promise<string> {
  const requested = value?.trim() || fallback;
  if (requested.includes("/")) {
    const resolved = path.resolve(repoRoot, requested);
    await access(resolved, constants.X_OK);
    return resolved;
  }
  const found = (await $`which ${requested}`.text()).trim();
  if (!found) throw new Error(`executable not found: ${requested}`);
  return found;
}

async function findNoVncRoot(): Promise<string> {
  const configured = process.env.CAVE_VNC_NOVNC_ROOT?.trim();
  const candidates = configured
    ? [configured]
    : ["/usr/share/novnc", "/usr/share/noVNC", "/usr/local/share/novnc"];
  for (const candidate of candidates) {
    if (await Bun.file(path.join(candidate, "vnc.html")).exists()) return candidate;
  }
  throw new Error("noVNC vnc.html was not found; install noVNC or set CAVE_VNC_NOVNC_ROOT");
}

export async function loadConfig(): Promise<HarnessConfig> {
  if (process.platform !== "linux") throw new Error("the native VNC harness requires Linux");

  const display = process.env.CAVE_VNC_DISPLAY ?? ":99";
  if (!/^:\d+$/.test(display)) throw new Error("CAVE_VNC_DISPLAY must look like :99");

  const vncPort = integer("CAVE_VNC_PORT", 5900, 1, 65_535);
  const viewerPort = integer("CAVE_VNC_VIEWER_PORT", 6080, 1, 65_535);
  const requestedAppPort = process.env.CAVE_VNC_APP_PORT ?? process.env.PORT;
  const appPort = requestedAppPort
    ? integer("CAVE_VNC_APP_PORT", Number(requestedAppPort), 1, 65_535)
    : await firstFreePort() ?? 0;
  if (!appPort) throw new Error("no app port is free in 3000..3010");
  if (new Set([vncPort, viewerPort, appPort]).size !== 3) {
    throw new Error("app, VNC, and noVNC ports must be different");
  }
  for (const port of [vncPort, viewerPort, appPort]) {
    if (!(await isPortFree(port))) throw new Error(`127.0.0.1:${port} is already in use`);
  }

  const geometry = process.env.CAVE_VNC_GEOMETRY ?? "1440x900x24";
  const [screenWidth, screenHeight] = dimensions("CAVE_VNC_GEOMETRY", geometry, true);
  const windowSize = process.env.CAVE_VNC_WINDOW_SIZE ?? "1180x760";
  const [windowWidth, windowHeight] = dimensions("CAVE_VNC_WINDOW_SIZE", windowSize, false);
  if (windowWidth > screenWidth || windowHeight > screenHeight) {
    throw new Error("CAVE_VNC_WINDOW_SIZE must fit inside CAVE_VNC_GEOMETRY");
  }

  const fakeMode = process.env.CAVE_VNC_FAKE_RUNTIMES ?? "0";
  if (!/^[01]$/.test(fakeMode)) throw new Error("CAVE_VNC_FAKE_RUNTIMES must be 0 or 1");

  const required = [
    "Xvfb", "convert", "dbus-run-session", "feh", "lxpanel", "openbox", "setsid",
    "websockify", "x11vnc", "xauth", "xdpyinfo", "xdotool",
  ];
  const missing = [];
  for (const command of required) {
    if (!(await commandExists(command))) missing.push(command);
  }
  if (missing.length > 0) throw new Error(`missing required commands: ${missing.join(", ")}`);

  const artifactDir = path.resolve(repoRoot, process.env.CAVE_VNC_ARTIFACT_DIR ?? "artifacts/openvnc-qa");
  const wallpaperIcon = path.resolve(repoRoot, process.env.CAVE_VNC_WALLPAPER_ICON ?? "assets/brand/cave-icon.png");
  const panelProfile = fromHarness("desktop", "lxpanel.conf");
  if (!(await Bun.file(wallpaperIcon).exists())) throw new Error(`wallpaper icon not found: ${wallpaperIcon}`);
  if (!(await Bun.file(panelProfile).exists())) throw new Error(`LXPanel profile not found: ${panelProfile}`);

  return {
    display,
    vncPort,
    viewerPort,
    appPort,
    geometry,
    screenWidth,
    screenHeight,
    windowWidth,
    windowHeight,
    windowX: Math.floor((screenWidth - windowWidth) / 2),
    windowY: Math.floor((screenHeight - windowHeight) / 2),
    readyTimeoutSeconds: integer("CAVE_VNC_READY_TIMEOUT", 300),
    daemonTimeoutSeconds: integer("CAVE_VNC_DAEMON_TIMEOUT", 30),
    artifactDir,
    noVncRoot: await findNoVncRoot(),
    covenBin: await executable(process.env.CAVE_VNC_COVEN_BIN ?? process.env.COVEN_BIN, "coven"),
    fakeRuntimes: fakeMode === "1",
    wallpaperIcon,
    panelProfile,
    repoRoot,
  };
}
