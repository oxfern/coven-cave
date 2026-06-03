export type GitHubTaskStatus = "running" | "review" | "done" | "failed";

export type GitHubTask = {
  id: string;
  repo: string;
  issueNumber: number;
  issueTitle: string;
  branch?: string;
  prNumber?: number;
  prUrl?: string;
  status: GitHubTaskStatus;
  familiarId: string;
  familiarName: string;
  sessionId?: string;
  updatedAt: string;
  checkRunUrl?: string;
};

export type GitHubTasksResult = {
  ok: true;
  tasks: GitHubTask[];
};

type WireTask = Record<string, unknown>;

export async function loadGitHubTasks(): Promise<GitHubTasksResult> {
  const res = await fetch("/api/github/tasks", { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.ok === false) {
    throw new Error(
      (data && typeof data.error === "string" && data.error) ||
        `GitHub tasks unavailable (${res.status})`,
    );
  }

  return { ok: true, tasks: normalizeGitHubTasks(data) };
}

export function normalizeGitHubTasks(data: unknown): GitHubTask[] {
  const rawTasks = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.tasks)
      ? data.tasks
      : [];

  return rawTasks
    .map((task) => normalizeGitHubTask(task))
    .filter((task): task is GitHubTask => task !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function normalizeGitHubTask(input: unknown): GitHubTask | null {
  if (!isRecord(input)) return null;
  const id = stringField(input, "id");
  const repo = stringField(input, "repo") ?? fullRepo(input);
  const issueNumber = numberField(input, "issueNumber") ?? numberField(input, "issue_number");
  const issueTitle =
    stringField(input, "issueTitle") ??
    stringField(input, "issue_title") ??
    stringField(input, "title");
  const status = normalizeStatus(stringField(input, "status"));
  const familiarId = stringField(input, "familiarId") ?? stringField(input, "familiar_id") ?? "unknown";
  const familiarName =
    stringField(input, "familiarName") ??
    stringField(input, "familiar_name") ??
    familiarId;

  if (!id || !repo || issueNumber == null || !issueTitle || !status) return null;

  return {
    id,
    repo,
    issueNumber,
    issueTitle,
    branch: stringField(input, "branch"),
    prNumber: numberField(input, "prNumber") ?? numberField(input, "pr_number"),
    prUrl: stringField(input, "prUrl") ?? stringField(input, "pr_url"),
    status,
    familiarId,
    familiarName,
    sessionId: stringField(input, "sessionId") ?? stringField(input, "session_id"),
    updatedAt:
      stringField(input, "updatedAt") ??
      stringField(input, "updated_at") ??
      new Date().toISOString(),
    checkRunUrl: stringField(input, "checkRunUrl") ?? stringField(input, "check_run_url"),
  };
}

function normalizeStatus(status: string | undefined): GitHubTaskStatus | null {
  switch (status) {
    case "queued":
    case "in_progress":
    case "running":
      return "running";
    case "needs_input":
    case "review":
    case "partial":
      return "review";
    case "completed":
    case "success":
    case "done":
      return "done";
    case "cancelled":
    case "failure":
    case "failed":
      return "failed";
    default:
      return null;
  }
}

function fullRepo(input: WireTask): string | undefined {
  const owner = stringField(input, "repoOwner") ?? stringField(input, "repo_owner");
  const name = stringField(input, "repoName") ?? stringField(input, "repo_name");
  return owner && name ? `${owner}/${name}` : undefined;
}

function stringField(input: WireTask, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberField(input: WireTask, key: string): number | undefined {
  const value = input[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is WireTask {
  return typeof value === "object" && value !== null;
}
