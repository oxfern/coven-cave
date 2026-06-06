/**
 * /api/github/pat
 *
 * GET  — returns { hasPat: boolean, login: string|null }
 *         NEVER returns the PAT value itself.
 *
 * POST — body: { pat: string }
 *         Validates the PAT against GitHub, then writes it to .env.local
 *         under GITHUB_PAT. The PAT is only ever stored on this local
 *         machine in .env.local (gitignored). It is never logged, never
 *         returned to the client, never sent anywhere except api.github.com.
 *
 * DELETE — removes GITHUB_PAT from .env.local
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ENV_PATH = join(process.cwd(), ".env.local");
const PAT_KEY = "GITHUB_PAT";
const LOGIN_KEY = "GITHUB_USERNAME";

function readEnvLocal(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};
  const lines = readFileSync(ENV_PATH, "utf8").split("\n");
  const map: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    map[key] = val;
  }
  return map;
}

function writeEnvLocal(map: Record<string, string>): void {
  const lines = Object.entries(map).map(([k, v]) => `${k}=${v}`);
  writeFileSync(ENV_PATH, lines.join("\n") + "\n", "utf8");
}

async function validatePat(pat: string): Promise<{ valid: boolean; login: string | null }> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (!res.ok) return { valid: false, login: null };
    const data = await res.json().catch(() => null);
    return { valid: true, login: data?.login ?? null };
  } catch {
    return { valid: false, login: null };
  }
}

// GET — just reports presence, never exposes the value
export async function GET() {
  const hasPat = !!(process.env.GITHUB_PAT?.trim());
  const login = process.env.GITHUB_USERNAME?.trim() || null;
  return NextResponse.json({ hasPat, login });
}

// POST — validate + save
export async function POST(req: NextRequest) {
  let body: { pat?: string; username?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const pat = typeof body.pat === "string" ? body.pat.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";

  if (!pat && !username) {
    return NextResponse.json({ ok: false, error: "pat or username is required" }, { status: 400 });
  }

  let login: string | null = username || null;

  if (pat) {
    const result = await validatePat(pat);
    if (!result.valid) {
      return NextResponse.json({ ok: false, error: "PAT is invalid or lacks required scopes (needs read:user, repo)" }, { status: 422 });
    }
    login = result.login ?? login;
  }

  // Write to .env.local — never log the PAT value
  const env = readEnvLocal();
  if (pat) env[PAT_KEY] = pat;
  if (login) env[LOGIN_KEY] = login;
  writeEnvLocal(env);

  // Inject into current process so next request picks it up without restart
  if (pat) process.env[PAT_KEY] = pat;
  if (login) process.env[LOGIN_KEY] = login;

  return NextResponse.json({ ok: true, login });
}

// DELETE — remove PAT
export async function DELETE() {
  const env = readEnvLocal();
  delete env[PAT_KEY];
  writeEnvLocal(env);
  delete process.env[PAT_KEY];
  return NextResponse.json({ ok: true });
}
