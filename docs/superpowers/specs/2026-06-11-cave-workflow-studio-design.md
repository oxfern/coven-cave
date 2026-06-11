# Cave Workflow Studio Design

## Purpose

Build a dedicated Workflows page in Coven Cave that lets Val and other Coven users browse, attach, validate, dry-run, and eventually visually build CWF-01 workflows in an n8n-like manner. The page should feel like a Cave-native studio rather than a plain manifest list: graph canvas, node palette, inspector, manifest preview, attachment targets, and play controls all on one focused surface.

This spec follows the approved direction from June 11, 2026: **C is the north star, but PR 1 ships a grounded Studio foundation instead of the entire visual builder.**

## Goals

- Give Workflows a first-class Cave route and workspace surface.
- Render real CWF-01 workflow manifests as a readable graph of steps and edges.
- Support existing workflow actions: list, validate, dry-run, and guarded play shell.
- Let users see and prepare attachments to familiars, roles, boards, and projects.
- Keep Cave visual state separate from canonical workflow files.
- Bring forward the rich claw-dash visual language: dark operational canvas, ember accents, node palette, inspector panels, and run timeline.
- Preserve the manifest standard: no hidden Cave-only workflow behavior, no embedded arbitrary scripts, no secrets in manifests.

## Non-Goals For PR 1

- No full drag-to-create workflow authoring yet.
- No guaranteed persistence for attachment edits unless an existing API supports it cleanly.
- No scheduling grammar.
- No arbitrary embedded scripts.
- No live multi-agent telemetry stream unless the daemon already exposes it.
- No sidecar write endpoint unless it can be implemented and tested safely within the PR.

## Product Shape

The Workflows page becomes **Workflow Studio**. It should open directly to a real, usable work surface:

- **Workflow library:** discovered manifests from project and user workflow locations, with health state, source path, version, and tags.
- **Attach targets:** compact panel for familiars, roles, boards, and projects. PR 1 can stage or preview attachment intent if persistence is not available.
- **Node palette:** visible library of supported CWF-01 step kinds: `agent`, `skill`, `tool`, `human-gate`, and `workflow`.
- **Graph canvas:** n8n-like flow view of the selected workflow. PR 1 renders existing workflow steps; later PRs make the graph editable.
- **Inspector:** selected node details, including kind, `uses`, permissions, limits, on-error behavior, and validation status.
- **Manifest preview:** read-only canonical YAML/frontmatter preview derived from the selected workflow.
- **Run strip:** validate, dry-run, and play controls with a timeline/plan summary.

The visual hierarchy should make the graph the main object. The library and inspector are supporting tools, not separate dashboards.

## Recommended PR Slices

### PR 1: Workflow Studio Foundation

Ship the dedicated page and visual run surface.

- Add/upgrade the Workflows route to a full-height Studio layout.
- Render selected workflows as graph nodes and edges.
- Add library, palette, inspector, attachments panel, manifest preview, and run strip.
- Wire existing `listWorkflows`, `validateWorkflow`, and `dryRunWorkflow` flows into the Studio.
- Add a guarded Play button surface. If the daemon run endpoint is unavailable, the control must show a clear unavailable/preview state instead of pretending execution happened.
- Keep attachment controls visible, with save disabled or marked pending if no persistence API exists.
- Add tests for page mode routing, graph rendering from manifest steps, action wiring, disabled play behavior, and responsive layout markers.

### PR 2: Visual Builder Editing

Make the graph authoring surface real.

- Add step creation from palette.
- Allow selecting, editing, connecting, deleting, and reordering steps.
- Convert graph edits back into valid CWF-01 manifests.
- Add undo/redo and dirty-state protection.
- Persist Cave-only node positions to sidecar data.
- Validate before save and show schema/semantic/runtime-preflight errors inline.

### PR 3: Live Runs And History

Make workflow play feel alive.

- Stream run state from daemon execution.
- Highlight active, complete, failed, blocked, and human-gate steps on the graph.
- Preserve run history with artifacts, logs, outputs, and final result lineage.
- Link human gates to Cave review affordances and Board cards.

## Architecture

PR 1 should stay frontend-heavy and API-compatible with the workflow manifest surface already merged in PR #399.

Suggested units:

- `src/components/workflows-view.tsx`
  - Container for the Workflows workspace mode.
  - Owns selected workflow state, loading state, action state, and top-level layout.
- `src/components/workflows/workflow-studio.tsx`
  - Main Studio composition.
  - Receives workflows and action callbacks.
- `src/components/workflows/workflow-canvas.tsx`
  - Graph rendering for workflow steps.
  - Uses a proven graph UI library if added, preferably `@xyflow/react`, or a small static SVG/CSS graph renderer if PR 1 must avoid dependencies.
