# Projects First-Class Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `CHAT_PROJECTS` array with a persistent, user-managed Projects system stored in `~/.coven/cave-projects.json`; wire chats and tasks to project IDs instead of raw CWD paths; add a Projects management view in the Cave sidebar.

**Architecture:** A new `cave-projects` lib module owns the JSON file at `~/.coven/cave-projects.json` (CRUD + async helpers), mirroring the pattern of `cave-board` / `cave-conversations`. A `/api/projects` CRUD route exposes it to the client. `chat-projects.ts` becomes a thin wrapper that reads from the persisted store instead of a hardcoded array. `ProjectsView` (new component) lets users create, rename, and delete projects. `Chat*` and `Board` consumers swap `project_root` CWD string matching for `projectId` lookups.

**Tech Stack:** Next.js 15 App Router, Node.js `fs/promises`, TypeScript, React, Phosphor Icons (ph:*), existing Coven Cave CSS custom-property design tokens.

---

## File Map

### New files
| Path | Purpose |
|---|---|
| `src/lib/cave-projects.ts` | Persistent CRUD for `~/.coven/cave-projects.json`; replaces hardcoded array |
| `src/components/projects-view.tsx` | Projects management UI (list, create, rename, delete) |
| `src/app/api/projects/route.ts` | GET / POST projects list |
| `src/app/api/projects/[id]/route.ts` | PUT / DELETE single project |

### Modified files
| Path | Change |
|---|---|
| `src/lib/chat-projects.ts` | Re-export from `cave-projects`; keep existing derived-group functions; remove hardcoded array |
| `src/lib/chat-project-selection.ts` | Use project ID as selection key (was: project root path) |
| `src/lib/cave-board-types.ts` | Add `projectId: string \| null` field to `Card` |
| `src/lib/cave-board.ts` | Read/write `projectId`; migrate `cwd` → `projectId` on load |
| `src/components/chat-project-sidebar.tsx` | Drive from live project list instead of hardcoded `ChatProjectGroup` names |
| `src/components/chat-view.tsx` | Project selector pulls from live projects API |
| `src/components/workspace.tsx` | Add `"projects"` workspace mode; render `ProjectsView` |
| `src/components/sidebar-minimal.tsx` | Add Projects nav item |
| `src/lib/types.ts` | _(no change needed; `project_root` stays on `SessionRow` — daemon owns it)_ |

---

## Task 1: `cave-projects.ts` — persistent project store

**Files:**
- Create: `src/lib/cave-projects.ts`
- Create: `src/lib/cave-projects.test.ts`

### What a project looks like
```ts
export type CaveProject = {
  id: string;          // nanoid(10), stable forever
  name: string;        // display label e.g. "Coven Cave"
  root: string;        // absolute CWD e.g. "/Users/buns/Documents/GitHub/OpenCoven/coven-cave"
  color?: string;      // optional hex accent (future use)
  createdAt: string;   // ISO-8601
  updatedAt: string;
};
```

Storage file: `~/.coven/cave-projects.json` (same dir as `cave-board.json`).

- [ ] **Step 1.1: Write failing tests**

Create `src/lib/cave-projects.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Override COVEN_DIR before importing the module
let tmpDir: string;

describe("cave-projects", () => {
  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "cave-projects-test-"));
    process.env.CAVE_PROJECTS_PATH_OVERRIDE = path.join(tmpDir, "cave-projects.json");
  });

  afterEach(async () => {
    delete process.env.CAVE_PROJECTS_PATH_OVERRIDE;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns [] when file does not exist", async () => {
    const { loadProjects } = await import("./cave-projects.ts");
    const projects = await loadProjects();
    expect(projects).toEqual([]);
  });

  it("creates, loads, and deletes a project", async () => {
    const { createProject, loadProjects, deleteProject } = await import("./cave-projects.ts");
    const p = await createProject({ name: "Test", root: "/tmp/test" });
    expect(p.id).toBeTruthy();
    expect(p.name).toBe("Test");
    const all = await loadProjects();
    expect(all).toHaveLength(1);
    await deleteProject(p.id);
    expect(await loadProjects()).toHaveLength(0);
  });

  it("patches name and root", async () => {
    const { createProject, patchProject, loadProjects } = await import("./cave-projects.ts");
    const p = await createProject({ name: "Old", root: "/old" });
    await patchProject(p.id, { name: "New", root: "/new" });
    const [updated] = await loadProjects();
    expect(updated.name).toBe("New");
    expect(updated.root).toBe("/new");
  });

  it("normalizes root: strips trailing slash", async () => {
    const { createProject, loadProjects } = await import("./cave-projects.ts");
    await createProject({ name: "Trail", root: "/some/path/" });
    const [p] = await loadProjects();
    expect(p.root).toBe("/some/path");
  });

  it("projectForRoot resolves by normalized path", async () => {
    const { createProject, projectForRoot } = await import("./cave-projects.ts");
    const p = await createProject({ name: "X", root: "/some/path" });
    expect(projectForRoot("/some/path/")?.id).toBe(p.id);
    expect(projectForRoot("/other")).toBeNull();
  });
});
```

- [ ] **Step 1.2: Run tests — expect FAIL (module does not exist)**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
npx vitest run src/lib/cave-projects.test.ts 2>&1 | tail -20
```
Expected: cannot find module or similar import error.

- [ ] **Step 1.3: Implement `src/lib/cave-projects.ts`**

```ts
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";

export type CaveProject = {
  id: string;
  name: string;
  root: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectsFile = { version: 1; projects: CaveProject[] };

function projectsFilePath(): string {
  return (
    process.env.CAVE_PROJECTS_PATH_OVERRIDE ??
    path.join(homedir(), ".coven", "cave-projects.json")
  );
}

function normalizeRoot(root: string): string {
  return root.trim().replace(/\\/g, "/").replace(/\/+$/, "") || "/";
}

function nanoid(len = 10): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function readFile_(p: string): Promise<string | null> {
  try {
    return await readFile(p, "utf8");
  } catch {
    return null;
  }
}

async function writeAtomic(filePath: string, data: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data, "utf8");
}

