import { spawn } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { stripAnsi } from "@/lib/ansi";
import { bindingFor, loadConfig, recordSessionFamiliar } from "@/lib/cave-config";
import {
  type ChatTurn,
  loadConversation,
  saveConversation,
} from "@/lib/cave-conversations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SendBody = {
  familiarId: string;
  prompt: string;
  sessionId?: string;
  projectRoot?: string;
};

type StreamEvent =
  | { kind: "session"; sessionId: string }
  | { kind: "user"; text: string }
  | { kind: "assistant_chunk"; text: string }
  | { kind: "done"; durationMs?: number; isError?: boolean; sessionId?: string }
  | { kind: "error"; message: string };

const HOOK_LINE_RE = /^hook:\s+/;
const BANNER_LINE_RE = /^(?:--------|workdir:|model:|provider:|approval:|sandbox:|reasoning|session id:|tokens used|\d[\d,]*\s*$)/;
const CODEX_START_LINE = "codex";
const CLAUDE_ASSISTANT_RE = /^claude(?:\s+code)?$/i;

/**
 * Filter raw harness stdout (after JSON event lines have been stripped) into
 * what looks like assistant-authored text. Codex prints a banner + hook lines
 * + a `codex` marker before its reply + `tokens used` after. We keep only the
 * content between the start marker and the next hook/end-of-stream.
 */
class AssistantFilter {
  private phase: "pre" | "assistant" | "post" = "pre";
  private buf = "";

  push(chunk: string): string {
    this.buf += chunk;
    let out = "";
    let idx;
    while ((idx = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 1);
      out += this.processLine(line);
    }
    return out;
  }

  flush(): string {
    if (!this.buf) return "";
    const remainder = this.processLine(this.buf);
    this.buf = "";
    return remainder;
  }

  private processLine(rawLine: string): string {
    const line = rawLine.replace(/\r/g, "");
    const trimmed = line.trim();

    if (trimmed === CODEX_START_LINE || CLAUDE_ASSISTANT_RE.test(trimmed)) {
      this.phase = "assistant";
      return "";
    }
    if (HOOK_LINE_RE.test(trimmed)) {
      if (this.phase === "assistant" && /stop/i.test(trimmed)) {
        this.phase = "post";
      }
      return "";
    }
    if (trimmed === "user") {
      // Codex echoes the user prompt block; skip the leading marker
      return "";
    }
    if (BANNER_LINE_RE.test(trimmed)) {
      return "";
    }
    if (this.phase !== "assistant") return "";
    return line + "\n";
  }
}

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function sse(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(req: Request) {
  let body: SendBody;
  try {
    body = (await req.json()) as SendBody;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid json body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (!body.familiarId || !body.prompt?.trim()) {
    return new Response(
      JSON.stringify({ ok: false, error: "familiarId and prompt are required" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const config = await loadConfig();
  const binding = bindingFor(config, body.familiarId);
  const cwd = body.projectRoot ?? path.join(homedir(), "Documents", "GitHub", "OpenCoven", "coven-cave");

  // Build coven run argv
  const args = ["run", binding.harness, body.prompt, "--stream-json"];
  if (body.sessionId) args.push("--continue", body.sessionId);

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      const push = (e: StreamEvent) => controller.enqueue(sse(e));
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already */
        }
      };

      push({ kind: "user", text: body.prompt });

      let sessionId = body.sessionId ?? null;
      const assistantFilter = new AssistantFilter();
      let assistantText = "";
      let jsonBuf = "";
      let result: { duration_ms?: number; is_error?: boolean } = {};

      const child = spawn("coven", args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const handleLine = (line: string) => {
        if (!line) return;
        const isJson = line.startsWith("{") && line.endsWith("}");
        if (isJson) {
          try {
            const ev = JSON.parse(line) as {
              type: string;
              subtype?: string;
              session_id?: string;
              duration_ms?: number;
              is_error?: boolean;
            };
            if (ev.session_id && !sessionId) {
              sessionId = ev.session_id;
              push({ kind: "session", sessionId });
            }
            if (ev.type === "result") {
              result = { duration_ms: ev.duration_ms, is_error: ev.is_error };
            }
            return;
          } catch {
            /* fall through to filter */
          }
        }
        const cleaned = stripAnsi(line);
        const filtered = assistantFilter.push(cleaned + "\n");
        if (filtered) {
          assistantText += filtered;
          push({ kind: "assistant_chunk", text: filtered });
        }
      };

      child.stdout.on("data", (data: Buffer) => {
        jsonBuf += data.toString("utf8");
        let idx;
        while ((idx = jsonBuf.indexOf("\n")) >= 0) {
          const line = jsonBuf.slice(0, idx);
          jsonBuf = jsonBuf.slice(idx + 1);
          handleLine(line);
        }
      });

      child.stderr.on("data", (data: Buffer) => {
        push({ kind: "assistant_chunk", text: stripAnsi(data.toString("utf8")) });
      });

      child.on("error", (err) => {
        push({ kind: "error", message: err.message });
        close();
      });

      child.on("close", async () => {
        // Flush any remaining buffered output
        if (jsonBuf) handleLine(jsonBuf);
        const tail = assistantFilter.flush();
        if (tail) {
          assistantText += tail;
          push({ kind: "assistant_chunk", text: tail });
        }

        const finalSessionId = sessionId;
        if (finalSessionId) {
          await recordSessionFamiliar(finalSessionId, body.familiarId);
          // Persist the turn
          const existing = await loadConversation(finalSessionId);
          const now = new Date().toISOString();
          const userTurn: ChatTurn = {
            id: crypto.randomUUID(),
            role: "user",
            text: body.prompt,
            createdAt: now,
          };
          const assistantTurn: ChatTurn = {
            id: crypto.randomUUID(),
            role: "assistant",
            text: assistantText.trim(),
            createdAt: new Date().toISOString(),
            durationMs: result.duration_ms,
            isError: result.is_error,
          };
          const conv = existing ?? {
            sessionId: finalSessionId,
            familiarId: body.familiarId,
            harness: binding.harness,
            title: body.prompt.slice(0, 60),
            createdAt: now,
            updatedAt: now,
            turns: [],
          };
          conv.turns.push(userTurn, assistantTurn);
          await saveConversation(conv);
        }

        push({
          kind: "done",
          durationMs: result.duration_ms,
          isError: result.is_error,
          sessionId: finalSessionId ?? undefined,
        });
        // Tiny grace period so the last frame is flushed
        await sleep(20);
        close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
