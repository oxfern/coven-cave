import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

export const dynamic = "force-dynamic";

type HarnessSpec = {
  id: string;
  label: string;
  binary: string;
  /**
   * Currently wired for native chat (POST /api/chat/send), i.e. supported by
   * `coven run <harness> --stream-json`. Others are surfaced as "installed but
   * not yet wired" so familiars can still launch them in the Coven Code TUI.
   */
  chatSupported: boolean;
  versionArgs?: string[];
};

const HARNESSES: HarnessSpec[] = [
  { id: "codex", label: "Codex", binary: "codex", chatSupported: true },
  { id: "claude", label: "Claude Code", binary: "claude", chatSupported: true, versionArgs: ["--version"] },
  { id: "openclaw", label: "OpenClaw", binary: "openclaw", chatSupported: false },
  { id: "copilot", label: "GitHub Copilot", binary: "copilot", chatSupported: false },
  { id: "opencode", label: "OpenCode", binary: "opencode", chatSupported: false },
  { id: "gemini", label: "Gemini CLI", binary: "gemini", chatSupported: false },
  { id: "hermes", label: "Hermes", binary: "hermes", chatSupported: false },
  { id: "openhands", label: "OpenHands", binary: "openhands", chatSupported: false },
  { id: "aider", label: "Aider", binary: "aider", chatSupported: false },
];

type HarnessReport = HarnessSpec & {
  installed: boolean;
  path: string | null;
  version: string | null;
};

function which(binary: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn("/usr/bin/which", [binary], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.on("close", (code) => resolve(code === 0 ? out.trim() || null : null));
    child.on("error", () => resolve(null));
  });
}

function probeVersion(binary: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (out += d.toString()));
    const t = setTimeout(() => {
      child.kill("SIGTERM");
      resolve(null);
    }, 2500);
    child.on("close", () => {
      clearTimeout(t);
      resolve(out.split(/\r?\n/)[0]?.trim() || null);
    });
    child.on("error", () => {
      clearTimeout(t);
      resolve(null);
    });
  });
}

export async function GET() {
  const reports: HarnessReport[] = await Promise.all(
    HARNESSES.map(async (h) => {
      const path = await which(h.binary);
      if (!path) {
        return { ...h, installed: false, path: null, version: null };
      }
      const version = await probeVersion(h.binary, h.versionArgs ?? ["--version"]);
      return { ...h, installed: true, path, version };
    }),
  );
  return NextResponse.json({ ok: true, harnesses: reports });
}