export async function loadProjects(): Promise<CaveProject[]> {
  const raw = await readFile_(projectsFilePath());
  if (!raw) return [];
  try {
    const parsed: ProjectsFile = JSON.parse(raw);
    return Array.isArray(parsed.projects) ? parsed.projects : [];
  } catch {
    return [];
  }
}

async function saveProjects(projects: CaveProject[]): Promise<void> {
  const file: ProjectsFile = { version: 1, projects };
  await writeAtomic(projectsFilePath(), JSON.stringify(file, null, 2));
}

export async function createProject(input: { name: string; root: string; color?: string }): Promise<CaveProject> {
  const projects = await loadProjects();
  const now = new Date().toISOString();
  const project: CaveProject = {
    id: nanoid(),
    name: input.name.trim(),
    root: normalizeRoot(input.root),
    color: input.color,
    createdAt: now,
    updatedAt: now,
  };
  await saveProjects([...projects, project]);
  return project;
}

export async function patchProject(
  id: string,
  patch: Partial<Pick<CaveProject, "name" | "root" | "color">>,
): Promise<CaveProject | null> {
  const projects = await loadProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const updated: CaveProject = {
    ...projects[idx],
    ...patch,
    root: patch.root !== undefined ? normalizeRoot(patch.root) : projects[idx].root,
    updatedAt: new Date().toISOString(),
  };
  const next = [...projects];
  next[idx] = updated;
  await saveProjects(next);
  return updated;
}

export async function deleteProject(id: string): Promise<boolean> {
  const projects = await loadProjects();
  const next = projects.filter((p) => p.id !== id);
  if (next.length === projects.length) return false;
  await saveProjects(next);
  return true;
}

/** Sync lookup by normalised root path. Reads from in-memory array. */
export function projectForRoot(
  root: string | null | undefined,
  projects: CaveProject[],
): CaveProject | null {
  if (!root?.trim()) return null;
  const n = normalizeRoot(root);
  return projects.find((p) => normalizeRoot(p.root) === n) ?? null;
}

export function projectById(
  id: string | null | undefined,
  projects: CaveProject[],
): CaveProject | null {
  if (!id) return null;
  return projects.find((p) => p.id === id) ?? null;
}
```

Note: `projectForRoot` and `projectById` take the projects array as a param (no async I/O) — callers that already fetched the list use these for sync resolution. This is the same pattern as `chat-projects.ts`'s `projectForRoot`.

- [ ] **Step 1.4: Run tests — expect PASS**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
npx vitest run src/lib/cave-projects.test.ts 2>&1 | tail -20
```
Expected: all 5 tests pass.

- [ ] **Step 1.5: Commit**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
git add src/lib/cave-projects.ts src/lib/cave-projects.test.ts
git commit -m "feat(projects): cave-projects persistent store with CRUD"
```

---

## Task 2: Seed `cave-projects.json` from existing hardcoded list

The hardcoded `CHAT_PROJECTS` list has 5 entries. On first run, if `cave-projects.json` is absent, we seed it. This means existing users don't lose their project list.

**Files:**
- Modify: `src/lib/cave-projects.ts` (add `seedDefaultProjects`)
- Create: `src/app/api/projects/seed/route.ts` (one-shot POST)

- [ ] **Step 2.1: Add `seedDefaultProjects` to `cave-projects.ts`**

Add at the bottom of `src/lib/cave-projects.ts`:
```ts
const DEFAULT_PROJECTS: Array<{ name: string; root: string }> = [
  { name: "Coven Cave", root: "/Users/buns/Documents/GitHub/OpenCoven/coven-cave" },
  { name: "Coven", root: "/Users/buns/Documents/GitHub/OpenCoven/coven" },
  { name: "Coven Code", root: "/Users/buns/Documents/GitHub/OpenCoven/coven-code" },
  { name: "CastCodes", root: "/Users/buns/Documents/GitHub/OpenCoven/cast-codes" },
  { name: "Coven Docs", root: "/Users/buns/Documents/GitHub/OpenCoven/coven-docs" },
];

/** Creates default project entries if the file does not exist yet. */
export async function seedDefaultProjectsIfEmpty(): Promise<void> {
  const existing = await loadProjects();
  if (existing.length > 0) return;
  for (const d of DEFAULT_PROJECTS) {
    await createProject(d);
  }
}
```

- [ ] **Step 2.2: Create seed API route**

Create `src/app/api/projects/seed/route.ts`:
```ts
import { NextResponse } from "next/server";
import { seedDefaultProjectsIfEmpty, loadProjects } from "@/lib/cave-projects";

export const dynamic = "force-dynamic";

export async function POST() {
  await seedDefaultProjectsIfEmpty();
  const projects = await loadProjects();
  return NextResponse.json({ ok: true, projects });
}
```

- [ ] **Step 2.3: Run the seed manually to create `cave-projects.json`**

The Cave dev server needs to be running, or run as a one-off:
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
node -e "
const { seedDefaultProjectsIfEmpty, loadProjects } = require('./src/lib/cave-projects.ts');
// Use tsx for TypeScript
" 2>/dev/null || npx tsx -e "
import { seedDefaultProjectsIfEmpty, loadProjects } from './src/lib/cave-projects.ts';
await seedDefaultProjectsIfEmpty();
const p = await loadProjects();
console.log(JSON.stringify(p, null, 2));
"
```
Expected: prints JSON array with 5 projects, each with a stable `id`.

- [ ] **Step 2.4: Verify file was created**
```bash
cat ~/.coven/cave-projects.json | python3 -m json.tool | head -30
```
Expected: `{"version":1,"projects":[...5 entries...]}`.

- [ ] **Step 2.5: Commit**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
git add src/lib/cave-projects.ts src/app/api/projects/seed/route.ts
git commit -m "feat(projects): seed defaults from hardcoded list on first run"
```

---

## Task 3: Projects CRUD API routes

**Files:**
- Create: `src/app/api/projects/route.ts`
- Create: `src/app/api/projects/[id]/route.ts`

- [ ] **Step 3.1: Create `src/app/api/projects/route.ts`**

```ts
import { NextResponse } from "next/server";
import { loadProjects, createProject, seedDefaultProjectsIfEmpty } from "@/lib/cave-projects";