- `src/components/workflows/workflow-library.tsx`
  - Manifest list, filters, and health indicators.
- `src/components/workflows/workflow-inspector.tsx`
  - Selected workflow or selected step details.
- `src/components/workflows/workflow-attachments.tsx`
  - Familiar/role/board/project attachment UX.
- `src/components/workflows/workflow-run-strip.tsx`
  - Validate, dry-run, play shell, and plan summary.
- `src/components/workflows/workflow-manifest-preview.tsx`
  - Read-only manifest preview.
- `src/lib/workflow-graph.ts`
  - Pure helpers that map CWF-01 workflow data to graph nodes/edges.
- `src/styles/workflows.css`
  - Cave-native visual treatment for the Studio.

Keep pure graph conversion logic outside React so it can be tested without DOM complexity.

## Data Flow

1. Cave loads workflows through `GET /api/workflows`.
2. The selected workflow is normalized into graph nodes and edges.
3. The canvas renders the graph and reports selected node IDs.
4. The inspector reads selected node/workflow details from the normalized graph model.
5. Validate calls `POST /api/workflows/validate`.
6. Dry-run calls `POST /api/workflows/dry-run`.
7. Play is shown as a first-class control, but PR 1 must only execute if a real daemon endpoint exists and is wired. Otherwise it opens an explanatory guarded state.
8. Attachment controls read the selected workflow and target category. Persistence is disabled until a save API exists.

Canonical workflow data remains the manifest. Cave-only layout and display preferences belong in sidecars such as `WORKFLOW.cave.json`.

## Visual Direction

The page should borrow from claw-dash without copying its exact shell:

- Dark, operational, canvas-forward workspace.
- Ember/red action accents for play and hot paths.
- Blue for agents, green for skills/tools, gold for human gates, violet for nested workflows.
- Dense but readable panels with 8px-or-less radius.
- No marketing hero, no decorative blobs, no page-section cards.
- Use icons for run, validate, dry-run, attachments, palette, and manifest actions where Cave already has an icon system.
- Keep text compact. This page is for repeated work, not onboarding copy.
- On mobile, collapse to library selector, selected workflow summary, horizontal canvas preview, and bottom inspector/run tabs.

## Error Handling

- Daemon offline: keep the Studio visible and show workflow actions as unavailable with retry.
- Empty library: show a compact empty state with import/new workflow affordances, but keep the Studio structure visible.
- Invalid workflow: render available graph data when possible, mark invalid nodes, and show validator errors in the inspector.
- Dry-run failure: preserve the failed response and show error code/path/message/suggestion when available.
- Play unavailable: disable execution and explain which daemon endpoint is missing.
- Unsaved future edits: block navigation or selection changes with a dirty-state confirmation.

## Tracking In Cave

Create a Cave Board card for visibility:

- Title: `feat: Cave Workflow Studio`
- Status: `running`
- Priority: `high`
- Labels: `workflows`, `cave`, `studio`, `cwf-01`
- Notes should reference this spec path and the three-PR slice:
  - PR 1: Studio foundation
  - PR 2: Visual builder editing
  - PR 3: Live runs and history

When implementation starts, link the implementation plan and PR to that same card.

## Testing Strategy

PR 1 should include:

- Pure tests for workflow-to-graph conversion.
- Component/source tests that the Studio page includes library, palette, inspector, manifest preview, attachments, run strip, and graph canvas regions.
- Action wiring tests for validate and dry-run controls.
- Guard test for Play disabled/unavailable state when no run endpoint exists.
- Responsive/layout marker tests so the page remains usable on narrow screens.
- Typecheck before commit.

Later builder PRs need stronger interaction tests for adding nodes, editing fields, connecting steps, validating before save, sidecar layout writes, and dirty-state protection.

## Open Decisions For Implementation Plan

- Whether PR 1 adds `@xyflow/react` immediately or starts with a static graph renderer. Recommendation: use `@xyflow/react` if package compatibility with the current Next/React stack is clean; otherwise ship a focused static graph in PR 1 and add React Flow in PR 2.
- Whether the daemon has a workflow run endpoint by the time PR 1 starts. If not, Play remains a guarded shell.
- Which persistence endpoint will own workflow attachments. Until that exists, attachment UI is visible but non-destructive.
- Whether sidecar layout read/write lands in PR 1 or PR 2. Recommendation: PR 1 reads/derives layout; PR 2 writes sidecar layout with builder editing.

## Approval State

Approved direction from Valentina:

- Choose option C: Full Workflow Studio.
- Use the claw-dash-inspired visual style.
- Ship the work in visible, staged PRs rather than one oversized editor.
- Track the effort in Coven Cave for full visibility.
