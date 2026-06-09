import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";
import type { GraphifyResult, GraphifyGraph } from "@/lib/library-types";

const execFileAsync = promisify(execFile);

const GRAPHS_DIR = path.join(
  process.env.CAVE_LIBRARY_DIR ?? path.join(homedir(), ".openclaw", "workspace", "sage", "library"),
  "graphs",
);

function generateId(): string {
  return `graph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

async function ensureGraphsDir(): Promise<void> {
  await fs.mkdir(GRAPHS_DIR, { recursive: true });
}

async function readAllGraphMeta(): Promise<Omit<GraphifyResult, "graphJson" | "reportMd">[]> {
  try {
    await fs.access(GRAPHS_DIR);
  } catch {
    return [];
  }
  const files = await fs.readdir(GRAPHS_DIR);
  const metas: Omit<GraphifyResult, "graphJson" | "reportMd">[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(GRAPHS_DIR, file), "utf-8");
      const parsed = JSON.parse(raw) as GraphifyResult;
      metas.push({
        id: parsed.id,
        label: parsed.label,
        targetPath: parsed.targetPath,
        generatedAt: parsed.generatedAt,
      });
    } catch {
      // skip malformed
    }
  }
  return metas.sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1));
}

async function readGraphById(id: string): Promise<GraphifyResult | null> {
  try {
    const raw = await fs.readFile(path.join(GRAPHS_DIR, `${id}.json`), "utf-8");
    return JSON.parse(raw) as GraphifyResult;
  } catch {
    return null;
  }
}

// Resolve graphify binary — try PATH first, then uv tool path
async function resolveGraphifyBin(): Promise<string> {
  // Try common locations
  const candidates = [
    "graphify",
    path.join(homedir(), ".local", "bin", "graphify"),
    "/usr/local/bin/graphify",
  ];
  for (const c of candidates) {
    try {
      await execFileAsync("which", [c.includes("/") ? c : "graphify"]);
      return c.includes("/") ? c : "graphify";
    } catch {
      if (c.includes("/")) {
        try {
          await fs.access(c);
          return c;
        } catch { /* continue */ }
      }
    }
  }
  // Fall back to uv run
  return "graphify";
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (id) {
    const result = await readGraphById(id);
    if (!result) {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, result });
  }

  const metas = await readAllGraphMeta();
  return NextResponse.json({ ok: true, graphs: metas });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { targetPath?: string; label?: string };
  if (!body.targetPath) {
    return NextResponse.json({ ok: false, error: "targetPath required" }, { status: 400 });
  }

  const targetPath = body.targetPath;

  // Verify path exists
  try {
    const stat = await fs.stat(targetPath);
    if (!stat.isDirectory()) {
      return NextResponse.json({ ok: false, error: "targetPath must be a directory" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "targetPath does not exist" }, { status: 400 });
  }

  const graphifyBin = await resolveGraphifyBin();

  // Run graphify with timeout
  try {
    await execFileAsync(graphifyBin, [targetPath], {
      cwd: targetPath,
      timeout: 120_000,
      env: { ...process.env, PATH: `${process.env.PATH}:${path.join(homedir(), ".local", "bin")}` },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[graph/route] graphify error:", msg);
    return NextResponse.json({ ok: false, error: `graphify failed: ${msg}` }, { status: 500 });
  }

  // Read outputs
  const outDir = path.join(targetPath, "graphify-out");

  let graphJson: GraphifyGraph;
  try {
    const raw = await fs.readFile(path.join(outDir, "graph.json"), "utf-8");
    graphJson = JSON.parse(raw) as GraphifyGraph;
    // Normalize: ensure arrays exist
    if (!Array.isArray(graphJson.nodes)) graphJson.nodes = [];
    if (!Array.isArray(graphJson.edges)) graphJson.edges = [];
  } catch (err) {
    return NextResponse.json({ ok: false, error: `could not read graph.json: ${String(err)}` }, { status: 500 });
  }

  let reportMd: string | undefined;
  try {
    reportMd = await fs.readFile(path.join(outDir, "GRAPH_REPORT.md"), "utf-8");
  } catch {
    reportMd = undefined;
  }

  const id = generateId();
  const label = body.label ?? path.basename(targetPath);

  const result: GraphifyResult = {
    id,
    label,
    targetPath,
    generatedAt: new Date().toISOString(),
    reportMd,
    graphJson,
  };

  await ensureGraphsDir();
  await fs.writeFile(
    path.join(GRAPHS_DIR, `${id}.json`),
    JSON.stringify(result, null, 2),
    "utf-8",
  );

  return NextResponse.json({ ok: true, result });
}
