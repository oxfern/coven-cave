/**
 * /api/github/activity
 *
 * Returns the authenticated user's live GitHub activity.
 *
 * Auth tiers (tried in order):
 *   1. GITHUB_PAT env var — user's own PAT, stored in .env.local only,
 *      NEVER committed, NEVER shared, NEVER logged. Private to this machine.
 *   2. Public unauthenticated GitHub API — rate-limited to 60 req/hr.
 *      Only public data accessible. Username must be provided via
 *      GITHUB_USERNAME env var or inferred from the PAT if present.
 *
 * The PAT is read-only from env. It is never returned to the client,
 * never written to any log, and never forwarded anywhere except
 * api.github.com over HTTPS.
 */

import { NextResponse } from "next/server";
import { resolveSecret } from "@/lib/vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GH = "https://api.github.com";

type GitHubItem = {
  kind: "pr" | "issue" | "review_request" | "notification";
  id: string;
  title: string;
  repo: string;
  number?: number;
  url: string;
  state?: string;
  updatedAt: string;
  draft?: boolean;
  labels?: string[];
};

type ActivityResult = {
  ok: true;
  authed: boolean;       // true = PAT used; false = public API
  login: string | null;
  items: GitHubItem[];
  rateLimit: { remaining: number; limit: number } | null;
};

async function ghFetch(path: string, token: string | null) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${GH}${path}`, { headers, cache: "no-store" });
  const rateRemaining = Number(res.headers.get("x-ratelimit-remaining") ?? -1);
  const rateLimit = Number(res.headers.get("x-ratelimit-limit") ?? -1);
  const data = await res.json().catch(() => null);
  return { res, data, rateRemaining, rateLimit };
}

export async function GET() {
  // PAT is strictly local — read from env, never echoed back
  const token = resolveSecret("GITHUB_PAT") ?? null;
  const envLogin = resolveSecret("GITHUB_USERNAME") ?? null;

  // ── Resolve login ────────────────────────────────────────────────────────
  let login: string | null = envLogin;
  let rateInfo: { remaining: number; limit: number } | null = null;

  if (token) {
    try {
      const { data, rateRemaining, rateLimit } = await ghFetch("/user", token);
      login = data?.login ?? login;
      if (rateRemaining >= 0) rateInfo = { remaining: rateRemaining, limit: rateLimit };
    } catch {
      // PAT might be invalid — fall through to public
    }
  }

  if (!login) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_user",
        hint: "Set GITHUB_USERNAME in .env.local to use the public API, or GITHUB_PAT for full access.",
      },
      { status: 401 },
    );
  }

  const items: GitHubItem[] = [];

  // ── Open PRs authored by user ─────────────────────────────────────────────
  try {
    const { data, rateRemaining, rateLimit } = await ghFetch(
      `/search/issues?q=is:pr+is:open+author:${login}&per_page=20&sort=updated`,
      token,
    );
    if (rateRemaining >= 0) rateInfo = { remaining: rateRemaining, limit: rateLimit };
    const prs: unknown[] = Array.isArray(data?.items) ? data.items : [];
    for (const pr of prs) {
      const p = pr as Record<string, unknown>;
      const repoUrl = (p.repository_url as string | undefined) ?? "";
      const repo = repoUrl.replace("https://api.github.com/repos/", "");
      items.push({
        kind: "pr",
        id: `pr-${p.id}`,
        title: String(p.title ?? ""),
        repo,
        number: Number(p.number),
        url: String(p.html_url ?? ""),
        state: String(p.state ?? "open"),
        updatedAt: String(p.updated_at ?? new Date().toISOString()),
        draft: Boolean((p as Record<string, unknown>).draft),
        labels: ((p.labels as { name: string }[] | undefined) ?? []).map((l) => l.name),
      });
    }
  } catch { /* non-fatal */ }

  // ── PRs requesting review from user (needs token for private repos) ───────
  if (token) {
    try {
      const { data } = await ghFetch(
        `/search/issues?q=is:pr+is:open+review-requested:${login}&per_page=10&sort=updated`,
        token,
      );
      const prs: unknown[] = Array.isArray(data?.items) ? data.items : [];
      for (const pr of prs) {
        const p = pr as Record<string, unknown>;
        const repoUrl = (p.repository_url as string | undefined) ?? "";
        const repo = repoUrl.replace("https://api.github.com/repos/", "");
        // avoid duplicates (already in authored list)
        if (items.some((i) => i.id === `pr-${p.id}`)) continue;
        items.push({
          kind: "review_request",
          id: `rv-${p.id}`,
          title: String(p.title ?? ""),
          repo,
          number: Number(p.number),
          url: String(p.html_url ?? ""),
          state: "review_requested",
          updatedAt: String(p.updated_at ?? new Date().toISOString()),
          draft: Boolean((p as Record<string, unknown>).draft),
          labels: ((p.labels as { name: string }[] | undefined) ?? []).map((l) => l.name),
        });
      }
    } catch { /* non-fatal */ }
  }

  // ── Open issues assigned to user ──────────────────────────────────────────
  try {
    const { data } = await ghFetch(
      `/search/issues?q=is:issue+is:open+assignee:${login}&per_page=10&sort=updated`,
      token,
    );
    const issues: unknown[] = Array.isArray(data?.items) ? data.items : [];
    for (const issue of issues) {
      const i = issue as Record<string, unknown>;
      const repoUrl = (i.repository_url as string | undefined) ?? "";
      const repo = repoUrl.replace("https://api.github.com/repos/", "");
      items.push({
        kind: "issue",
        id: `issue-${i.id}`,
        title: String(i.title ?? ""),
        repo,
        number: Number(i.number),
        url: String(i.html_url ?? ""),
        state: "open",
        updatedAt: String(i.updated_at ?? new Date().toISOString()),
        labels: ((i.labels as { name: string }[] | undefined) ?? []).map((l) => l.name),
      });
    }
  } catch { /* non-fatal */ }

  // sort all by updatedAt desc
  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const result: ActivityResult = {
    ok: true,
    authed: !!token,
    login,
    items,
    rateLimit: rateInfo,
  };

  return NextResponse.json(result);
}
