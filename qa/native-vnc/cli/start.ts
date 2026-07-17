#!/usr/bin/env bun

import { $ } from "bun";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { loadConfig } from "../core/config.ts";
import { startDaemon, stopDaemon } from "../core/daemon.ts";
import { isPortListening } from "../core/network.ts";
import {
  startManaged,
  stopManaged,
  stopProcessGroup,
  waitUntil,
  type ManagedProcess,
} from "../core/processes.ts";
import { appEnvironment, createState, removeState } from "../core/state.ts";

const label = "[qa:native-vnc]";

async function main(): Promise<number> {
  const config = await loadConfig();
  const state = await createState(config);
  const env = appEnvironment(config, state);
  const displayEnv = { ...env, DISPLAY: config.display, XAUTHORITY: state.xauthority };
  const services: ManagedProcess[] = [];
  let daemonStarted = false;
  let app: ManagedProcess | null = null;

  const addService = (service: ManagedProcess) => {
    services.push(service);
    return service;
  };

  try {
    const cookie = randomBytes(16).toString("hex");
    await $`xauth -f ${state.xauthority} add ${config.display} . ${cookie}`.quiet();

    const xvfb = addService(startManaged(
      "Xvfb",
      ["Xvfb", config.display, "-screen", "0", config.geometry, "-auth", state.xauthority, "-nolisten", "tcp", "-noreset"],
      { env: displayEnv, logPath: path.join(config.artifactDir, "xvfb.log"), cwd: config.repoRoot },
    ));
    await waitUntil(
      "X display",
      async () => {
        if (xvfb.process.exitCode !== null) throw new Error("Xvfb exited during startup");
        return (await $`xdpyinfo -display ${config.display}`.env(displayEnv).quiet().nothrow()).exitCode === 0;
      },
      { attempts: 50, intervalMs: 100 },
    );

    addService(startManaged(
      "Openbox",
      ["openbox"],
      { env: displayEnv, logPath: path.join(config.artifactDir, "openbox.log"), cwd: config.repoRoot },
    ));

    const wallpaper = path.join(config.artifactDir, "desktop-wallpaper.png");
    const wallpaperIcon = path.join(config.artifactDir, "desktop-icon.png");
    await $`convert ${config.wallpaperIcon} -resize 72x72 ${wallpaperIcon}`.quiet();
    await $`convert -size ${`${config.screenWidth}x${config.screenHeight}`} ${"gradient:#101b2b-#25122f"} ${wallpaperIcon} -gravity northwest -geometry +28+28 -composite ${wallpaper}`.quiet();

    const panel = addService(startManaged(
      "LXPanel",
      ["lxpanel", "--profile", "covencave"],
      { env: displayEnv, logPath: path.join(config.artifactDir, "lxpanel.log"), cwd: config.repoRoot },
    ));
    await Bun.sleep(500);
    if (panel.process.exitCode !== null) throw new Error("LXPanel exited during desktop startup");
    await $`feh --no-fehbg --bg-fill ${wallpaper}`.env(displayEnv).quiet();
    await Bun.write(state.artifacts.desktopReady, "");

    const vnc = addService(startManaged(
      "x11vnc",
      [
        "x11vnc", "-display", config.display, "-auth", state.xauthority,
        "-rfbport", String(config.vncPort), "-localhost", "-nopw", "-forever",
        "-shared", "-noxdamage", "-o", path.join(config.artifactDir, "x11vnc.log"),
      ],
      { env: displayEnv, logPath: path.join(config.artifactDir, "x11vnc-process.log"), cwd: config.repoRoot },
    ));
    await waitUntil(
      "VNC endpoint",
      async () => {
        if (vnc.process.exitCode !== null) throw new Error("x11vnc exited during startup");
        return isPortListening(config.vncPort);
      },
      { attempts: 100, intervalMs: 100 },
    );

    const viewer = addService(startManaged(
      "noVNC websockify",
      [
        "websockify", "--web", config.noVncRoot,
        `127.0.0.1:${config.viewerPort}`, `127.0.0.1:${config.vncPort}`,
      ],
      { env: displayEnv, logPath: path.join(config.artifactDir, "novnc.log"), cwd: config.repoRoot },
    ));
    await waitUntil(
      "noVNC viewer",
      async () => {
        if (viewer.process.exitCode !== null) throw new Error("websockify exited during startup");
        return isPortListening(config.viewerPort);
      },
      { attempts: 100, intervalMs: 100 },
    );

    const viewerUrl = `http://127.0.0.1:${config.viewerPort}/vnc.html?host=127.0.0.1&port=${config.viewerPort}&autoconnect=1&resize=scale`;
    const appUrl = `http://127.0.0.1:${config.appPort}`;
    await Promise.all([
      Bun.write(state.artifacts.viewerUrl, `${viewerUrl}\n`),
      Bun.write(state.artifacts.appUrl, `${appUrl}\n`),
      Bun.write(state.artifacts.runtime, `${JSON.stringify({
        stateDir: state.root,
        home: state.home,
        covenHome: env.COVEN_HOME,
        caveHome: env.COVEN_CAVE_HOME,
        xauthority: state.xauthority,
        display: config.display,
        geometry: config.geometry,
        appUrl,
        realCovenBin: config.covenBin,
      }, null, 2)}\n`),
    ]);

    await startDaemon(config, state, env);
    daemonStarted = true;
    console.log(`${label} isolated Coven daemon is healthy`);
    console.log(`${label} endpoint: 127.0.0.1::${config.vncPort} (loopback only)`);
    console.log(`${label} watch: ${viewerUrl} (loopback only)`);
    console.log(`${label} app: ${appUrl}`);
    console.log(`${label} open: bun qa/native-vnc/cli/view.ts`);
    console.log(`${label} artifacts: ${config.artifactDir}`);

    app = startManaged(
      "CovenCave",
      ["setsid", "dbus-run-session", "--", "bun", "run", "dev:app", ...Bun.argv.slice(2)],
      {
        env: { ...env, PORT: String(config.appPort) },
        logPath: path.join(config.artifactDir, "app.log"),
        cwd: config.repoRoot,
      },
    );

    let windowId = "";
    await waitUntil(
      "native CovenCave window",
      async () => {
        if (app?.process.exitCode !== null) {
          throw new Error(`Tauri exited before the native window was ready; inspect ${app?.logPath} and ${app?.stderrPath}`);
        }
        const result = await $`xdotool search --onlyvisible --name ${"^CovenCave$"}`
          .env(displayEnv)
          .quiet()
          .nothrow();
        windowId = result.stdout.toString().trim().split(/\r?\n/)[0] ?? "";
        return result.exitCode === 0 && Boolean(windowId);
      },
      { attempts: config.readyTimeoutSeconds, intervalMs: 1_000 },
    );
    await $`xdotool windowsize --sync ${windowId} ${config.windowWidth} ${config.windowHeight}`.env(displayEnv).quiet();
    await $`xdotool windowmove --sync ${windowId} ${config.windowX} ${config.windowY}`.env(displayEnv).quiet();
    await Bun.write(state.artifacts.ready, "");
    console.log(`${label} native CovenCave window is ready (${config.windowWidth}x${config.windowHeight}, centered)`);

    const signal = new Promise<number>((resolve) => {
      process.once("SIGINT", () => resolve(130));
      process.once("SIGTERM", () => resolve(143));
    });
    return await Promise.race([app.process.exited, signal]);
  } finally {
    await stopProcessGroup(app?.process.pid);
    if (daemonStarted) await stopDaemon(config, env);
    for (const service of services.reverse()) await stopManaged(service);
    await removeState(state);
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`${label} ERROR:`, error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