export const dynamic = "force-dynamic";

export async function GET() {
  await seedDefaultProjectsIfEmpty();
  const projects = await loadProjects();
  return NextResponse.json({ ok: true, projects });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const root = String(body.root ?? "").trim();
  if (!name || !root) {
    return NextResponse.json({ ok: false, error: "name and root are required" }, { status: 400 });
  }
  const project = await createProject({ name, root, color: body.color });
  return NextResponse.json({ ok: true, project }, { status: 201 });
}
```

- [ ] **Step 3.2: Create `src/app/api/projects/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { patchProject, deleteProject } from "@/lib/cave-projects";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, string> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.root === "string") patch.root = body.root.trim();
  if (typeof body.color === "string") patch.color = body.color;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "nothing to update" }, { status: 400 });
  }
  const updated = await patchProject(id, patch);
  if (!updated) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, project: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteProject(id);
  if (!deleted) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3.3: Smoke test routes with curl (Cave dev server running)**
```bash
# GET all
curl -s http://localhost:3000/api/projects | python3 -m json.tool | head -20

# POST new project
curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project","root":"/tmp/test-project"}' | python3 -m json.tool

# Capture the id from above, then PUT
PROJECT_ID="<id from above>"
curl -s -X PUT "http://localhost:3000/api/projects/$PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Renamed"}' | python3 -m json.tool

# DELETE
curl -s -X DELETE "http://localhost:3000/api/projects/$PROJECT_ID" | python3 -m json.tool
```
Expected: all return `{"ok":true,...}`.

- [ ] **Step 3.4: Commit**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
git add src/app/api/projects/
git commit -m "feat(projects): CRUD API routes GET/POST/PUT/DELETE"
```

---

## Task 4: `useProjects` hook — client-side live project list

All client components that currently import `CHAT_PROJECTS` will use this hook instead.

**Files:**
- Create: `src/lib/use-projects.ts`

- [ ] **Step 4.1: Create `src/lib/use-projects.ts`**

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CaveProject } from "@/lib/cave-projects";

export type ProjectsState = {
  projects: CaveProject[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  createProject: (name: string, root: string) => Promise<CaveProject | null>;
  renameProject: (id: string, name: string) => Promise<boolean>;
  updateRoot: (id: string, root: string) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
};

export function useProjects(): ProjectsState {
  const [projects, setProjects] = useState<CaveProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", { signal: ac.signal });
      const data = await res.json();
      if (!ac.signal.aborted) {
        setProjects(Array.isArray(data.projects) ? data.projects : []);
      }
    } catch (err) {
      if (!ac.signal.aborted) {
        setError(err instanceof Error ? err.message : "Failed to load projects");
      }
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => { abortRef.current?.abort(); };
  }, [load]);

  const createProject = useCallback(async (name: string, root: string): Promise<CaveProject | null> => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, root }),
    });
    const data = await res.json();
    if (data.ok && data.project) {
      setProjects((prev) => [...prev, data.project]);
      return data.project as CaveProject;
    }
    return null;
  }, []);

  const renameProject = useCallback(async (id: string, name: string): Promise<boolean> => {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.ok) {
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
      return true;
    }
    return false;
  }, []);

  const updateRoot = useCallback(async (id: string, root: string): Promise<boolean> => {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root }),
    });
    const data = await res.json();
    if (data.ok) {
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, root } : p)));
      return true;
    }
    return false;
  }, []);

  const deleteProject = useCallback(async (id: string): Promise<boolean> => {
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      return true;
    }
    return false;
  }, []);

  return { projects, loading, error, reload: load, createProject, renameProject, updateRoot, deleteProject };
}
```

- [ ] **Step 4.2: Commit**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
git add src/lib/use-projects.ts
git commit -m "feat(projects): useProjects hook for client-side CRUD"
```

---

## Task 5: Update `chat-projects.ts` to use live store

Replace hardcoded `CHAT_PROJECTS` array with `loadProjects()` call. Preserve all existing exported types and functions — callers must not break.

**Files:**
- Modify: `src/lib/chat-projects.ts`

- [ ] **Step 5.1: Update `src/lib/chat-projects.ts`**

Replace the entire file content:

```ts
/**
 * chat-projects.ts
 *
 * Thin adapter: delegates to cave-projects (persistent store) instead of a
 * hardcoded array. Re-exports types for consumers that already import from here.
 */
import type { SessionRow } from "@/lib/types";
import type { CaveProject } from "@/lib/cave-projects";
import { loadProjects, projectForRoot as _projectForRoot, projectById as _projectById } from "@/lib/cave-projects";

// Re-export CaveProject under the legacy alias so existing imports don't break.
export type ChatProject = CaveProject;
export type { CaveProject };

// ── Async helpers (server / API routes) ───────────────────────────────────────

/** Load projects from disk (server-side, async). */
export { loadProjects };

// ── Sync helpers (need pre-loaded list) ──────────────────────────────────────

export function normalizeChatProjectRoot(root: string): string {
  return root.trim().replace(/\\/g, "/").replace(/\/+$/, "") || "/";
}

export function chatProjectById(id: string | null | undefined, projects: CaveProject[]): CaveProject | null {
  return _projectById(id, projects);
}

export function projectForRoot(
  root: string | null | undefined,
  projects: CaveProject[],
): CaveProject | null {
  return _projectForRoot(root, projects);
}

export function projectIdForRoot(
  root: string | null | undefined,
  projects: CaveProject[],
): string | null {
  return _projectForRoot(root, projects)?.id ?? null;
}

// ── Derived-group helpers ─────────────────────────────────────────────────────

const DEAD_CHAT_STATUSES = new Set(["killed", "orphaned", "stopped", "archived"]);

export type ChatProjectGroup = {
  projectId: string | null;
  projectRoot: string | null;
  projectName: string | null;
  sessions: SessionRow[];
  defaultFamiliarId: string | null;
  updatedAt: string | null;
};

function sessionTimestamp(session: SessionRow): string {
  return session.updated_at || session.created_at;
}

