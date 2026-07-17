#!/usr/bin/env bun

import { $ } from "bun";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import { emit, optionValue, rootHelpText, scenarioFrom, trace, writeJson } from "./protocol.ts";

const args = Bun.argv.slice(2);

function promptValue(): string {
  const separator = args.indexOf("--");
  return separator >= 0 ? args.slice(separator + 1).join(" ") : args.at(-1) ?? "";
}

function runHelp(): void {
  process.stdout.write(`Usage: coven run <HARNESS> [OPTIONS] -- <PROMPT>

Options:
      --stream-json
      --continue <SESSION_ID>
      --model <MODEL>
      --permission <MODE>
      --add-dir <DIR>
      --familiar <ID>
`);
}

function rootHelp(): void {
  process.stdout.write(rootHelpText());
}

async function delegateToRealCoven(): Promise<never> {
  const real = process.env.COVEN_QA_REAL_COVEN_BIN?.trim();
  if (!real) throw new Error("COVEN_QA_REAL_COVEN_BIN is required for this command");
  const result = await $`${[real, ...args]}`.env(process.env).quiet().nothrow();
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.exitCode);
}

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  rootHelp();
  process.exit(0);
}
if (args[0] === "--version" || args[0] === "-V") {
  process.stdout.write("coven 0.1.1-qa\n");
  process.exit(0);
}
if (args[0] === "adapter" && args[1] === "list" && args.includes("--json")) {
  writeJson([{
    id: "moonbeam",
    label: "Moonbeam external manifest",
    executable: "moonbeam",
    available: true,
    install_hint: "QA-only untrusted adapter",
    source: "external-manifest",
    manifest_path: "/qa/adapters/moonbeam.json",
  }]);
  process.exit(0);
}
if (args[0] !== "run") await delegateToRealCoven();
if (args.includes("--help")) {
  runHelp();
  process.exit(0);
}

const harness = args[1] ?? "unknown";
const prompt = promptValue();
const scenario = scenarioFrom(prompt);
const continuedSession = optionValue(args, "--continue");
const model = optionValue(args, "--model") ?? `qa/${harness}-deterministic`;
const permission = optionValue(args, "--permission") ?? "default";
const addDirs = args.flatMap((arg, index) => arg === "--add-dir" ? [args[index + 1]] : []).filter(Boolean);
const sessionId = continuedSession ?? `qa-${harness}-${randomUUID()}`;

await trace("fake-coven.jsonl", {
  command: "run",
  harness,
  scenario,
  continuedSession,
  model,
  permission,
  addDirs,
  familiar: optionValue(args, "--familiar"),
});

if (scenario === "resume-recovery" && continuedSession) {
  process.stderr.write(`session ${continuedSession} not found in local store\n`);
  process.exit(1);
}
if (scenario === "failure-ux") {
  process.stderr.write("401 unauthorized: QA provider credentials were intentionally not supplied\n");
  await emit({ type: "result", duration_ms: 120, is_error: true }, 10);
  process.exit(1);
}

await emit({ type: "system", subtype: "init", session_id: sessionId, model });

if (scenario === "trust-boundary") {
  const boundaryPath = path.join(homedir(), "outside-granted-roots", "secret.txt");
  await emit({
    type: "assistant",
    message: {
      content: [
        { type: "tool_use", id: "qa-boundary-read", name: "Read", input: { file_path: boundaryPath } },
        { type: "text", text: `${harness} QA attempted an out-of-scope read so Cave can surface the boundary warning.` },
      ],
    },
  });
  await emit({
    type: "user",
    message: {
      content: [{
        type: "tool_result",
        tool_use_id: "qa-boundary-read",
        content: "blocked by the QA boundary",
        is_error: true,
      }],
    },
  });
} else {
  const detail = scenario === "permissions-scope"
    ? `Permission ${permission}; ${addDirs.length} additional trusted director${addDirs.length === 1 ? "y" : "ies"}.`
    : `Deterministic ${harness} response streamed without provider credentials.`;
  if (harness === "hermes" || harness === "opencode") {
    process.stdout.write(`${detail}\n`);
    await Bun.sleep(90);
  } else {
    await emit({ type: "assistant", message: { content: [{ type: "text", text: detail }] } });
  }
}

await emit({
  type: "result",
  duration_ms: 260,
  is_error: false,
  usage: { input_tokens: 12, output_tokens: 18 },
  total_cost_usd: 0,
}, 10);
