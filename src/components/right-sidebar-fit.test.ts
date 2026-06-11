// @ts-nocheck
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const chatSurface = await readFile(new URL("./chat-surface.tsx", import.meta.url), "utf8");
const globals = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

assert.match(
  chatSurface,
  /Panel[\s\S]*id="right-sidebar"[\s\S]*defaultSize="32%"/,
  "ChatSurface right sidebar should use a resizable panel with a wider default fit",
);

assert.match(
  chatSurface,
  /Separator\s+className="[^"]*shell-separator[^"]*"/,
  "ChatSurface right sidebar should render a resize separator before the panel",
);

assert.doesNotMatch(
  chatSurface,
  /w-\[320px\]\s+shrink-0/,
  "ChatSurface right sidebar should not be a fixed 320px non-resizable aside",
);

assert.match(
  globals,
  /\.right-panel-tabs[\s\S]*min-width:\s*0/,
  "Right panel tab bar should be allowed to shrink inside narrow sidebar widths",
);

assert.match(
  globals,
  /\.right-panel-tab[\s\S]*min-width:\s*0[\s\S]*overflow:\s*hidden[\s\S]*text-overflow:\s*ellipsis/,
  "Right panel tabs should truncate instead of overflowing the sidebar",
);

console.log("right-sidebar-fit.test.ts OK");
