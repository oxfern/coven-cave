import { NextResponse } from "next/server";
import { callDaemon } from "@/lib/coven-daemon";
import { bindingFor, loadConfig, recordSessionFamiliar } from "@/lib/cave-config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    projectRoot?: string;
    harness?: string;
    prompt?: string;
    cols?: number;
    rows?: number;
    familiarId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json body" }, { status: 400 });
  }

  const projectRoot = body.projectRoot ?? process.cwd();
  const familiarId = body.familiarId;
  const config = await loadConfig();
  const binding = familiarId
    ? bindingFor(config, familiarId)
    : { harness: body.harness ?? "codex", model: config.defaults.model };
  const harness = body.harness ?? binding.harness;
  const prompt = body.prompt;

  const res = await callDaemon<{ id: string; status: string }>({
    method: "POST",
    path: "/api/v1/sessions",
    body: {
      projectRoot,
      harness,
      prompt,
      cols: body.cols,
      rows: body.rows,
    },
    timeoutMs: 8000,
  });

  if (!res.ok || !res.data) {
    return NextResponse.json(
      { ok: false, error: res.error ?? `daemon http ${res.status}` },
      { status: 502 },
    );
  }

  if (familiarId && res.data.id) {
    await recordSessionFamiliar(res.data.id, familiarId);
  }

  return NextResponse.json({
    ok: true,
    session: res.data,
    binding: { harness, model: binding.model },
  });
}
