import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export function optionValue(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
}

export function rootHelpText(): string {
  return `Coven QA process double

Commands:
  run       Run a supported harness
  adapter   Inspect harness adapters
  daemon    Manage the daemon
`;
}

export function scenarioFrom(prompt: string): string {
  return prompt.match(/\[qa:([a-z0-9-]+)\]/i)?.[1]?.toLowerCase() ?? "chat-round-trip";
}

export async function trace(file: string, payload: Record<string, unknown>): Promise<void> {
  const traceDir = process.env.COVEN_QA_TRACE_DIR?.trim();
  if (!traceDir) return;
  await mkdir(traceDir, { recursive: true });
  await appendFile(
    path.join(traceDir, file),
    `${JSON.stringify({ at: new Date().toISOString(), ...payload })}\n`,
    "utf8",
  );
}

export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

export async function emit(value: unknown, delayMs = 90): Promise<void> {
  writeJson(value);
  await Bun.sleep(delayMs);
}
