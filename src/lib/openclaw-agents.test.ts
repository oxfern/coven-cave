// @ts-nocheck
import assert from "node:assert/strict";
import { summarizeOpenClawAgent } from "./openclaw-agents.ts";

assert.deepEqual(
  summarizeOpenClawAgent(
    "research-lane",
    `# IDENTITY.md - Who Am I?

- **Name:** Riley
- **Creature:** Research Familiar
- **Vibe:** careful and evidence-led
`,
    "/Users/example/.openclaw/workspace/research-lane",
  ),
  {
    id: "research-lane",
    displayName: "Riley",
    role: "Research Familiar",
    workspacePath: "/Users/example/.openclaw/workspace/research-lane",
  },
);

assert.deepEqual(summarizeOpenClawAgent("coven-code", null, null), {
  id: "coven-code",
  displayName: "Coven Code",
  role: "OpenClaw agent",
  workspacePath: null,
});
