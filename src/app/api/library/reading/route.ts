import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { resolveAllowedProjectPath } from "@/lib/server/project-paths";
import type { LibraryReadingItem, ReadingStatus } from "@/lib/library-types";

const LIBRARY_DIR = path.join(homedir(), ".openclaw", "workspace", "sage", "library");
const FILE = path.join(LIBRARY_DIR, "reading.json");

function ensureDir() {
  if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });
}

function readItems(): LibraryReadingItem[] {
  ensureDir();
  if (!fs.existsSync(FILE)) return [];
  try { return JSON.parse(fs.readFileSync(FILE, "utf-8")) as LibraryReadingItem[]; }
  catch { return []; }
}

function writeItems(items: LibraryReadingItem[]) {
  const resolved = resolveAllowedProjectPath(FILE);
  if (!resolved) throw new Error("path not allowed");
  ensureDir();
  fs.writeFileSync(resolved, JSON.stringify(items, null, 2), "utf-8");
}

function generateId(): string {
  return `rd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function GET() {
  const items = readItems();
  items.sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    title: string;
    url?: string;
    author?: string;
    sourceType?: LibraryReadingItem["sourceType"];
    status?: ReadingStatus;
    notes?: string;
    tags?: string[];
  };
  if (!body.title) return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });

  const item: LibraryReadingItem = {
    id: generateId(),
    title: body.title,
    url: body.url,
    author: body.author,
    sourceType: body.sourceType ?? "article",
    status: body.status ?? "want-to-read",
    notes: body.notes,
    tags: body.tags ?? [],
    addedAt: new Date().toISOString(),
    familiar: "sage",
  };

  const items = readItems();
  items.push(item);
  try { writeItems(items); }
  catch { return NextResponse.json({ ok: false, error: "write failed" }, { status: 500 }); }
  return NextResponse.json({ ok: true, item });
}

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  const patch = await req.json() as Partial<LibraryReadingItem>;
  const items = readItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  // Set finishedAt when status transitions to done
  if (patch.status === "done" && items[idx].status !== "done") {
    patch.finishedAt = new Date().toISOString();
  }

  items[idx] = { ...items[idx], ...patch, id };
  try { writeItems(items); }
  catch { return NextResponse.json({ ok: false, error: "write failed" }, { status: 500 }); }
  return NextResponse.json({ ok: true, item: items[idx] });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const items = readItems().filter((i) => i.id !== id);
  try { writeItems(items); }
  catch { return NextResponse.json({ ok: false, error: "write failed" }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
