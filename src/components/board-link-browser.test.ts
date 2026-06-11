// @ts-nocheck
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspace = await readFile(new URL("./workspace.tsx", import.meta.url), "utf8");
const boardView = await readFile(new URL("./board-view.tsx", import.meta.url), "utf8");
const boardInspector = await readFile(new URL("./board-inspector.tsx", import.meta.url), "utf8");

assert.match(
  workspace,
  /<BoardView[\s\S]*onOpenUrl=\{\(url\) => \{[\s\S]*setMode\("browser"\)[\s\S]*browserPaneRef\.current\?\.navigateTo\(url\)/,
  "Workspace should route board task links into the embedded BrowserPane",
);

assert.match(
  boardView,
  /export function BoardView\(\{[\s\S]*onOpenUrl[\s\S]*\}: Props\)/,
  "BoardView should accept an embedded-browser URL opener",
);

assert.match(
  boardView,
  /<BoardInspector[\s\S]*onOpenUrl=\{onOpenUrl\}/,
  "BoardView should pass URL opening into the task inspector",
);

assert.match(
  boardInspector,
  /function LinksSection\(\{[\s\S]*onOpenUrl[\s\S]*\}: \{[\s\S]*onOpenUrl\?: \(url: string\) => void/,
  "Task inspector links should receive an in-app URL opener",
);

assert.match(
  boardInspector,
  /type="button"[\s\S]*onClick=\{\(\) => onOpenUrl\?\.\(href\)\}[\s\S]*className="link-item-anchor"/,
  "Clicking a task link should open it through the in-app browser callback",
);

assert.match(
  boardInspector,
  /function GitHubAttachSection\(\{[\s\S]*onOpenUrl[\s\S]*\}: \{[\s\S]*onOpenUrl\?: \(url: string\) => void/,
  "Attached GitHub rows should receive an in-app URL opener",
);

assert.match(
  boardInspector,
  /className="board-github-attachment-open"[\s\S]*onClick=\{\(\) => onOpenUrl\?\.\(item\.url\)\}/,
  "Clicking an attached GitHub relation should open it through the in-app browser callback",
);

assert.doesNotMatch(
  boardInspector,
  /className="link-item-anchor"[\s\S]{0,220}target="_blank"/,
  "Task link clicks should not bypass the app with a new external tab",
);

console.log("board-link-browser.test.ts: ok");
