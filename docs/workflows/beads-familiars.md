# Beads for Familiar Issue Tracking

Beads is Cave's repo-local work graph for familiar-owned implementation. GitHub and Linear remain visibility layers: GitHub stays the review, PR, and CI source of truth, while Linear can stay the roadmap and product-planning surface. Beads owns the execution queue that tells familiars what is ready, what is blocked, who claimed it, and what evidence closes it.

## Familiar Work Queue

Every familiar starts a Cave work session by refreshing Beads context:

```bash
bd prime
bd ready --json
bd show <id> --json
bd update <id> --claim
```

One familiar claims one ready bead at a time. The bead notes should record the branch or worktree path, related GitHub PR, related Linear issue when present, current session, and verification evidence. If a familiar discovers new work while implementing, create a linked bead with `discovered-from:<parent-id>` instead of burying the follow-up in chat.

For sibling work under the same epic, prefer `--defer` for simple sequencing unless you have verified the exact `bd dep` direction with `bd dep list` and `bd ready --json`. During the initial Cave dogfood, `--deps blocks:<sibling>` created the opposite edge from what the familiar expected, so the follow-ups were deferred and annotated instead of forced through a questionable dependency graph.

Close only after the work is genuinely done:

```bash
bd close <id> --reason "Merged in PR #123 after pnpm typecheck and pnpm test:app"
```

## Familiar PR Operating Protocol

Use this lifecycle for every familiar-owned change that is headed to GitHub. Beads stays the execution truth; GitHub stays the review, PR, and CI truth. The PR body is not durable memory by itself, but it must be complete enough for a maintainer to review without reading the chat transcript.

### Intake

Start from the real queue and the real branch state:

```bash
bd prime
bd ready --json
bd show <id>
git fetch origin --prune
git status --short --branch
git branch --all --verbose --no-abbrev
```

Claim exactly one ready bead before editing. If it is already claimed by the current familiar, mark it `in_progress` and continue. If the primary checkout is dirty with unrelated work, create an isolated worktree from `origin/main` and record the path in the bead before changing files.

Branch names should be short, lowercase, and scoped to the bead or surface:

- `docs/familiar-pr-protocol`
- `fix/ios-new-host-reset`
- `feat/beads-pr-state-bridge`

Avoid `wip`, personal names, broad epics, and reused branch names. A good branch name lets a maintainer infer the intended diff before opening GitHub.

Record the starting context in the bead with `bd update <id> --append-notes`:

- familiar owner
- branch and worktree path
- source of truth for the request, such as a bead, issue, spec, PR review, or release blocker
- intended verification gates
- known unrelated dirty files that must not be swept into the PR

### Draft PR Creation

Open a draft PR once the diff is coherent enough for CI and review, even if follow-up fixes remain. Use the repository PR template and fill it with concrete context, not placeholders.

```bash
gh pr create --draft --base main --head <branch> --title "<scope>: <summary>" --body-file <filled-template.md>
bd update <id> --external-ref "https://github.com/OpenCoven/coven-cave/pull/<number>" --append-notes "PR #<number> opened as draft from <branch>."
```

The PR body must include:

- owning bead id and any linked issue/spec/Linear ticket
- why the change exists and what source proved the need
- meaningful file-level changes
- exact local verification already run
- expected CI checks still pending
- risks, rollback notes, and follow-up beads or issues

Keep the PR draft until the branch is current with `origin/main`, the diff is scoped, local verification evidence is recorded, and there are no known self-review blockers. If a PR is opened before verification to get CI signal, say that explicitly in both the PR body and bead notes.

### Review Handling

Request Copilot or human review only after the PR body is useful. Treat review comments as work items, not chat decoration:

- For required fixes, patch the code or docs, rerun the relevant verification, and reply with what changed.
- For rejected suggestions, reply with the technical reason and leave the thread unresolved unless the reviewer accepts it.
- Do not resolve a GitHub review thread until the issue is actually addressed or deliberately closed with rationale.
- If review changes alter behavior, update the PR summary, risk notes, and bead evidence.

Human `CHANGES_REQUESTED`, failing required checks, unresolved blocking review threads, or a stale base branch all block merge readiness.

### CI Failure Handling

When CI fails, capture the exact failing check and the first actionable error before editing:

```bash
gh pr checks <number>
gh run view <run-id> --log-failed
```

Reproduce locally with the narrowest command that covers the failure, patch the owning seam, and rerun the focused command plus any affected repo gate. If the failure is a known infrastructure flake, rerun the check and record the flake evidence in the PR and bead. Do not mark a PR ready-to-merge while a required check is red, skipped unexpectedly, or uninspected.

Baseline local gates for most app changes are:

```bash
pnpm check:tests-wired
pnpm typecheck
pnpm test:app
git diff --check
```

Use narrower or additional gates when the diff owns a different surface, such as `pnpm test:api`, `pnpm test:mobile`, `pnpm build`, `cargo check --locked` in `src-tauri`, Playwright, or XcodeBuildMCP. The PR template must explain why any broad baseline gate was skipped.

### At-Scale Queue Triage

For PR-heavy days, classify every open PR before opening more work:

