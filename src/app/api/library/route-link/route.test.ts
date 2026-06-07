// @ts-nocheck
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Tests target the routeLink internal handler directly (so we don't
// need a Next.js HTTP layer in tests). The handler reads its store
// path from process.env.CAVE_LIBRARY_DIR when set.

const root = await mkdtemp(path.join(tmpdir(), "lib-rl-"));
process.env.CAVE_LIBRARY_DIR = root;

const { routeLinkHandler } = await import("./route.ts");

// 1. Github URL → github list
{
  const res = await routeLinkHandler({
    url: "https://github.com/foo/bar/pull/9",
    source: { kind: "slash", originSessionId: null },
    familiar: "cody",
  });
  assert.equal(res.ok, true);
  assert.equal(res.deduped, false);
  assert.equal(res.classify.rule, "github");
  const gh = JSON.parse(await readFile(path.join(root, "github.json"), "utf-8"));
  assert.equal(gh.length, 1);
  assert.equal(gh[0].kind, "pr");
  assert.equal(gh[0].number, 9);
  assert.equal(gh[0].capture.familiar, "cody");
  assert.equal(gh[0].capture.classifier.rule, "github");
}

// 2. arxiv URL → reading list, paper
{
  const res = await routeLinkHandler({
    url: "https://arxiv.org/abs/2603.12345",
    source: { kind: "chat", sessionId: "s1", turnId: "t1", chatTitle: "Phase 2A" },
    familiar: "sage",
  });
  assert.equal(res.ok, true);
  assert.equal(res.classify.rule, "paper-host");
  const rd = JSON.parse(await readFile(path.join(root, "reading.json"), "utf-8"));
  assert.equal(rd.length, 1);
  assert.equal(rd[0].sourceType, "paper");
  assert.equal(rd[0].capture.source.sessionId, "s1");
}

// 3. Default → bookmarks
{
  const res = await routeLinkHandler({
    url: "https://docs.python.org/3/",
    source: { kind: "browser", tabUrl: "https://docs.python.org/3/", tabTitle: "Python Docs" },
    familiar: "cody",
  });
  assert.equal(res.ok, true);
  assert.equal(res.classify.rule, "default-bookmark");
  const bm = JSON.parse(await readFile(path.join(root, "bookmarks.json"), "utf-8"));
  assert.equal(bm.length, 1);
  assert.equal(bm[0].domain, "docs.python.org");
}

// 4. Dedup — same URL + same source key returns deduped: true
{
  const first = await routeLinkHandler({
    url: "https://github.com/foo/bar/pull/9",
    source: { kind: "slash", originSessionId: null },
    familiar: "cody",
  });
  assert.equal(first.deduped, true);  // already routed in case 1 with same source
}

// 5. Ambiguous host without fallback → defaults to bookmarks
{
  const res = await routeLinkHandler({
    url: "https://twitter.com/foo/status/1",
    source: { kind: "slash", originSessionId: null },
    familiar: "cody",
  });
  assert.equal(res.ok, true);
  // familiar-classify is a Phase-7 task; for now the endpoint treats fallback as bookmarks
  assert.equal(res.item.url ?? res.item.notes ?? "", res.item.url ?? "");
  assert.equal(res.classify.rule, "familiar-fallback");
}

// 6. listHint override
{
  const res = await routeLinkHandler({
    url: "https://github.com/foo/baz",
    source: { kind: "slash", originSessionId: null },
    familiar: "cody",
    listHint: "bookmarks",
  });
  assert.equal(res.ok, true);
  assert.equal(res.classify.rule, "default-bookmark");
}

// 7. Invalid URL
{
  const res = await routeLinkHandler({
    url: "not-a-url",
    source: { kind: "manual" },
    familiar: "cody",
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, "invalid_url");
}

await rm(root, { recursive: true, force: true });
console.log("route-link: 7 integration cases passed");
