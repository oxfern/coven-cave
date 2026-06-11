// @ts-nocheck
// Chat responses must render as formatted markdown — including GFM tables
// with inline markdown inside cells — not as the plain-text fallback.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./message-bubble.tsx", import.meta.url), "utf8");

// StrictMode regression guard: a ref-based "same text" check poisons itself
// when the first (dev double-invoke) effect run is cancelled — run 2 then
// early-returns and the bubble is stuck on raw markdown forever.
assert.doesNotMatch(
  source,
  /lastTextRef/,
  "MarkdownContent must not gate the async markdown render on a same-text ref guard",
);

// @create-markdown/preview emits table cells as escaped plain text, so
// **bold**/`code`/[links] inside cells show literally unless each cell is
// re-rendered through the inline path.
assert.match(
  source,
  /async function renderTableBlock\(/,
  "Tables are rebuilt with per-cell inline markdown rendering",
);
assert.match(
  source,
  /async function renderInlineMd\(/,
  "Cell content renders through the inline (paragraph) markdown path",
);
assert.match(
  source,
  /text-align: \$\{alignments\[i\]\}/,
  "Rebuilt tables preserve GFM column alignments",
);
assert.match(
  source,
  /const tableRe = \/<table\[\^>\]\*>\[\\s\\S\]\*\?<\\\/table>\/g/,
  "Rendered tables substitute positionally for the renderer's own <table> output",
);

console.log("message-bubble-markdown.test.ts: ok");