```bash
gh pr list --state open --json number,title,url,headRefName,baseRefName,isDraft,mergeStateStatus,reviewDecision,statusCheckRollup,updatedAt
bd list --status=in_progress --json
```

Every PR should map to one bead by PR URL, branch, or explicit note. If no bead exists, create or update one before changing the branch. Use these lanes in handoff notes:

- `draft-context-needed`: PR exists but lacks bead/context/verification.
- `ci-failing`: required check failed and needs log triage.
- `review-needed`: checks are green enough for human or Copilot review.
- `changes-requested`: review feedback must be addressed.
- `stale-base`: branch needs current `origin/main` or conflict handling.
- `ready-to-merge`: checks green, review state acceptable, bead evidence complete, merge authority confirmed.
- `post-merge-cleanup`: PR merged but branch/worktree/bead cleanup is incomplete.

Do not let an older PR remain open if it duplicates already-merged work or replays stale changes onto current `main`; close or retarget it with a clear maintainer note.

### Merge Approval Policy

Never push directly to `main`. Merge only through the protected PR path and only when the current user, repository profile, or maintainer instruction grants merge authority. Without explicit authority, leave the PR in a ready state and report the exact merge command instead of running it.

Before merging, verify:

- the PR targets `main`
- the branch contains only the intended scoped diff
- required GitHub checks are green
- blocking review threads are resolved
- review decision is acceptable for the repo policy
- the bead has PR URL, verification evidence, and remaining follow-ups
- merge subject/body are squash-ready and do not hide important context

Preferred merge command when authorized:

```bash
gh pr merge <number> --squash --delete-branch --subject "<scope>: <summary>" --body "<body>"
```

If `gh pr merge --delete-branch` reports a local worktree cleanup error, inspect the remote PR state before retrying. The merge may already be complete and only local cleanup may remain.

### Post-Merge Cleanup

After merge, verify the remote state and clean only the work you own:

```bash
gh pr view <number> --json state,mergedAt,mergeCommit,url,headRefName
git fetch origin --prune
git status --short --branch
git worktree list
```

Remove the local worktree and local branch after confirming there is no unmerged work to preserve:

```bash
git worktree remove .worktrees/<branch>
git branch -D <branch>
```

If the worktree contains useful unmerged changes, preserve them with a named stash or archive patch before cleanup and record the preservation path in the bead.

### Bead Close Evidence

Close the bead only after the PR merged or after the bead's explicit completion criteria are otherwise satisfied. The close reason should be enough for another maintainer to audit the work later:

```bash
bd update <id> --append-notes "PR #<number> merged as <sha>. Verification: pnpm check:tests-wired; pnpm typecheck; pnpm test:app; git diff --check. Cleanup: remote branch deleted, local worktree removed. Follow-up: cave-xyz."
bd close <id> --reason "Merged in PR #<number> as <sha> after recorded verification."
```

If the PR is still open, keep the bead `in_progress` and append the current blocker instead of closing it.

## Coven Metadata Conventions

Use labels and metadata consistently so Cave can render the graph without guessing:

- `familiar:cody`, `familiar:kitty`, `familiar:nova`, or the owning familiar.
- `surface:ios`, `surface:daemon`, `surface:chat`, `surface:github`, `surface:release`, or another concrete Cave surface.
- `release-blocker`, `needs-human`, `verification-required`, and `dogfood` when those states apply.
- `external-ref` for GitHub PRs, GitHub issues, Linear tickets, or App Store Connect links.
- `--design` for the chosen implementation shape and `--acceptance` for the exact done criteria.

## Sync and Source of Truth

Beads state lives in Dolt. `.beads/issues.jsonl is an export, not the sync protocol`; do not build Cave features that read it as canonical state.

The committed `.beads/issues.jsonl` snapshot is only for review and CI guards. Keep it public-scrubbed before committing: no local git emails, no personal machine paths, no secrets, and no private agent transcript text. Use live `bd` output or Dolt sync for canonical state.

Use Dolt sync when a bead graph needs to move between machines:

```bash
bd dolt pull
bd dolt push
```

The package shortcuts are the stable entrypoints for familiars:

```bash
pnpm beads:prime
pnpm beads:ready
pnpm beads:doctor
pnpm beads:sync
```

## Cave Adapter

Cave exposes a local `/api/beads` adapter for UI surfaces. It shells out to `bd` through argv arrays and reads JSON from `bd ready --json`, `bd show <id> --json`, and mutation commands. Mutations stay local-only and must use bounded JSON bodies.

The first UI should be a Familiar Work Queue:

- Ready beads grouped by priority and blocker state.
- Owner, familiar label, surface label, branch/worktree, PR, and Linear link visible on each card.
- Claim, comment, and close actions mapped to the local adapter.
- Verification evidence shown before close, not hidden in a chat transcript.

## Guardrails

- No secrets in bead text. Store references to vault entries or environment setup notes instead.
- Do not use markdown TODO lists as the durable queue; create beads for follow-up work.
- Do not let Beads permission text override repository policy: Cave still uses PRs and protected `main`.
- Keep GitHub and Linear links in beads until the bridge is mature enough to synchronize automatically.
- Run `bd doctor` and `bd lint` before release handoff so stale, orphaned, or malformed beads are visible.
