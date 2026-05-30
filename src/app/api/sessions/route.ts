import { NextResponse } from "next/server";
import { callDaemon } from "@/lib/coven-daemon";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { projectRoot?: string; harness?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json body" }, { status: 400 });
  }

  const projectRoot = body.projectRoot ?? process.cwd();
  const harness = body.harness ?? "codex";
  const prompt = body.prompt;

  const res = await callDaemon<{ id: string; status: string }>({
    method: "POST",
    path: "/api/v1/sessions",
    body: { projectRoot, harness, prompt },
    timeoutMs: 8000,
  });

  if (!res.ok || !res.data) {
    return NextResponse.json(
      { ok: false, error: res.error ?? `daemon http ${res.status}` },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, session: res.data });
}
