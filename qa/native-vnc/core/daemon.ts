import { $ } from "bun";
import { request } from "node:http";
import path from "node:path";
import type { HarnessConfig } from "./config.ts";
import type { HarnessState } from "./state.ts";
import { waitUntil } from "./processes.ts";

export async function readDaemonHealth(state: HarnessState): Promise<Record<string, unknown>> {
  const socketPath = path.join(state.home, ".coven", "coven.sock");
  return new Promise((resolve, reject) => {
    const req = request(
      { socketPath, path: "/api/v1/health", method: "GET", timeout: 1_000 },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            const status = response.statusCode ?? 0;
            if (status < 200 || status >= 300 || body.ok !== true) {
              reject(new Error("daemon health endpoint is not ready"));
              return;
            }
            resolve(body);
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("daemon health timeout")));
    req.on("error", reject);
    req.end();
  });
}

export async function startDaemon(
  config: HarnessConfig,
  state: HarnessState,
  env: Record<string, string>,
): Promise<void> {
  const log = Bun.file(path.join(config.artifactDir, "daemon-start.log"));
  const start = await $`${config.covenBin} daemon start --color never`
    .env(env)
    .cwd(config.repoRoot)
    .quiet()
    .nothrow();
  await Bun.write(log, Buffer.concat([start.stdout, start.stderr]));
  if (start.exitCode !== 0) throw new Error("the isolated Coven daemon failed to start");

  let health: Record<string, unknown> | null = null;
  await waitUntil(
    "isolated Coven daemon",
    async () => {
      try {
        health = await readDaemonHealth(state);
        return true;
      } catch {
        return false;
      }
    },
    { attempts: config.daemonTimeoutSeconds * 4, intervalMs: 250 },
  );
  await Bun.write(state.artifacts.daemonHealth, `${JSON.stringify(health, null, 2)}\n`);
  await Bun.write(state.artifacts.daemonReady, "");
}

export async function stopDaemon(
  config: HarnessConfig,
  env: Record<string, string>,
): Promise<void> {
  const result = await $`${config.covenBin} daemon stop --color never`
    .env(env)
    .cwd(config.repoRoot)
    .quiet()
    .nothrow();
  await Bun.write(
    path.join(config.artifactDir, "daemon-stop.log"),
    Buffer.concat([result.stdout, result.stderr]),
  );
}
