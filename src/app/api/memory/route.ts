import { NextResponse } from "next/server";
import { listMemoryFileEntries } from "@/lib/server/memory-file-inventory";

export const dynamic = "force-dynamic";

export type { MemoryEntry } from "@/lib/server/memory-file-inventory";

export async function GET() {
  const entries = await listMemoryFileEntries();
  return NextResponse.json({ ok: true, entries });
}
