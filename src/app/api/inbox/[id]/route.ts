import { NextResponse } from "next/server";
import {
  deleteItem,
  updateItem,
  type InboxItem,
} from "@/lib/cave-inbox";
import {
  broadcastDeleted,
  broadcastUpdated,
  startScheduler,
} from "@/lib/inbox-scheduler";

export const dynamic = "force-dynamic";

startScheduler();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: Partial<Omit<InboxItem, "id" | "createdAt">>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json body" }, { status: 400 });
  }
  const item = await updateItem(id, body);
  if (!item) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
  broadcastUpdated(item);
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = await deleteItem(id);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
  broadcastDeleted(id);
  return NextResponse.json({ ok: true });
}
