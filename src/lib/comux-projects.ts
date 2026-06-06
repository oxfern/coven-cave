import type { SessionRow } from "@/lib/types";

export type ComuxProject = {
  name: string;
  root: string;
  sessionCount: number;
  runningCount: number;
  familiarCount: number;
  latestSessionId: string | null;
  updatedAt: string | null;
};

const ACTIVE_STATUSES = new Set(["running", "queued", "paused"]);

export function projectName(root: string): string {
  const parts = root.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? root;
}

export function deriveComuxProjects(
  sessions: SessionRow[],
  fallbackRoot?: string,
): ComuxProject[] {
  const byRoot = new Map<
    string,
    {
      sessions: SessionRow[];
      familiarIds: Set<string>;
    }
  >();

  for (const session of sessions) {
    const root = session.project_root?.trim();
    if (!root) continue;
    const bucket = byRoot.get(root) ?? { sessions: [], familiarIds: new Set<string>() };
    bucket.sessions.push(session);
    if (session.familiarId) bucket.familiarIds.add(session.familiarId);
    byRoot.set(root, bucket);
  }

  const projects = Array.from(byRoot.entries()).map(([root, bucket]) => {
    const sorted = [...bucket.sessions].sort((a, b) =>
      (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at),
    );
    const latest = sorted[0] ?? null;
    return {
      name: projectName(root),
      root,
      sessionCount: bucket.sessions.length,
      runningCount: bucket.sessions.filter((session) => ACTIVE_STATUSES.has(session.status)).length,
      familiarCount: bucket.familiarIds.size,
      latestSessionId: latest?.id ?? null,
      updatedAt: latest ? latest.updated_at || latest.created_at : null,
    };
  });

  projects.sort((a, b) => {
    if (a.updatedAt && b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
    if (a.updatedAt) return -1;
    if (b.updatedAt) return 1;
    return a.name.localeCompare(b.name);
  });

  if (projects.length === 0 && fallbackRoot) {
    return [
      {
        name: projectName(fallbackRoot),
        root: fallbackRoot,
        sessionCount: 0,
        runningCount: 0,
        familiarCount: 0,
        latestSessionId: null,
        updatedAt: null,
      },
    ];
  }

  return projects;
}
