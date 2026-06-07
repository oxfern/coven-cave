import type { ClassifyResult } from "./link-classifier.ts";
import { parseGitHubUrl } from "./link-classifier.ts";
import type { Familiar } from "./types.ts";

export type HarnessAsker = { ask: (prompt: string) => Promise<string> };

const TIMEOUT_MS = 3000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.then((v) => v),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]) as Promise<T | null>;
}

function buildPrompt(url: string, ctx: { sourceText?: string; pageTitle?: string }): string {
  const context = ctx.sourceText?.slice(0, 200) ?? ctx.pageTitle ?? "(no context)";
  return `Given URL ${url} and the surrounding context ${JSON.stringify(context)}, classify as one of:
(a) bookmark — a tool, landing page, or reference site
(b) reading — an article, paper, thread, or video meant to be consumed
(c) github — a github.com URL
Reply with one letter only.`;
}

function fallbackBookmark(): ClassifyResult {
  return { list: "bookmarks", rule: "familiar-fallback", confidence: "low" };
}

export async function classifyWithFamiliar(
  url: string,
  ctx: { sourceText?: string; pageTitle?: string },
  _familiar: Familiar,
  asker: HarnessAsker,
): Promise<ClassifyResult> {
  let raw: string | null;
  try { raw = await withTimeout(asker.ask(buildPrompt(url, ctx)), TIMEOUT_MS); }
  catch { return fallbackBookmark(); }
  if (!raw) return fallbackBookmark();

  const letter = raw.trim().slice(0, 1).toLowerCase();
  if (letter === "a") return { list: "bookmarks", rule: "familiar-fallback", confidence: "low" };
  if (letter === "b") return { list: "reading", readingKind: "article", rule: "familiar-fallback", confidence: "low" };
  if (letter === "c") {
    if (parseGitHubUrl(url)) return { list: "github", rule: "familiar-fallback", confidence: "low" };
    return fallbackBookmark();
  }
  return fallbackBookmark();
}
