import { NextResponse } from "next/server";
import { loadConversation } from "@/lib/cave-conversations";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conv = await loadConversation(id);
  if (!conv) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, conversation: conv });
}