export function filterVisibleChatSessions(
  sessions: SessionRow[],
  familiarId: string | null,
): SessionRow[] {
  return sessions
    .filter((session) => !DEAD_CHAT_STATUSES.has(session.status))
    .filter((session) => familiarId === null || session.familiarId === familiarId)
    .sort((a, b) => (sessionTimestamp(a) < sessionTimestamp(b) ? 1 : -1));
}

export function deriveChatProjectGroups(
  sessions: SessionRow[],
  projects: CaveProject[],
): ChatProjectGroup[] {
  const groups = new Map<string | null, SessionRow[]>();

  for (const project of projects) {
    groups.set(normalizeChatProjectRoot(project.root), []);
  }

  for (const session of sessions) {
    const project = _projectForRoot(session.project_root, projects);
    const projectRoot = project?.root
      ?? (session.project_root?.trim() ? normalizeChatProjectRoot(session.project_root) : null);
    const group = groups.get(projectRoot) ?? [];
    group.push(session);
    groups.set(projectRoot, group);
  }

  return Array.from(groups.entries())
    .map(([projectRoot, rows]) => {
      const sorted = [...rows].sort((a, b) =>
        sessionTimestamp(a) < sessionTimestamp(b) ? 1 : -1,
      );
      const latest = sorted[0] ?? null;
      const project = _projectForRoot(projectRoot, projects);
      return {
        projectId: project?.id ?? null,
        projectRoot,
        projectName: project?.name ?? null,
        sessions: sorted,
        defaultFamiliarId: latest?.familiarId ?? null,
        updatedAt: latest ? sessionTimestamp(latest) : null,
      };
    })
    .sort((a, b) => {
      if (a.updatedAt && b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
      if (a.updatedAt) return -1;
      if (b.updatedAt) return 1;
      const aIdx = a.projectId ? projects.findIndex((p) => p.id === a.projectId) : -1;
      const bIdx = b.projectId ? projects.findIndex((p) => p.id === b.projectId) : -1;
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
      if (aIdx >= 0) return -1;
      if (bIdx >= 0) return 1;
      return (a.projectRoot ?? "").localeCompare(b.projectRoot ?? "");
    });
}

export function chatProjectName(projectRoot: string | null, projects: CaveProject[]): string {
  if (!projectRoot) return "No project";
  const project = _projectForRoot(projectRoot, projects);
  if (project) return project.name;
  const parts = projectRoot.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? projectRoot;
}
```

**Note:** `chatProjectById`, `projectForRoot`, `projectIdForRoot`, `deriveChatProjectGroups`, and `chatProjectName` now all require the `projects` array as the last parameter. All call sites need updating in later tasks. This is the key signature change.

- [ ] **Step 5.2: Run TypeScript check — expect errors on callers (expected at this stage)**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
npx tsc --noEmit 2>&1 | grep "chat-projects" | head -20
```
Expected: type errors in `chat-list.tsx`, `chat-view.tsx`, `chat-router.tsx`, `chat-project-sidebar.tsx` — these will be fixed in Tasks 6 and 7.

- [ ] **Step 5.3: Commit (known broken — callers fixed next)**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
git add src/lib/chat-projects.ts
git commit -m "feat(projects): chat-projects delegates to cave-projects store [callers TBD]"
```

---

## Task 6: Update `chat-router.tsx` and `chat-list.tsx` callers

These two files consume `deriveChatProjectGroups`, `filterVisibleChatSessions`, and `chatProjectName`. They need to receive thelive projects list via the `useProjects` hook and pass it down.

**Files:**
- Modify: `src/components/chat-router.tsx`
- Modify: `src/components/chat-list.tsx`

- [ ] **Step 6.1: Update `chat-router.tsx`**

Add `useProjects` import and pass `projects` to all `deriveChatProjectGroups` calls:

In `src/components/chat-router.tsx`, find the imports block and add:
```ts
import { useProjects } from "@/lib/use-projects";
```

Find the component body (inside `ChatRouter`), add after the `useState` lines:
```ts
const { projects } = useProjects();
```

Change the `sidebarGroups` memoization from:
```ts
const sidebarGroups = useMemo(() => deriveChatProjectGroups(sidebarSessions), [sidebarSessions]);
```
to:
```ts
const sidebarGroups = useMemo(
  () => deriveChatProjectGroups(sidebarSessions, projects),
  [sidebarSessions, projects],
);
```

- [ ] **Step 6.2: Update `chat-list.tsx`**

Add `useProjects` import:
```ts
import { useProjects } from "@/lib/use-projects";
```

Add inside the `ChatList` component body:
```ts
const { projects } = useProjects();
```

Change both `deriveChatProjectGroups` calls to pass `projects`:
```ts
// line ~292
const grouped = useMemo(() => deriveChatProjectGroups(filtered, projects), [filtered, projects]);
// line ~300
const sidebarGroups = useMemo(() => deriveChatProjectGroups(mine, projects), [mine, projects]);
```

Also update the `projectCount` line:
```ts
const projectCount = new Set(mine.map((s) => s.project_root).filter(Boolean)).size;
// becomes:
const projectCount = new Set(
  mine.map((s) => {
    const p = projects.find((pr) => pr.root === s.project_root);
    return p?.id ?? s.project_root;
  }).filter(Boolean)
).size;
```

- [ ] **Step 6.3: Run TS check — errors should reduce**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
npx tsc --noEmit 2>&1 | grep -E "chat-router|chat-list" | head -10
```
Expected: no more errors in these two files.

- [ ] **Step 6.4: Commit**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
git add src/components/chat-router.tsx src/components/chat-list.tsx
git commit -m "feat(projects): chat-router + chat-list use live projects"
```

---

## Task 7: Update `chat-view.tsx` — project selector uses live list

`chat-view.tsx` uses `CHAT_PROJECTS`, `chatProjectById`, `DEFAULT_CHAT_PROJECT`, `DEFAULT_CHAT_PROJECT_ID`, and `projectIdForRoot`. These become dynamic.

**Files:**
- Modify: `src/components/chat-view.tsx`

- [ ] **Step 7.1: Add `useProjects` import and hook call in `ChatView`**

In `src/components/chat-view.tsx`, remove imports:
```ts
CHAT_PROJECTS,
DEFAULT_CHAT_PROJECT,
DEFAULT_CHAT_PROJECT_ID,
```

Add import:
```ts
import { useProjects } from "@/lib/use-projects";
```

Inside the main `ChatView` component (the large one that renders the chat surface), add near the top of the function body:
```ts
const { projects } = useProjects();
const firstProject = projects[0] ?? null;
```

Replace the `projectIdDraft` initializer:
```ts
// before:
const [projectIdDraft, setProjectIdDraft] = useState(
  () => projectIdForRoot(session?.project_root ?? projectRoot) ?? DEFAULT_CHAT_PROJECT_ID
);
const selectedProject = chatProjectById(projectIdDraft) ?? DEFAULT_CHAT_PROJECT;

// after:
const [projectIdDraft, setProjectIdDraft] = useState<string | null>(
  () => projectIdForRoot(session?.project_root ?? projectRoot, projects) ?? firstProject?.id ?? null
);
const selectedProject = projectIdDraft
  ? chatProjectById(projectIdDraft, projects) ?? firstProject
  : firstProject;
```

Update the effect that resets `projectIdDraft` on session change:
```ts
// before:
setProjectIdDraft(projectIdForRoot(session?.project_root ?? projectRoot) ?? DEFAULT_CHAT_PROJECT_ID);

// after:
setProjectIdDraft(
  projectIdForRoot(session?.project_root ?? projectRoot, projects) ?? firstProject?.id ?? null
);
```

- [ ] **Step 7.2: Update the `EmptyChatSurface` sub-component project selector**

The `EmptyChatSurface` and `InlineProjectField` sub-components receive `projectId` + `onProjectChange`. Update both to accept `projects: CaveProject[]` as a prop, then render the list dynamically instead of `{CHAT_PROJECTS.map(...)}`:

In `EmptyChatSurface`:
```ts
// Add prop
projects: CaveProject[];

// Replace the select options render:
{projects.map((project) => (
  <option key={project.id} value={project.id}>
    {project.name}
  </option>
))}
```

In `InlineProjectField`:
```ts
// Add prop
projects: CaveProject[];

// Replace
const project = chatProjectById(projectId, projects) ?? projects[0];

// Replace options render:
{projects.map((entry) => (
  <option key={entry.id} value={entry.id}>
    {entry.name}
  </option>
))}
```

Call sites for these components: pass `projects={projects}` from the parent `ChatView`.

- [ ] **Step 7.3: Run TS check — chat-view errors should clear**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
npx tsc --noEmit 2>&1 | grep "chat-view" | head -10
```
Expected: no type errors in `chat-view.tsx`.

- [ ] **Step 7.4: Commit**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
git add src/components/chat-view.tsx
git commit -m "feat(projects): chat-view uses live projects for selector"
```

---

## Task 8: Update `chat-project-sidebar.tsx` and `chat-project-selection.ts`

The sidebar currently uses `projectRoot` strings as selection keys. Switch to project `id` throughout.

**Files:**
- Modify: `src/lib/chat-project-selection.ts`
- Modify: `src/components/chat-project-sidebar.tsx`

- [ ] **Step 8.1: Update `chat-project-selection.ts` — selection key is now projectId**

Replace `selectionKey` function. The old code used `projectRoot`; now use `projectId`:
```ts
// before:
export function selectionKey(projectRoot: string | null): string {
  return projectRoot === null ? "none" : projectRoot;
}

// after:
/** "all" = all projects, "none" = unscoped group, otherwise a project ID. */
export function selectionKey(projectId: string | null): string {
  return projectId === null ? "none" : projectId;
}
```

Update `applyProjectScope` to match on `projectId` instead of `projectRoot`:
```ts
export function applyProjectScope(
  groups: ChatProjectGroup[],
  selection: ProjectSelection,
): ChatProjectGroup[] {
  if (selection === "all") return groups;
  const match = groups.find((g) => selectionKey(g.projectId) === selection);
  return match ? [match] : [];
}
```

Update `normalizeSelection`:
```ts
export function normalizeSelection(
  selection: ProjectSelection,
  groups: ChatProjectGroup[],
): ProjectSelection {
  if (selection === "all") return "all";
  return groups.some((g) => selectionKey(g.projectId) === selection) ? selection : "all";
}
```

- [ ] **Step 8.2: Update `chat-project-sidebar.tsx`**

The sidebar's `onSelect` and `onToggleExpanded` callbacks receive project root paths today. Change to project IDs by updating the click handlers:

In `ChatProjectSidebar`, replace every `selectionKey(g.projectRoot)` usage with `selectionKey(g.projectId)`, and pass `g.projectId` to `onNewChat` instead of `g.projectRoot`:
```ts
// Every click handler that calls onSelect:
onSelect(selectionKey(g.projectId))

// onNewChat calls:
onNewChat(g.projectRoot)  // keep root here — this is still passed to daemon
```

- [ ] **Step 8.3: Run full TS check**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```
Expected: 0 errors or only pre-existing unrelated warnings.

- [ ] **Step 8.4: Commit**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
git add src/lib/chat-project-selection.ts src/components/chat-project-sidebar.tsx
git commit -m "feat(projects): selection keys use projectId not projectRoot"
```

---

## Task 9: Add `projectId` to board cards

Board tasks (`Card` in `cave-board-types.ts`) have a `cwd` field but no `projectId`. Add `projectId` as an optional nullable field and migrate on load.

**Files:**
- Modify: `src/lib/cave-board-types.ts`
- Modify: `src/lib/cave-board.ts`

- [ ] **Step 9.1: Add `projectId` field to `Card` type**

In `src/lib/cave-board-types.ts`, add to the `Card` type after `cwd`:
```ts
/** Stable project ID from cave-projects.json. Preferred over cwd. */
projectId?: string | null;
```

- [ ] **Step 9.2: Update `normalizeCard` in `cave-board.ts` to preserve `projectId`**

In `src/lib/cave-board.ts`, in the `normalizeCard` function, the spread of `c` already preserves unknown fields but add explicit handling:

Find `normalizeCard` (or the card normalization object) and add:
```ts
projectId: c.projectId ?? null,
```

to the returned object (alongside `cwd`, `sessionId`, etc.).

- [ ] **Step 9.3: Update `patchCard` / `updateCard` to accept `projectId`**

Find the list of patchable fields (the union type or `"cwd" | "links" | ...`). Add `"projectId"` to that union so it can be updated via `patchCard`.

In `cave-board.ts` around line 81 (the partial-patch union), add `"projectId"` to the allowed keys:
```ts
// before:
"cwd" | "links" | "github" | "lifecycle" | "lifecycleAt" | "retryCount" | "maxRetries" | "steps"

// after:
"cwd" | "projectId" | "links" | "github" | "lifecycle" | "lifecycleAt" | "retryCount" | "maxRetries" | "steps"
```

Also update the patch object spread to include `projectId`:
```ts
projectId: "projectId" in patch ? patch.projectId ?? null : current.projectId ?? null,
```

- [ ] **Step 9.4: Run TS check**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
npx tsc --noEmit 2>&1 | grep -E "cave-board" | head -10
```
Expected: no errors.

- [ ] **Step 9.5: Commit**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
git add src/lib/cave-board-types.ts src/lib/cave-board.ts
git commit -m "feat(projects): add projectId field to board Card type"
```

---

## Task 10: `ProjectsView` component

A full-page management view: list projects, create new, rename inline, change CWD, delete. No routing needed — it's just another workspace mode.

**Files:**
- Create: `src/components/projects-view.tsx`

- [ ] **Step 10.1: Create `src/components/projects-view.tsx`**

```tsx
"use client";

import { useState, useRef } from "react";
import { Icon } from "@/lib/icon";
import { useProjects } from "@/lib/use-projects";
import type { CaveProject } from "@/lib/cave-projects";

type EditState = { id: string; field: "name" | "root"; value: string } | null;

function ProjectRow({
  project,
  chatCount,
  onRename,
  onUpdateRoot,
  onDelete,
  onNewChat,
}: {
  project: CaveProject;
  chatCount: number;
  onRename: (id: string, name: string) => void;
  onUpdateRoot: (id: string, root: string) => void;
  onDelete: (id: string) => void;
  onNewChat: (projectRoot: string) => void;
}) {
  const [editName, setEditName] = useState(false);
  const [editRoot, setEditRoot] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);
  const [rootDraft, setRootDraft] = useState(project.root);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const rootInputRef = useRef<HTMLInputElement>(null);

  function commitName() {
    const v = nameDraft.trim();
    if (v && v !== project.name) onRename(project.id, v);
    setEditName(false);
  }

  function commitRoot() {
    const v = rootDraft.trim();
    if (v && v !== project.root) onUpdateRoot(project.id, v);
    setEditRoot(false);
  }

  return (
    <div className="group flex flex-col gap-0.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-raised)] px-4 py-3 transition-colors hover:border-[var(--border-strong)]">
      {/* Name row */}
      <div className="flex items-center gap-2">
        <Icon name="ph:folder-open-bold" width={14} className="shrink-0 text-[var(--accent-presence)]" aria-hidden />
        {editName ? (
          <input
            ref={nameInputRef}
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") { setNameDraft(project.name); setEditName(false); }
            }}
            className="min-w-0 flex-1 rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[13px] font-semibold text-[var(--text-primary)] outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setNameDraft(project.name); setEditName(true); setTimeout(() => nameInputRef.current?.select(), 0); }}
            className="min-w-0 flex-1 text-left text-[13px] font-semibold text-[var(--text-primary)] hover:text-[var(--accent-presence)] focus:outline-none"
            title="Click to rename"
          >
            {project.name}
          </button>
        )}
        <span className="shrink-0 rounded-full bg-[var(--bg-sunken)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
          {chatCount} {chatCount === 1 ? "chat" : "chats"}
        </span>
        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onNewChat(project.root)}
            title="New chat in project"
            className="focus-ring flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <Icon name="ph:chat-circle-dots-bold" width={13} aria-hidden />
          </button>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              title="Delete project"
              className="focus-ring flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--color-danger)]"
            >
              <Icon name="ph:trash-bold" width={13} aria-hidden />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded px-2 py-0.5 text-[11px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
              >Cancel</button>
              <button
                type="button"
                onClick={() => onDelete(project.id)}
                className="rounded bg-[var(--color-danger)] px-2 py-0.5 text-[11px] text-white"
              >Delete</button>
            </div>
          )}
        </div>
      </div>
      {/* Root row */}
      <div className="flex items-center gap-2 pl-5">
        <Icon name="ph:folder-simple-dashed" width={12} className="shrink-0 text-[var(--text-muted)]" aria-hidden />
        {editRoot ? (
          <input
            ref={rootInputRef}
            autoFocus
            value={rootDraft}
            onChange={(e) => setRootDraft(e.target.value)}
            onBlur={commitRoot}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRoot();
              if (e.key === "Escape") { setRootDraft(project.root); setEditRoot(false); }
            }}
            className="min-w-0 flex-1 rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-secondary)] outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setRootDraft(project.root); setEditRoot(true); setTimeout(() => rootInputRef.current?.select(), 0); }}
            className="min-w-0 flex-1 truncate text-left font-mono text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] focus:outline-none"
            title={`CWD: ${project.root} — click to edit`}
          >
            {project.root}
          </button>
        )}
      </div>
    </div>
  );
}

