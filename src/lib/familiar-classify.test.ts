// @ts-nocheck
import assert from "node:assert/strict";
import { classifyWithFamiliar } from "./familiar-classify.ts";

// Happy paths
{
  const res = await classifyWithFamiliar(
    "https://twitter.com/foo/status/1",
    { sourceText: "Worth reading: ..." },
    { id: "cody", display_name: "Cody" } as any,
    { ask: async () => "b" } as any,
  );
  assert.equal(res.list, "reading");
  assert.equal(res.rule, "familiar-fallback");
  assert.equal(res.confidence, "low");
}

{
  const res = await classifyWithFamiliar(
    "https://x.com/foo/profile",
    {},
    { id: "cody", display_name: "Cody" } as any,
    { ask: async () => "a" } as any,
  );
  assert.equal(res.list, "bookmarks");
}

// Garbage reply → bookmark
{
  const res = await classifyWithFamiliar(
    "https://reddit.com/x",
    {},
    { id: "cody", display_name: "Cody" } as any,
    { ask: async () => "I think it's a paper" } as any,
  );
  assert.equal(res.list, "bookmarks");
}

// Timeout → bookmark
{
  const res = await classifyWithFamiliar(
    "https://reddit.com/x",
    {},
    { id: "cody", display_name: "Cody" } as any,
    { ask: () => new Promise((resolve) => setTimeout(() => resolve("b"), 4000)) } as any,
  );
  assert.equal(res.list, "bookmarks");  // 3s budget elapsed
}

// 'c' for non-github URL → bookmark
{
  const res = await classifyWithFamiliar(
    "https://reddit.com/x",
    {},
    { id: "cody", display_name: "Cody" } as any,
    { ask: async () => "c" } as any,
  );
  assert.equal(res.list, "bookmarks");
}

console.log("familiar-classify: 5 cases passed");
