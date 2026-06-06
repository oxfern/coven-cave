import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { resolveAllowedProjectPath } from "@/lib/server/project-paths";
import type { LibraryBookmark } from "@/lib/library-types";

const LIBRARY_DIR = path.join(homedir(), ".openclaw", "workspace", "sage", "library");
const FILE = path.join(LIBRARY_DIR, "bookmarks.json");

function ensureDir() {
  if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });
}

function readItems(): LibraryBookmark[] {
  ensureDir();
  if (!fs.existsSync(FILE)) return [];
  try { return JSON.parse(fs.readFileSync(FILE, "utf-8")) as LibraryBookmark[]; }
  catch { return []; }
}

function writeItems(items: LibraryBookmark[]) {
  const resolved = resolveAllowedProjectPath(FILE);
  if (!resolved) throw new Error("path not allowed");
  ensureDir();
  fs.writeFileSync(resolved, JSON.stringify(items, null, 2), "utf-8");
}

function domainFrom(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

function generateId(): string {
  return `bm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function GET() {
  const items = readItems();
  items.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { url: string; title?: string; notes?: string; tags?: string[] };
  if (!body.url) return NextResponse.json({ ok: false, error: "url required" }, { status: 400 });

  const domain = domainFrom(body.url);
  const item: LibraryBookmark = {
    id: generateId(),
    url: body.url,
    title: body.title ?? domain,
    domain,
    notes: body.notes,
    tags: body.tags ?? [],
    savedAt: new Date().toISOString(),
    familiar: "sage",
  };

  const items = readItems();
  items.push(item);
  try { writeItems(items); }
  catch { return NextResponse.json({ ok: false, error: "write failed" }, { status: 500 }); }
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const items = readItems().filter((i) => i.id !== id);
  try { writeItems(items); }
  catch { return NextResponse.json({ ok: false, error: "write failed" }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
