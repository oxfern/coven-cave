#!/usr/bin/env bun

import { $ } from "bun";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "../core/paths.ts";
import { waitUntil } from "../core/processes.ts";

const artifactDir = path.resolve(
  repoRoot,
  process.env.CAVE_VNC_ARTIFACT_DIR ?? "artifacts/openvnc-qa",
);
const launcherLog = path.join(artifactDir, "launcher.log");
const launcherErrorLog = path.join(artifactDir, "launcher.stderr.log");
const readyMarker = path.join(artifactDir, "native-window.ready");
const env = {
  ...process.env,
  CAVE_VNC_ARTIFACT_DIR: artifactDir,
  CAVE_VNC_FAKE_RUNTIMES: "1",
  CAVE_VNC_READY_TIMEOUT: process.env.CAVE_VNC_READY_TIMEOUT ?? "900",
  CAVE_VNC_RECORD_SCENARIOS: process.env.CAVE_VNC_RECORD_SCENARIOS ?? "1",
};

await rm(artifactDir, { recursive: true, force: true });
await mkdir(artifactDir, { recursive: true });

const launcher = Bun.spawn(["bun", "qa/native-vnc/cli/start.ts"], {
  cwd: repoRoot,
  env,
  stdin: "ignore",
  stdout: Bun.file(launcherLog),
  stderr: Bun.file(launcherErrorLog),
});

try {
  await waitUntil(
    "native window",
    async () => {
      if (launcher.exitCode !== null) {
        const [output, errors] = await Promise.all([
          Bun.file(launcherLog).text(),
          Bun.file(launcherErrorLog).text(),
        ]);
        throw new Error(`VNC launcher exited before readiness:\n${output}${errors}`);
      }
      return Bun.file(readyMarker).exists();
    },
    { attempts: Number(env.CAVE_VNC_READY_TIMEOUT), intervalMs: 1_000 },
  );
  await $`bun qa/native-vnc/cli/smoke.ts`.cwd(repoRoot).env(env);
  await $`bun qa/native-vnc/cli/record-scenarios.ts`.cwd(repoRoot).env(env);
} finally {
  if (launcher.exitCode === null) launcher.kill("SIGTERM");
  const stopped = await Promise.race([
    launcher.exited.then(() => true),
    Bun.sleep(10_000).then(() => false),
  ]);
  if (!stopped && launcher.exitCode === null) {
    launcher.kill("SIGKILL");
    await launcher.exited;
  }
}