type Props = {
  sessions?: Array<{ project_root?: string | null }>;
  onNewChat?: (projectRoot: string) => void;
};

export function ProjectsView({ sessions = [], onNewChat }: Props) {
  const { projects, loading, error, createProject, renameProject, updateRoot, deleteProject } =
    useProjects();
  const [createName, setCreateName] = useState("");
  const [createRoot, setCreateRoot] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  function chatCountForProject(root: string): number {
    return sessions.filter((s) => s.project_root?.trim() === root.trim()).length;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim() || !createRoot.trim()) return;
    setCreating(true);
    await createProject(createName.trim(), createRoot.trim());
    setCreateName("");
    setCreateRoot("");
    setCreating(false);
    setShowForm(false);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-hairline)] px-6 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Projects</h2>
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
            Each project maps a name to a working directory. Chats and tasks are grouped by project.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="focus-ring flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-raised)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
        >
          <Icon name="ph:plus-bold" width={12} aria-hidden />
          New project
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="flex shrink-0 flex-col gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)] px-6 py-4"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            New project
          </p>
          <div className="flex gap-2">
            <input
              autoFocus
              placeholder="Project name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)]"
            />
            <input
              placeholder="/absolute/path/to/project"
              value={createRoot}
              onChange={(e) => setCreateRoot(e.target.value)}
              className="min-w-0 flex-[2] rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 font-mono text-[12px] text-[var(--text-secondary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || !createName.trim() || !createRoot.trim()}
              className="focus-ring rounded-md bg-[var(--accent-presence)] px-4 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="focus-ring rounded-md border border-[var(--border-hairline)] px-4 py-1.5 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Project list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="flex items-center gap-2 text-[13px] text-[var(--text-muted)]">
            <Icon name="ph:circle-notch-bold" width={14} className="animate-spin" aria-hidden />
            Loading projects…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-[12px] text-[var(--color-danger)]">
            {error}
          </div>
        )}
        {!loading && !error && projects.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Icon name="ph:folder-open" width={32} className="text-[var(--text-muted)]" aria-hidden />
            <p className="text-[13px] text-[var(--text-muted)]">No projects yet.</p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="focus-ring rounded-lg border border-[var(--border-hairline)] px-4 py-2 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              Create your first project
            </button>
          </div>
        )}
        {!loading && projects.length > 0 && (
          <div className="flex flex-col gap-2">
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                chatCount={chatCountForProject(project.root)}
                onRename={renameProject}
                onUpdateRoot={updateRoot}
                onDelete={deleteProject}
                onNewChat={onNewChat ?? (() => {})}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

Make sure these icons are in the allowlist in `src/lib/icon.tsx`:
- `ph:folder-open-bold` — check; if missing, add to the `ALLOWED_ICONS` set
- `ph:folder-simple-dashed` — check; if missing, add
- `ph:chat-circle-dots-bold` — check; if missing, add
- `ph:trash-bold` — check; if missing, add
- `ph:plus-bold` — check; if missing, add
- `ph:circle-notch-bold` — check; if missing, add

To check and add missing icons, search `src/lib/icon.tsx` for the `ALLOWED_ICONS` or similar allowlist:
```bash
grep -n "folder-open-bold\|folder-simple-dashed\|trash-bold\|circle-notch" ~/Documents/GitHub/OpenCoven/coven-cave/src/lib/icon.tsx | head -10
```
Add any missing ones to the set.

- [ ] **Step 10.2: Commit component**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
git add src/components/projects-view.tsx
git commit -m "feat(projects): ProjectsView management component"
```

---

## Task 11: Add `projects` workspace mode

Wire `ProjectsView` into the workspace: new mode, sidebar nav item, keyboard shortcut.

**Files:**
- Modify: `src/lib/workspace-mode.ts`
- Modify: `src/components/workspace.tsx`
- Modify: `src/components/sidebar-minimal.tsx`

- [ ] **Step 11.1: Add `"projects"` to `WorkspaceMode`**

In `src/lib/workspace-mode.ts`, add `"projects"` to the union:
```ts
export type WorkspaceMode =
  | "agents"
  | "home"
  | "chat"
  | "board"
  | "calendar"
  | "inbox"
  | "library"
  | "browser"
  | "terminal"
  | "github"
  | "roles"
  | "workflows"
  | "capabilities"
  | "projects";  // ← add
```

- [ ] **Step 11.2: Add `ProjectsView` to workspace detail render**

In `src/components/workspace.tsx`:

1. Add import:
```ts
import { ProjectsView } from "@/components/projects-view";
```

2. Add to `WORKSPACE_MODE_TITLES`:
```ts
projects: "Projects",
```

3. In the `detail` JSX block, add before the final `null`/fallback at the end:
```tsx
} : mode === "projects" ? (
  <ProjectsView
    sessions={sessions}
    onNewChat={(projectRoot) => {
      setMode("chat");
      startAgentChat(activeId, projectRoot);
    }}
  />
```

- [ ] **Step 11.3: Add Projects nav item to `sidebar-minimal.tsx`**

In `src/components/sidebar-minimal.tsx`, add `"projects"` to the WorkspaceMode union:
```ts
| "projects"
```

Add to the `NAV_ITEMS` array in the `"tools"` group (after `"workflows"`):
```ts
{ id: "projects", label: "Projects", iconName: "ph:folders-bold", group: "tools" },
```

Check `ph:folders-bold` is in the icon allowlist; add if missing.

- [ ] **Step 11.4: Run TS check — should be clean**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```
Expected: 0 errors.

- [ ] **Step 11.5: Commit**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
git add src/lib/workspace-mode.ts src/components/workspace.tsx src/components/sidebar-minimal.tsx
git commit -m "feat(projects): add Projects workspace mode and sidebar nav"
```

---

## Task 12: Migrate orphaned sessions — re-home invalid-CWD sessions

The 22 quarantined sessions in `~/.coven/invalid-cwd-sessions-2026-06-11T20-09-10-228Z.json` have `project_root` paths pointing to deleted worktrees. Re-map them to the `coven-cave` project root (the parent repo).

**Files:**
- Create (one-off script, delete after use): `scripts/migrate-invalid-cwd-sessions.ts`
- Modify: `src/app/api/sessions/list/route.ts` (relax validation to tolerate missing-but-known-project roots)

- [ ] **Step 12.1: Understand the invalid sessions**
```bash
cat ~/.coven/invalid-cwd-sessions-2026-06-11T20-09-10-228Z.json | python3 -c "
import sys, json
data = json.load(sys.stdin)
roots = set(s['project_root'] for s in data['sessions'])print(json.dumps(list(roots), indent=2))
"
```
Expected: list of worktree paths like `.worktrees/chat-polish`, `.worktrees/browser-polish`, `.wt/fix-right-sidepanel-scroll` — all under the coven-cave repo.

- [ ] **Step 12.2: Understand the daemon re-homing API**

The daemon's `PATCH /api/v1/sessions/{id}` endpoint likely accepts `project_root`. Verify:
```bash
curl -s --unix-socket ~/.coven/coven.sock http://localhost/api/v1/sessions/e340a385-8414-4403-a4d1-c560787d4db0 2>/dev/null | python3 -m json.tool | head -10
```
If a PATCH endpoint exists, use it. If not, the sessions can be re-homed by directly updating the sqlite DB.

- [ ] **Step 12.3: Re-home sessions to canonical project root via daemon PATCH**

The canonical root for all those worktrees is `/Users/buns/Documents/GitHub/OpenCoven/coven-cave`.

```bash
CANONICAL="/Users/buns/Documents/GitHub/OpenCoven/coven-cave"
SESSION_IDS=(
  "e340a385-8414-4403-a4d1-c560787d4db0"
  "0d146949-b92c-4bae-b379-6aad6e1fa8c0"
  "20e72de5-a55d-4c20-a980-722962806069"
  "caff954e-5013-47eb-a7b9-294122b3072d"
)

for SID in "${SESSION_IDS[@]}"; do
  echo -n "Patching $SID ... "
  curl -s -X PATCH --unix-socket ~/.coven/coven.sock \
    "http://localhost/api/v1/sessions/$SID" \
    -H "Content-Type: application/json" \
    -d "{\"project_root\": \"$CANONICAL\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d.get('ok') or d.get('id') else d)"
done
```

If PATCH does not exist, fall back to sqlite:
```bash
CANONICAL="/Users/buns/Documents/GitHub/OpenCoven/coven-cave"
WORKTREE_PATTERN="coven-cave/.wor"  # matches .worktrees and .wt paths
sqlite3 ~/.coven/coven.sqlite3 "UPDATE sessions SET project_root='$CANONICAL' WHERE project_root LIKE '%$WORKTREE_PATTERN%' AND project_root != '$CANONICAL';"
sqlite3 ~/.coven/coven.sqlite3 "SELECT id, project_root FROM sessions WHERE project_root = '$CANONICAL' LIMIT 5;"
```

- [ ] **Step 12.4: Verify sessions now appear in the Cave**

Reload the Cave and confirm the 22 sessions now appear under the Coven Cave project in the chat list.

- [ ] **Step 12.5: Remove or archive the quarantine file**
```bash
mv ~/.coven/invalid-cwd-sessions-2026-06-11T20-09-10-228Z.json \
   ~/.coven/invalid-cwd-sessions-2026-06-11T20-09-10-228Z.migrated.json
```

- [ ] **Step 12.6: Remove the `isTrueProjectCwd` gate in `sessions/list/route.ts`**

The current sessions list route filters out sessions whose `project_root` doesn't exist on disk:
```ts
isValidDaemonProjectRoot: isTrueProjectCwd,
```

This is what caused the quarantining. Now that projects are first-class, the right filter is: "is this session's `project_root` a known project or does the directory exist?" Update:

```ts
// In src/app/api/sessions/list/route.ts — replace isTrueProjectCwd
import { loadProjects, projectForRoot } from "@/lib/cave-projects";

// Inside GET handler, after loadProjects:
const projects = await loadProjects();

function isKnownProjectOrValidDir(projectRoot: string): boolean {
  const known = projectForRoot(projectRoot, projects);
  if (known) return true;  // registered project — always valid
  return isTrueProjectCwd(projectRoot);  // fallback: directory check
}

// Then pass:
isValidDaemonProjectRoot: isKnownProjectOrValidDir,
```

This means sessions for registered projects are never quarantined, even if the directory was temporarily unavailable.

- [ ] **Step 12.7: Commit migration + validator fix**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
git add src/app/api/sessions/list/route.ts
git commit -m "feat(projects): validate sessions against project registry, not just disk"
```

---

## Task 13: Final integration smoke test

- [ ] **Step 13.1: Start the Cave dev server**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
npm run dev 2>&1 &
sleep 5 && curl -s http://localhost:3000/api/projects | python3 -m json.tool | head -10
```
Expected: returns 5 seeded projects with stable IDs.

- [ ] **Step 13.2: Create a new project via API**
```bash
curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project","root":"/tmp/test-smoke"}' | python3 -m json.tool
```
Expected: `{"ok":true,"project":{...}}`.

- [ ] **Step 13.3: Open the Cave in browser, navigate to Projects**

Open `http://localhost:3000` → click the Projects nav item in the sidebar → confirm project list renders.

- [ ] **Step 13.4: Create a project from the UI**

Click "New project" → fill in name + path → click "Create" → confirm it appears in the list.

- [ ] **Step 13.5: Verify chat project selector shows live list**

Navigate to Chat → start a new chat → confirm the project selector dropdown shows the live projects (not the old hardcoded 5).

- [ ] **Step 13.6: Run full test suite**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
npx vitest run 2>&1 | tail -20
```
Expected: all tests pass (or pre-existing failures only — none introduced by this work).

- [ ] **Step 13.7: Final commit and push**
```bash
cd ~/Documents/GitHub/OpenCoven/coven-cave
git log --oneline -10
git push origin main
```

---

## Self-Review

**Spec coverage check:**
- ✅ Projects stored in `cave-projects.json` (not hardcoded) — Tasks 1–3
- ✅ Client CRUD via `useProjects` hook — Task 4
- ✅ `chat-projects.ts` delegates to live store — Task 5
- ✅ Chat list + router use live projects — Task 6
- ✅ Chat-view project selector is live — Task 7
- ✅ Selection keys use project ID not path — Task 8
- ✅ Board cards gain `projectId` field — Task 9
- ✅ Projects management UI — Task 10
- ✅ Workspace mode + sidebar nav — Task 11
- ✅ Orphaned sessions re-homed — Task 12
- ✅ Session validator uses project registry — Task 12.6

**Placeholder scan:** No TBDs, no "implement later" — every step has exact code.

**Type consistency:** `CaveProject` defined in Task 1, re-exported as `ChatProject` in Task 5. `projects: CaveProject[]` parameter added consistently to `chatProjectById`, `projectForRoot`, `projectIdForRoot`, `deriveChatProjectGroups`, `chatProjectName` in Task 5, then consumed in Tasks 6–8.
