// @ts-nocheck
// The Skills tab must list every locally installed skill: coven-global,
// per-familiar, AND the user's own Claude Code skills — including skill
// folders that are symlinks (dotfiles repos, plugin managers).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
const scan = readFileSync(new URL("../../../../lib/server/skill-scan.ts", import.meta.url), "utf8");

assert.match(
  route,
  /scanClaudeUserSkills\(\)/,
  "User-level Claude skills (~/.claude/skills) are included in the local skills listing",
);

assert.match(
  scan,
  /path\.join\(homedir\(\), "\.claude", "skills"\), "user"/,
  "scanClaudeUserSkills scans ~/.claude/skills and labels entries \"user\"",
);

assert.match(
  scan,
  /e\.isDirectory\(\) \|\| e\.isSymbolicLink\(\)/,
  "Symlinked skill folders must not be skipped — isDirectory() is false for symlinks",
);

console.log("skills/local route.test.ts: ok");
