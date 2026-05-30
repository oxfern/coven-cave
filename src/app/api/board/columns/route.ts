import { NextResponse } from "next/server";
import { addColumn, loadBoard } from "@/lib/cave-board";

export const dynamic = "force-dynamic";

export async function GET() {
  const board = await loadBoard();
  return NextResponse.json({ ok: true, columns: board.columns });
}

export async function POST(req: Request) {
  let body: { label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json body" }, { status: 400 });
  }
  if (!body.label || !body.label.trim()) {
    return NextResponse.json({ ok: false, error: "label required" }, { status: 400 });
  }
  const column = await addColumn(body.label);
  return NextResponse.json({ ok: true, column });
}
