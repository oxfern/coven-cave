// @ts-nocheck
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sidebar = await readFile(new URL("./sidebar-minimal.tsx", import.meta.url), "utf8");
const workspace = await readFile(new URL("./workspace.tsx", import.meta.url), "utf8");
const daemonBar = await readFile(new URL("./daemon-bar.tsx", import.meta.url), "utf8");
const comuxView = await readFile(new URL("./comux-view.tsx", import.meta.url), "utf8");

assert.match(
  sidebar,
  /\{ id: "chats",\s+label: "Chat"/,
  "Sidebar should expose Chat as a first-class destination",
);

assert.match(
  sidebar,
  /\{ id: "terminal",\s+label: "Terminal"/,
  "Sidebar should expose Terminal as a first-class destination",
);

assert.match(
  sidebar,
  /\{ id: "projects",\s+label: "Projects"/,
  "Sidebar should expose Projects as a first-class destination",
);

assert.doesNotMatch(
  sidebar,
  /label: "Coven Code"/,
  "Sidebar should not collapse Terminal and Projects behind Coven Code",
);

assert.doesNotMatch(
  sidebar,
  /sidebar-familiar-list|familiars\.map/,
  "Sidebar should not render familiar/agent rows",
);

assert.match(
  daemonBar,
  /terminal: "Terminal"/,
  "Top bar should label Terminal mode",
);

assert.match(
  daemonBar,
  /projects: "Projects"/,
  "Top bar should label Projects mode",
);

assert.match(
  workspace,
  /mode === "terminal"[\s\S]*<ComuxView[\s\S]*view="terminal"/,
  "Workspace should route Terminal to ComuxView terminal mode",
);

assert.match(
  workspace,
  /mode === "projects"[\s\S]*<ComuxView[\s\S]*view="projects"/,
  "Workspace should route Projects to ComuxView projects mode",
);

assert.match(
  comuxView,
  /type ComuxViewMode = "terminal" \| "projects"/,
  "ComuxView should have explicit Terminal and Projects modes",
);
