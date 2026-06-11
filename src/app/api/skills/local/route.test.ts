// @ts-nocheck
// The Skills tab must list every locally installed skill: coven-global,
// per-familiar, AND the user's own Claude Code skills — including skill
// folders that are symlinks (dotfiles repos, plugin managers).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

assert.match(
  source,
  /scanSkillsDir\(path\.join\(homedir\(\), "\.claude", "skills"\), "user", skills\)/,
  "User-level Claude skills (~/.claude/skills) are scanned and labeled \"user\"",
);

assert.match(
  source,
  /e\.isDirectory\(\) \|\| e\.isSymbolicLink\(\)/,
  "Symlinked skill folders must not be skipped — isDirectory() is false for symlinks",
);

console.log("skills/local route.test.ts: ok");
