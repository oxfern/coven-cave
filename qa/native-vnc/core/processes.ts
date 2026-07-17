import { $ } from "bun";
import type { Subprocess } from "bun";

export type ManagedProcess = {
  logPath: string;
  name: string;
  process: Subprocess;
  stderrPath: string;
};

export function startManaged(
  name: string,
  argv: string[],
  options: { env?: Record<string, string | undefined>; logPath: string; cwd?: string },
): ManagedProcess {
  const extension = options.logPath.endsWith(".log") ? ".log" : "";
  const stderrPath = extension
    ? `${options.logPath.slice(0, -extension.length)}.stderr${extension}`
    : `${options.logPath}.stderr`;
  return {
    logPath: options.logPath,
    name,
    stderrPath,
    process: Bun.spawn(argv, {
      cwd: options.cwd,
      env: options.env,
      stdin: "ignore",
      stdout: Bun.file(options.logPath),
      stderr: Bun.file(stderrPath),
    }),
  };
}

export async function stopManaged(service: ManagedProcess | null): Promise<void> {
  if (!service || service.process.exitCode !== null) return;
  service.process.kill("SIGTERM");
  const completed = await Promise.race([
    service.process.exited.then(() => true),
    Bun.sleep(2_000).then(() => false),
  ]);
  if (!completed && service.process.exitCode === null) {
    service.process.kill("SIGKILL");
    await service.process.exited;
  }
}

export async function stopProcessGroup(pid: number | undefined): Promise<void> {
  if (!pid) return;
  const group = `-${pid}`;
  await $`kill -TERM -- ${group}`.quiet().nothrow();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const probe = await $`kill -0 -- ${group}`.quiet().nothrow();
    if (probe.exitCode !== 0) return;
    await Bun.sleep(100);
  }
  await $`kill -KILL -- ${group}`.quiet().nothrow();
}

export async function waitUntil(
  description: string,
  predicate: () => Promise<boolean>,
  options: { attempts: number; intervalMs: number },
): Promise<void> {
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    if (await predicate()) return;
    await Bun.sleep(options.intervalMs);
  }
  throw new Error(`${description} did not become ready`);
}

export async function commandExists(command: string): Promise<boolean> {
  return (await $`which ${command}`.quiet().nothrow()).exitCode === 0;
}
