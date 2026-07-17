import { access, chmod, copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { HarnessConfig } from "./config.ts";
import { fromHarness } from "./paths.ts";

export type ArtifactPaths = {
  ready: string;
  viewerUrl: string;
  appUrl: string;
  runtime: string;
  daemonReady: string;
  daemonHealth: string;
  desktopReady: string;
};

export type HarnessState = {
  root: string;
  home: string;
  temp: string;
  xauthority: string;
  fakeBin: string;
  artifacts: ArtifactPaths;
};

const runtimeIds = ["codex", "claude", "copilot", "hermes", "hermes-coven", "opencode", "openclaw"];

export async function createState(config: HarnessConfig): Promise<HarnessState> {
  await mkdir(config.artifactDir, { recursive: true });
  const root = await mkdtemp(path.join(os.tmpdir(), "covencave-vnc-qa."));
  const home = path.join(root, "home");
  const temp = path.join(root, "tmp");
  const xauthority = path.join(root, "Xauthority");
  const fakeBin = path.join(root, "fake-bin");
  const panelDir = path.join(root, "xdg", "config", "lxpanel", "covencave", "panels");

  await Promise.all([
    mkdir(path.join(home, ".coven", "cave"), { recursive: true }),
    mkdir(path.join(home, ".openclaw", "agents", "qa-openclaw"), { recursive: true }),
    mkdir(path.join(home, "Desktop"), { recursive: true }),
    mkdir(path.join(home, "Templates"), { recursive: true }),
    mkdir(temp, { recursive: true }),
    mkdir(path.join(root, "xdg", "cache"), { recursive: true }),
    mkdir(panelDir, { recursive: true }),
    mkdir(path.join(root, "xdg", "data"), { recursive: true }),
    mkdir(path.join(root, "xdg", "runtime"), { recursive: true }),
  ]);
  await copyFile(config.panelProfile, path.join(panelDir, "panel"));
  await chmod(path.join(root, "xdg", "runtime"), 0o700);
  await writeFile(xauthority, "");
  await chmod(xauthority, 0o600);

  if (config.fakeRuntimes) {
    await mkdir(fakeBin, { recursive: true });
    const entry = fromHarness("runtimes", "vendor-runtime.ts");
    for (const runtimeId of runtimeIds) {
      const shim = path.join(fakeBin, runtimeId);
      await writeFile(
        shim,
        `#!/usr/bin/env bun\nimport { runVendorRuntime } from ${JSON.stringify(entry)};\nawait runVendorRuntime(${JSON.stringify(runtimeId)});\n`,
      );
      await chmod(shim, 0o755);
    }
    const covenShim = path.join(fakeBin, "coven");
    await writeFile(
      covenShim,
      `#!/usr/bin/env bun\nimport ${JSON.stringify(fromHarness("runtimes", "fake-coven.ts"))};\n`,
    );
    await chmod(covenShim, 0o755);
  }

  const artifact = (name: string) => path.join(config.artifactDir, name);
  const artifacts = {
    ready: artifact("native-window.ready"),
    viewerUrl: artifact("viewer.url"),
    appUrl: artifact("app.url"),
    runtime: artifact("runtime.json"),
    daemonReady: artifact("daemon.ready"),
    daemonHealth: artifact("daemon-health.json"),
    desktopReady: artifact("desktop.ready"),
  };
  await Promise.all(Object.values(artifacts).map((file) => rm(file, { force: true })));

  return { root, home, temp, xauthority, fakeBin, artifacts };
}

export async function removeState(state: HarnessState): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await rm(state.root, { recursive: true, force: true }).catch(() => undefined);
    if (!(await access(state.root).then(() => true).catch(() => false))) return;
    await Bun.sleep(100);
  }
}

export function appEnvironment(config: HarnessConfig, state: HarnessState): Record<string, string> {
  const originalHome = process.env.HOME ?? config.repoRoot;
  const env: Record<string, string> = {
    ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] != null)),
    DISPLAY: config.display,
    XAUTHORITY: state.xauthority,
    HOME: state.home,
    TMPDIR: state.temp,
    CARGO_HOME: process.env.CARGO_HOME ?? path.join(originalHome, ".cargo"),
    RUSTUP_HOME: process.env.RUSTUP_HOME ?? path.join(originalHome, ".rustup"),
    XDG_CACHE_HOME: path.join(state.root, "xdg", "cache"),
    XDG_CONFIG_HOME: path.join(state.root, "xdg", "config"),
    XDG_DATA_HOME: path.join(state.root, "xdg", "data"),
    XDG_RUNTIME_DIR: path.join(state.root, "xdg", "runtime"),
    COVEN_HOME: path.join(state.home, ".coven"),
    COVEN_CAVE_HOME: path.join(state.home, ".coven", "cave"),
    COVEN_PREFERENCES_PATH: path.join(state.root, "preferences.json"),
    COVEN_BACKDROP_PATH: path.join(state.root, "backdrop.jpg"),
    COVEN_THEME_PATH: path.join(state.root, "theme.json"),
    COVEN_CAVE_E2E: "1",
    NEXT_TELEMETRY_DISABLED: "1",
    HOSTNAME: "127.0.0.1",
    GDK_BACKEND: "x11",
    LIBGL_ALWAYS_SOFTWARE: "1",
    NO_AT_BRIDGE: "1",
    WEBKIT_DISABLE_COMPOSITING_MODE: "1",
    WEBKIT_DISABLE_DMABUF_RENDERER: "1",
  };

  if (config.fakeRuntimes) {
    env.PATH = `${state.fakeBin}:${env.PATH ?? ""}`;
    env.COVEN_BIN = path.join(state.fakeBin, "coven");
    env.COVEN_QA_REAL_COVEN_BIN = config.covenBin;
    env.COVEN_QA_TRACE_DIR = path.join(config.artifactDir, "runtime-traces");
    env.OPENCLAW_BIN = path.join(state.fakeBin, "openclaw");
    env.COVEN_CAVE_DEV_INIT_SCRIPT = process.env.COVEN_CAVE_DEV_INIT_SCRIPT
      ?? 'window.setTimeout(()=>window.dispatchEvent(new Event("cave:onboarding-open")),1500)';
  } else {
    env.COVEN_BIN = config.covenBin;
    env.COVEN_CAVE_DEV_INIT_SCRIPT = process.env.COVEN_CAVE_DEV_INIT_SCRIPT
      ?? 'try{window.localStorage.setItem("cave:onboarding:dismissed","1")}catch{}';
  }
  return env;
}
