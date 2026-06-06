import { NextResponse } from "next/server";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { summarizeOpenClawAgent } from "@/lib/openclaw-agents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function readIdentity(workspacePath: string): Promise<string | null> {
  try {
    return await readFile(path.join(workspacePath, "IDENTITY.md"), "utf8");
  } catch {
    return null;
  }
}

export async function GET() {
  const home = homedir();
  const agentsRoot = path.join(home, ".openclaw", "agents");
  const workspaceRoot = path.join(home, ".openclaw", "workspace");

  let entries;
  try {
    entries = await readdir(agentsRoot, { withFileTypes: true });
  } catch {
    return NextResponse.json({ ok: true, agents: [], agentsRoot });
  }

  const agents = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map(async (entry) => {
        const id = entry.name;
        const workspacePath = path.join(workspaceRoot, id);
        const exists = await stat(workspacePath).then((s) => s.isDirectory()).catch(() => false);
        const identity = exists ? await readIdentity(workspacePath) : null;
        return summarizeOpenClawAgent(id, identity, exists ? workspacePath : null);
      }),
  );

  agents.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return NextResponse.json({ ok: true, agents, agentsRoot, workspaceRoot });
}
