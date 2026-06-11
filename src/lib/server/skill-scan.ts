import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";

/**
 * Shared SKILL.md directory scanner. Used by /api/skills/local (coven-global,
 * per-familiar, and user skills) and /api/capabilities (supplementing harness
 * manifests when the daemon's own scan misses locally-installed skills).
 */

export type LocalSkillEntry = {
  id: string;
  name: string;
  description?: string;
  version?: string;
  kind?: string;
  tags?: string[];
  path: string;
  familiar: string;   // "global" for shared workspace skills, "user" for ~/.claude
};

function parseFrontmatter(text: string): Record<string, string> {
  const fm: Record<string, string> = {};
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return fm;
  for (const line of match[1].split("\n")) {
    const m = line.match(/^(\w[\w-]*):\s+"?([^"]*)"?\s*$/);
    if (m) fm[m[1]] = m[2];
  }
  return fm;
}

function parseListField(text: string, field: string): string[] {
  const match = text.match(new RegExp(`\\n${field}:\\s*\\n((?:\\s*-[^\\n]*\\n?)*)`));
  if (!match) return [];
  return match[1].match(/- (.+)/g)?.map(m => m.slice(2).trim()) ?? [];
}

export async function scanSkillsDir(dir: string, familiar: string, out: LocalSkillEntry[]): Promise<void> {
  let entries: string[] = [];
  try {
    const dirents = await readdir(dir, { withFileTypes: true });
    // Skill folders are often symlinks (dotfiles repos, plugin managers) —
    // isDirectory() is false for those, so accept symlinks too; the SKILL.md
    // stat below (which follows links) validates each candidate anyway.
    entries = dirents.filter(e => e.isDirectory() || e.isSymbolicLink()).map(e => e.name);
  } catch { return; }

  for (const skillName of entries) {
    const skillMdPath = path.join(dir, skillName, "SKILL.md");
    try {
      await stat(skillMdPath);
      const text = await readFile(skillMdPath, "utf8");
      const fm = parseFrontmatter(text);
      const tags = parseListField(text, "tags");
      out.push({
        id: skillName,
        name: fm.name ?? skillName,
        description: fm.description,
        version: fm.version,
        kind: fm.kind,
        tags: tags.length ? tags : (fm.tags ? [fm.tags] : []),
        path: skillMdPath,
        familiar,
      });
    } catch { continue; }
  }
}

/** The user's own Claude Code skills (~/.claude/skills). */
export async function scanClaudeUserSkills(): Promise<LocalSkillEntry[]> {
  const out: LocalSkillEntry[] = [];
  await scanSkillsDir(path.join(homedir(), ".claude", "skills"), "user", out);
  return out;
}
