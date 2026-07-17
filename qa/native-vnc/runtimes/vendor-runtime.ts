#!/usr/bin/env bun

import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import { emit, optionValue, scenarioFrom, trace, writeJson } from "./protocol.ts";

export async function runVendorRuntime(runtime: string): Promise<void> {
  const args = Bun.argv.slice(2);

  const promptValue = () => {
    const promptIndex = args.findIndex((arg) => arg === "-p" || arg === "--message");
    return promptIndex >= 0 ? args[promptIndex + 1] ?? "" : args.at(-1) ?? "";
  };

  if (args.includes("--version") || args.includes("-V") || args.includes("version")) {
    process.stdout.write(`${runtime} 1.0.0-qa\n`);
    return;
  }

  if (runtime === "openclaw") {
    if (args[0] === "agents" && args[1] === "list") {
      writeJson([{ id: "qa-openclaw", name: "QA OpenClaw", identityName: "QA OpenClaw", isDefault: true }]);
      return;
    }
    if (args[0] === "agent") {
      const prompt = promptValue();
      const scenario = scenarioFrom(prompt);
      const sessionId = optionValue(args, "--session-id") ?? `qa-openclaw-${randomUUID()}`;
      const warnings = {
        localFileAttachments: /image attachments are not supported by this harness|cannot access local image files|not available to this runtime/i.test(prompt),
        modelOverride: /model override|agent-owned/i.test(prompt),
      };
      await trace("fake-runtime.jsonl", {
        runtime,
        command: "agent",
        scenario,
        sessionId,
        modelArgument: optionValue(args, "--model"),
        warnings,
      });
      writeJson({
        status: "ok",
        sessionId: `gateway-${sessionId}`,
        result: {
          payloads: [{
            text: scenario === "openclaw-warnings"
              ? `OpenClaw bridge stayed local. Attachment warning: ${warnings.localFileAttachments ? "present" : "missing"}; model selection remains agent-owned.`
              : "Deterministic OpenClaw bridge response without provider credentials.",
          }],
        },
      });
      return;
    }
  }

  if (runtime !== "copilot") {
    const prompt = promptValue();
    await trace("fake-runtime.jsonl", { runtime, command: "one-shot", scenario: scenarioFrom(prompt) });
    process.stdout.write(`Deterministic ${runtime} one-shot response without provider credentials.\n`);
    return;
  }

  const prompt = promptValue();
  const scenario = scenarioFrom(prompt);
  const resumedSession = optionValue(args, "--resume");
  const sessionId = resumedSession ?? optionValue(args, "--session-id") ?? `qa-copilot-${randomUUID()}`;
  const model = optionValue(args, "--model") ?? "qa/copilot-deterministic";
  const addDirs = args.flatMap((arg, index) => arg === "--add-dir" ? [args[index + 1]] : []).filter(Boolean);
  const readOnly = args.includes("--deny-tool");
  await trace("fake-runtime.jsonl", { runtime, command: "stream", scenario, sessionId, model, addDirs, readOnly });

  if (scenario === "resume-recovery" && resumedSession) {
    process.stderr.write(`No session, task, or name matched '${resumedSession}'\n`);
    process.exitCode = 1;
    return;
  }
  if (scenario === "failure-ux") {
    process.stderr.write("401 unauthorized: QA Copilot credentials were intentionally not supplied\n");
    writeJson({ type: "result", sessionId, exitCode: 1, usage: { sessionDurationMs: 120 } });
    process.exitCode = 1;
    return;
  }

  const messageId = `qa-message-${randomUUID()}`;
  const text = scenario === "permissions-scope"
    ? `Copilot read-only=${readOnly}; ${addDirs.length} trusted director${addDirs.length === 1 ? "y" : "ies"}.`
    : "Deterministic Copilot JSONL response without provider credentials.";
  if (scenario === "trust-boundary") {
    const boundaryPath = path.join(homedir(), "outside-granted-roots", "secret.txt");
    await emit({
      type: "tool.execution_start",
      data: { toolCallId: "qa-copilot-boundary", toolName: "Read", arguments: { file_path: boundaryPath }, model },
    });
    await emit({
      type: "tool.execution_complete",
      data: { toolCallId: "qa-copilot-boundary", success: false, result: { content: "blocked by the QA boundary" }, model },
    });
  }
  const split = Math.max(1, Math.floor(text.length / 2));
  await emit({ type: "assistant.message_delta", data: { messageId, deltaContent: text.slice(0, split), model } });
  await emit({ type: "assistant.message_delta", data: { messageId, deltaContent: text.slice(split), model } });
  await emit({ type: "assistant.message", data: { messageId, content: text, toolRequests: [], model } });
  await emit({ type: "result", sessionId, exitCode: 0, usage: { sessionDurationMs: 280 } }, 10);
}
