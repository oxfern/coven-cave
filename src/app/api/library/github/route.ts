import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { resolveAllowedProjectPath } from "@/lib/server/project-paths";
import type { LibraryGitHubItem, GitHubItemKind } from "@/lib/library-types";

const LIBRARY_DIR = path.join(homedir(), ".openclaw", "workspace", "sage", "library");
const FILE = path.join(LIBRARY_DIR, "github.json");

function ensureDir() {
  if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });
}

function readItems(): LibraryGitHubItem[] {
  ensureDir();
  if (!fs.existsSync(FILE)) return [];
  try { return JSON.parse(fs.readFileSync(FILE, "utf-8")) as LibraryGitHubItem[]; }
  catch { return []; }
}

function writeItems(items: LibraryGitHubItem[]) {
  const resolved = resolveAllowedProjectPath(FILE);
  if (!resolved) throw new Error("path not allowed");
  ensureDir();
  fs.writeFileSync(resolved, JSON.stringify(items, null, 2), "utf-8");
}

function generateId(): string {
  return `gh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Parse a GitHub URL into { repo, kind, number }.
 * github.com/owner/repo               → repo
 * github.com/owner/repo/issues/123    → issue #123
 * github.com/owner/repo/pull/123      → pr #123
 * github.com/owner/repo/discussions/5 → discussion #5
 */
function parseGitHubUrl(url: string): { repo: string; kind: GitHubItemKind; number?: number } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("github.com")) return null;
    const parts = u.pathname.replace(/^\//, "").split("/");
    if (parts.length < 2) return null;
    const repo = `${parts[0]}/${parts[1]}`;
    if (parts.length === 2) return { repo, kind: "repo" };
    if (parts[2] === "issues" && parts[3]) return { repo, kind: "issue", number: parseInt(parts[3], 10) };
    if (parts[2] === "pull" && parts[3]) return { repo, kind: "pr", number: parseInt(parts[3], 10) };
    if (parts[2] === "discussions" && parts[3]) return { repo, kind: "discussion", number: parseInt(parts[3], 10) };
    return { repo, kind: "repo" };
  } catch { return null; }
}

export async function GET() {
  const items = readItems();
  items.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    repo?: string;
    kind?: GitHubItemKind;
    number?: number;
    title: string;
    url: string;
    state?: LibraryGitHubItem["state"];
    labels?: string[];
    notes?: string;
  };
  if (!body.url) return NextResponse.json({ ok: false, error: "url required" }, { status: 400 });
  if (!body.title) return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });

  const parsed = parseGitHubUrl(body.url);
  const repo = body.repo ?? parsed?.repo ?? "";
  const kind: GitHubItemKind = body.kind ?? parsed?.kind ?? "repo";
  const number = body.number ?? parsed?.number;

  const item: LibraryGitHubItem = {
    id: generateId(),
    kind,
    repo,
    number,
    title: body.title,
    url: body.url,
    state: body.state,
    labels: body.labels ?? [],
    notes: body.notes,
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
