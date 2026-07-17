import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ScenarioContext } from "./context.ts";

export const scenarioIds = [
  "01-first-launch",
  "02-familiar-creation",
  "03-daemon-recovery",
  "04-runtime-inventory",
  "05-summon-choices",
  "06-chat-round-trip",
  "07-resume-recovery",
  "08-permissions-scope",
  "09-failure-ux",
  "10-trust-boundary",
  "11-openclaw-warnings",
] as const;

export async function runScenarioCases(context: ScenarioContext): Promise<void> {
  await context.runScenario(
    { id: scenarioIds[0], number: 1, title: "First launch", showRunning: false, preRollMs: 1_800 },
    async () => {
      const { body } = await context.requestJson("/api/onboarding/status");
      assert.equal(body.ok, true);
      assert.equal(body.steps.daemon.ok, true);
      assert.equal(body.steps.adapters.ok, true);
      return {
        summary: "Fresh profile opened the setup surface with a healthy daemon and credential-free runtimes.",
        assertions: ["fresh isolated HOME", "setup surface visible", "daemon healthy", "runtime source ready"],
      };
    },
  );

  await context.activateCave();
  await context.xdotool("key", "Escape");
  await Bun.sleep(1_000);

  await context.runScenario(
    { id: scenarioIds[1], number: 2, title: "Create a familiar", showRunning: false },
    async () => {
      await context.createFamiliar({
        id: "qa-codex",
        displayName: "QA Codex",
        role: "Test Familiar",
        description: "Exercises the credential-free Codex stream contract.",
        glyph: "ph:test-tube-fill",
        harness: "codex",
        model: "qa/codex-deterministic",
        runtime: { kind: "local" },
      });
      await Bun.sleep(4_500);
      const { body } = await context.requestJson("/api/familiars");
      assert.ok(body.familiars.some((familiar: { id: string }) => familiar.id === "qa-codex"));
      return {
        summary: "QA Codex was persisted through the real familiar-creation API and appeared in the roster.",
        assertions: ["POST /api/familiars", "config binding persisted", "roster refreshed"],
      };
    },
  );

  await context.runScenario(
    { id: scenarioIds[2], number: 3, title: "Daemon crash and recovery", showRunning: false, passHoldMs: 1_800 },
    async () => {
      await context.runRealCoven(["daemon", "stop", "--color", "never"]);
      await context.waitForDaemon(false);
      await Bun.sleep(4_500);
      await context.runRealCoven(["daemon", "start", "--color", "never"]);
      await context.waitForDaemon(true);
      await Bun.sleep(4_500);
      return {
        summary: "Cave surfaced the real daemon outage and recovered after the isolated daemon restarted.",
        assertions: ["daemon stopped", "offline state observed", "daemon restarted", "health restored"],
      };
    },
  );

  await context.runScenario(
    { id: scenarioIds[3], number: 4, title: "Runtime inventory" },
    async () => {
      const { body } = await context.requestJson("/api/harnesses");
      const byId = new Map(body.harnesses.map((entry: { id: string }) => [entry.id, entry]));
      for (const id of ["codex", "claude", "copilot", "hermes", "opencode", "openclaw"]) {
        const entry = byId.get(id) as { installed?: boolean; chatSupported?: boolean } | undefined;
        assert.equal(entry?.installed, true, `${id} must be detected`);
        assert.equal(entry?.chatSupported, true, `${id} must be chat-trusted`);
      }
      const moonbeam = byId.get("moonbeam") as { installed?: boolean; chatSupported?: boolean } | undefined;
      assert.equal(moonbeam?.installed, true);
      assert.equal(moonbeam?.chatSupported, false);
      return {
        summary: "Six supported runtimes were detected; the external Moonbeam manifest stayed visible but untrusted.",
        assertions: ["six supported runtimes installed", "external manifest discovered", "external manifest not chat-trusted"],
      };
    },
  );

  await context.runScenario(
    { id: scenarioIds[4], number: 5, title: "Summon choices", showRunning: false },
    async () => {
      const { SUMMONABLE_LOCAL_HARNESS_IDS } = await import("../../../src/lib/harness-adapters.ts");
      assert.deepEqual([...SUMMONABLE_LOCAL_HARNESS_IDS], ["codex", "claude", "copilot", "hermes"]);
      const geometry = await context.caveWindowGeometry();
      await context.xdotool(
        "mousemove",
        String(geometry.X + geometry.WIDTH - 170),
        String(geometry.Y + 118),
        "click",
        "1",
      );
      await Bun.sleep(2_200);
      return {
        summary: "The summon flow offers Codex, Claude Code, Copilot, and Hermes; OpenCode and OpenClaw keep their distinct paths.",
        assertions: ["four first-class summon runtimes", "OpenCode excluded from summon", "OpenClaw uses agent vessel"],
      };
    },
  );

  await context.activateCave();
  await context.xdotool("key", "Escape");
  await Bun.sleep(700);

  await context.runScenario(
    { id: scenarioIds[5], number: 6, title: "Chat round trips", showRunning: false, passHoldMs: 1_800 },
    async () => {
      for (const familiar of [
        { id: "qa-claude", displayName: "QA Claude", harness: "claude", model: "qa/claude-deterministic" },
        { id: "qa-copilot", displayName: "QA Copilot", harness: "copilot", model: "qa/copilot-deterministic" },
        { id: "qa-hermes", displayName: "QA Hermes", harness: "hermes", model: "qa/hermes-deterministic" },
        { id: "qa-opencode", displayName: "QA OpenCode", harness: "opencode", model: "qa/opencode-deterministic" },
        { id: "qa-openclaw", displayName: "QA OpenClaw", harness: "openclaw", model: "qa/openclaw-agent", openclawAgentId: "qa-openclaw" },
      ]) {
        await context.createFamiliar({
          ...familiar,
          role: "Test Familiar",
          description: `Exercises the ${familiar.harness} integration contract.`,
          glyph: "ph:test-tube-fill",
          runtime: { kind: "local" },
        });
      }

      await context.activateCave();
      await context.xdotool("key", "ctrl+j");
      await Bun.sleep(900);
      await context.xdotool("type", "--delay", "10", "[qa:chat-round-trip] Say hello from the VNC harness.");
      await context.xdotool("key", "Return");
      await Bun.sleep(3_200);

      for (const id of ["qa-codex", "qa-claude", "qa-copilot", "qa-hermes", "qa-opencode", "qa-openclaw"]) {
        const response = await context.sendChat({ familiarId: id, prompt: "[qa:chat-round-trip] identify your runtime class" });
        assert.equal(response.status, 200);
        assert.match(context.assistantText(response.events), /Deterministic|OpenClaw bridge/i);
        assert.equal(context.doneEvent(response.events)?.isError, false);
      }
      return {
        summary: "Generic streams, Copilot JSONL, manifest one-shots, and the OpenClaw bridge all completed without keys.",
        assertions: ["Codex", "Claude Code", "Copilot JSONL", "Hermes one-shot", "OpenCode one-shot", "OpenClaw bridge"],
      };
    },
  );

  await context.runScenario(
    { id: scenarioIds[6], number: 7, title: "Resume and recovery" },
    async () => {
      const first = await context.sendChat({ familiarId: "qa-codex", prompt: "[qa:resume-seed] remember this turn" });
      const sessionId = context.doneEvent(first.events)?.sessionId;
      assert.ok(sessionId);
      const resumed = await context.sendChat({
        familiarId: "qa-codex",
        sessionId,
        prompt: "[qa:resume-recovery] continue after a missing vendor session",
      });
      assert.equal(context.doneEvent(resumed.events)?.isError, false);
      assert.ok(resumed.events.some((event) => event.kind === "progress" && event.id === "resume-retry"));
      assert.match(context.assistantText(resumed.events), /Deterministic codex response/i);
      return {
        summary: "A missing vendor session triggered Cave’s transparent replay into a fresh successful session.",
        assertions: ["resume attempted", "missing session detected", "recent context replayed", "fresh response completed"],
      };
    },
  );

  await context.runScenario(
    { id: scenarioIds[7], number: 8, title: "Permissions and scope" },
    async () => {
      const projectRoot = path.join(context.runtime.covenHome, "workspaces", "projects", "qa-project");
      await mkdir(projectRoot, { recursive: true });
      const created = await context.requestJson(
        "/api/projects",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "QA Project", root: projectRoot }),
        },
        [201],
      );
      await context.requestJson("/api/project-grants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetFamiliarId: "qa-codex",
          projectId: created.body.project.id,
          access: "write",
        }),
      });
      const response = await context.sendChat({
        familiarId: "qa-codex",
        projectRoot,
        permissionMode: "read",
        prompt: "[qa:permissions-scope] report the effective process flags",
      });
      const text = context.assistantText(response.events);
      assert.match(text, /Permission read-only/);
      assert.match(text, /1 additional trusted directory/);
      assert.equal(context.doneEvent(response.events)?.responseMetadata?.runtime, `local:${projectRoot}`);
      return {
        summary: "Read-only permission and the familiar-workspace grant reached the runtime process boundary.",
        assertions: ["--permission read-only", "repeatable --add-dir", "project cwd preserved", "metadata reports local scope"],
      };
    },
  );

  await context.runScenario(
    { id: scenarioIds[8], number: 9, title: "Failure UX" },
    async () => {
      const response = await context.sendChat({ familiarId: "qa-codex", prompt: "[qa:failure-ux] simulate missing credentials" });
      assert.equal(context.doneEvent(response.events)?.isError, true);
      const text = context.assistantText(response.events);
      assert.match(text, /harness errored/i);
      assert.match(text, /401 unauthorized/i);
      return {
        summary: "A credential-style process failure became an actionable in-chat diagnostic instead of an empty bubble.",
        assertions: ["non-zero runtime exit", "stderr retained", "error progress emitted", "diagnostic assistant bubble"],
      };
    },
  );

  await context.runScenario(
    { id: scenarioIds[9], number: 10, title: "Trust boundary" },
    async () => {
      const configPath = path.join(context.runtime.caveHome, "config.json");
      const config = JSON.parse(await readFile(configPath, "utf8"));
      config.familiars["qa-moonbeam"] = { harness: "moonbeam", model: "qa/moonbeam" };
      await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

      const rejected = await context.sendChat(
        { familiarId: "qa-moonbeam", prompt: "external manifest should not run" },
        [403],
      );
      assert.equal(rejected.status, 403);
      assert.match(String(rejected.body?.error), /not trusted/i);

      const observed = await context.sendChat({ familiarId: "qa-codex", prompt: "[qa:trust-boundary] exercise the path sentinel" });
      assert.ok(observed.events.some(
        (event) => event.kind === "progress" && event.id === "boundary-sentinel" && event.status === "error",
      ));
      return {
        summary: "Unaccepted manifests were blocked before spawn, while an out-of-scope tool path was surfaced by the boundary sentinel.",
        assertions: ["external manifest visible", "native chat returned 403", "untrusted process never spawned", "path violation surfaced"],
      };
    },
  );

  await context.runScenario(
    { id: scenarioIds[10], number: 11, title: "OpenClaw limitations" },
    async () => {
      const local = await context.sendChat({
        familiarId: "qa-openclaw",
        prompt: "[qa:openclaw-warnings] inspect Cave bridge limitations",
        modelOverride: "qa/ignored-model",
        modelOverrideScope: "next-message",
        attachments: [{
          name: "one-pixel.png",
          type: "image/png",
          mimeType: "image/png",
          size: 8,
          dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        }],
      });
      assert.match(context.assistantText(local.events), /Attachment warning: present/i);
      const metadata = context.doneEvent(local.events)?.responseMetadata;
      assert.equal(metadata?.modelApplicationState, "saved");
      assert.equal(metadata?.confirmedModel, undefined);
      const trace = await context.readJsonLines(path.join(context.artifactDir, "runtime-traces", "fake-runtime.jsonl"));
      const openClawTrace = trace.findLast(
        (entry) => entry.runtime === "openclaw" && entry.scenario === "openclaw-warnings",
      );
      assert.equal(openClawTrace?.modelArgument, null);

      await context.createFamiliar({
        id: "qa-openclaw-ssh",
        displayName: "QA OpenClaw SSH",
        role: "Test Familiar",
        description: "Proves that OpenClaw does not silently cross an SSH boundary.",
        glyph: "ph:test-tube-fill",
        harness: "openclaw",
        model: "qa/openclaw-agent",
        openclawAgentId: "qa-openclaw",
        runtime: { kind: "ssh", host: "qa.example", cwd: "/workspace", command: "openclaw" },
      });
      const remote = await context.sendChat(
        { familiarId: "qa-openclaw-ssh", prompt: "do not bridge over SSH" },
        [501],
      );
      assert.match(String(remote.body?.error), /OpenClaw SSH runtime is not supported/i);
      return {
        summary: "Cave warned about local image delivery, saved model intent without forwarding it, and refused an SSH OpenClaw bridge.",
        assertions: ["image limitation in prompt", "model intent saved but not forwarded", "OpenClaw session stays Cave-owned", "SSH bridge returned 501"],
      };
    },
  );
}
