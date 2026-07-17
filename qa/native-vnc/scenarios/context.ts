import { $ } from "bun";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "../core/paths.ts";
import type {
  ChatResponse,
  FamiliarInput,
  RuntimeState,
  ScenarioEvidence,
  ScenarioResult,
  ScenarioSpec,
  StreamEvent,
} from "./types.ts";

type JsonResponse = { body: Record<string, any>; status: number };

export class ScenarioContext {
  readonly appUrl: string;
  readonly artifactDir: string;
  readonly displayEnv: Record<string, string | undefined>;
  readonly manifestPath: string;
  readonly recordVideos: boolean;
  readonly results: ScenarioResult[] = [];
  readonly runtime: RuntimeState;
  readonly videosDir: string;
  private cardProcess: ReturnType<typeof Bun.spawn> | null = null;

  private constructor(runtime: RuntimeState, artifactDir: string) {
    this.runtime = runtime;
    this.artifactDir = artifactDir;
    this.appUrl = process.env.CAVE_VNC_APP_URL ?? runtime.appUrl;
    this.videosDir = path.join(artifactDir, "videos");
    this.manifestPath = path.join(artifactDir, "scenario-manifest.json");
    this.recordVideos = process.env.CAVE_VNC_RECORD_SCENARIOS !== "0";
    this.displayEnv = {
      ...process.env,
      DISPLAY: runtime.display,
      XAUTHORITY: runtime.xauthority,
    };
  }

  static async create(): Promise<ScenarioContext> {
    const artifactDir = path.resolve(
      repoRoot,
      process.env.CAVE_VNC_ARTIFACT_DIR ?? "artifacts/openvnc-qa",
    );
    const runtime = JSON.parse(
      await readFile(path.join(artifactDir, "runtime.json"), "utf8"),
    ) as RuntimeState;
    const context = new ScenarioContext(runtime, artifactDir);
    await mkdir(context.videosDir, { recursive: true });
    return context;
  }

