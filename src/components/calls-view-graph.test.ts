// @ts-nocheck
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./calls-view.tsx", import.meta.url), "utf8");

assert.match(
  source,
  /<g key=\{`\$\{edge\.caller\}->\$\{edge\.callee\}->\$\{edge\.source\}`\}/,
  "Call graph edges should use a stable caller->callee key instead of the array index",
);

assert.match(
  source,
  /useEffect\(\(\) => \{\s*setTooltip\(null\);\s*\}, \[graph\.edges, nodeStats\]\);/,
  "Call graph should clear hover tooltip state when live call data refreshes",
);

assert.match(
  source,
  /buildDelegationGraph\(\{/,
  "Calls view should build a provenance-aware graph model instead of rendering raw aggregate edges",
);

assert.match(
  source,
  /Include inferred/,
  "Delegations graph should expose an Include inferred control",
);

assert.match(
  source,
  /data-edge-source=\{edge\.source\}/,
  "Graph edges should mark explicit, inferred, or mixed provenance in the DOM",
);