  async requestJson(route: string, init: RequestInit = {}, expected = [200]): Promise<JsonResponse> {
    const response = await fetch(`${this.appUrl}${route}`, init);
    const body = await response.json().catch(() => ({})) as Record<string, any>;
    if (!expected.includes(response.status)) {
      throw new Error(`${init.method ?? "GET"} ${route} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
    }
    return { status: response.status, body };
  }

  async sendChat(body: Record<string, unknown>, expected = [200]): Promise<ChatResponse> {
    const response = await fetch(`${this.appUrl}/api/chat/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = await response.text();
    if (!expected.includes(response.status)) {
      throw new Error(`POST /api/chat/send returned HTTP ${response.status}: ${raw}`);
    }
    if (!response.headers.get("content-type")?.includes("text/event-stream")) {
      const parsed = (() => {
        try {
          return JSON.parse(raw) as Record<string, any>;
        } catch {
          return { raw };
        }
      })();
      return { status: response.status, body: parsed, events: [] };
    }
    const events = raw
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)) as StreamEvent);
    return { status: response.status, events, raw };
  }

  assistantText(events: StreamEvent[]): string {
    return events
      .filter((event) => event.kind === "assistant_chunk")
      .map((event) => event.text ?? "")
      .join("");
  }

  doneEvent(events: StreamEvent[]): StreamEvent | undefined {
    return events.findLast((event) => event.kind === "done");
  }

  async readJsonLines(filePath: string): Promise<Record<string, any>[]> {
    return (await readFile(filePath, "utf8"))
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, any>);
  }

  async createFamiliar(input: FamiliarInput): Promise<string> {
    const response = await this.requestJson(
      "/api/familiars",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ familiar: input }),
      },
      [200, 201, 409],
    );
    if (response.status === 200 || response.status === 201) assert.equal(response.body.ok, true);
    return input.id;
  }

  async xdotool(...args: string[]): Promise<void> {
    await $`${["xdotool", ...args]}`.env(this.displayEnv).quiet();
    await Bun.sleep(250);
  }

  async caveWindowId(): Promise<string> {
    const output = await $`xdotool search --onlyvisible --name ${"^CovenCave$"}`
      .env(this.displayEnv)
      .text();
    return output.trim().split(/\r?\n/)[0] ?? "";
  }

  async caveWindowGeometry(): Promise<Record<string, number>> {
    const output = await $`xdotool getwindowgeometry --shell ${await this.caveWindowId()}`
      .env(this.displayEnv)
      .text();
    return Object.fromEntries(output.trim().split(/\r?\n/).map((line) => {
      const [key, value] = line.split("=");
      return [key, Number(value)];
    }));
  }

  async activateCave(): Promise<void> {
    await this.xdotool("windowactivate", "--sync", await this.caveWindowId());
  }

  async runRealCoven(args: string[]): Promise<void> {
    const env = {
      ...process.env,
      HOME: this.runtime.home,
      COVEN_HOME: this.runtime.covenHome,
      COVEN_CAVE_HOME: this.runtime.caveHome,
    };
    const result = await $`${[this.runtime.realCovenBin, ...args]}`.env(env).quiet().nothrow();
    if (result.exitCode !== 0) {
      throw new Error(`coven ${args.join(" ")} failed: ${(result.stderr.toString() || result.stdout.toString()).trim()}`);
    }
  }

  async waitForDaemon(expected: boolean, timeoutMs = 15_000): Promise<Record<string, any>> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const { body } = await this.requestJson("/api/onboarding/status");
        if (body.steps?.daemon?.ok === expected) return body;
      } catch {
        // The app remains available while the isolated daemon cycles.
      }
      await Bun.sleep(500);
    }
    throw new Error(`daemon did not become ${expected ? "ready" : "offline"}`);
  }

  async runScenario(spec: ScenarioSpec, test: () => Promise<ScenarioEvidence>): Promise<void> {
    const videoPath = path.join(this.videosDir, `${spec.id}.webm`);
    const startedAt = new Date().toISOString();
    const recorder = this.startRecorder(videoPath);
    let result: ScenarioResult;
    try {
      await this.activateCave();
      await Bun.sleep(spec.preRollMs ?? 700);
      if (spec.showRunning !== false) await this.showCard(`${spec.number}. ${spec.title}`, "RUNNING");
      const evidence = await test();
      await this.showCard(`${spec.number}. ${spec.title}`, `PASS\n${evidence.summary}`);
      await Bun.sleep(spec.passHoldMs ?? 1_400);
      result = {
        ...spec,
        ...evidence,
        status: "passed",
        video: this.recordVideos ? `videos/${spec.id}.webm` : null,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.showCard(`${spec.number}. ${spec.title}`, `FAIL\n${message}`);
      await Bun.sleep(1_800);
      result = {
        ...spec,
        assertions: [],
        summary: message,
        status: "failed",
        video: this.recordVideos ? `videos/${spec.id}.webm` : null,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    } finally {
      await this.closeCard();
      await this.stopRecorder(recorder);
    }
    this.results.push(result);
    await this.writeManifest();
  }

  async close(): Promise<void> {
    await this.closeCard();
  }

  private startRecorder(videoPath: string) {
    if (!this.recordVideos) return null;
    const displaySize = this.runtime.geometry.split("x").slice(0, 2).join("x");
    return Bun.spawn(
      [
        "ffmpeg", "-y", "-f", "x11grab", "-draw_mouse", "1", "-framerate", "12",
        "-video_size", displaySize, "-i", this.runtime.display, "-c:v", "libvpx-vp9",
        "-crf", "42", "-b:v", "0", "-deadline", "realtime", "-cpu-used", "8",
        "-pix_fmt", "yuv420p", videoPath,
      ],
      {
        env: this.displayEnv,
        stdin: "pipe",
        stdout: "ignore",
        stderr: Bun.file(`${videoPath}.ffmpeg.log`),
      },
    );
  }

  private async stopRecorder(recorder: ReturnType<ScenarioContext["startRecorder"]>): Promise<void> {
    if (!recorder) return;
    recorder.stdin.write("q\n");
    recorder.stdin.end();
    const status = await recorder.exited;
    if (status !== 0) throw new Error(`ffmpeg exited with status ${status}`);
  }

  private async closeCard(): Promise<void> {
    if (!this.cardProcess) return;
    this.cardProcess.kill("SIGTERM");
    await this.cardProcess.exited;
    this.cardProcess = null;
  }

  private async showCard(title: string, detail: string): Promise<void> {
    await this.closeCard();
    this.cardProcess = Bun.spawn(
      [
        "xmessage", "-title", "Cave VNC QA", "-buttons", "Dismiss:0",
        "-geometry", "620x150+790+690", `${title}\n\n${detail}`,
      ],
      { env: this.displayEnv, stdin: "ignore", stdout: "ignore", stderr: "ignore" },
    );
    await Bun.sleep(500);
  }

  private async writeManifest(): Promise<void> {
    await writeFile(this.manifestPath, `${JSON.stringify({
      schemaVersion: 1,
      appUrl: this.appUrl,
      credentialMode: "deterministic-process-doubles",
      generatedAt: new Date().toISOString(),
      scenarios: this.results,
    }, null, 2)}\n`);
  }
}
