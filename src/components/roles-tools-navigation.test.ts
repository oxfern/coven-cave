// @ts-nocheck
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sidebar = await readFile(new URL("./sidebar-minimal.tsx", import.meta.url), "utf8");
const workspace = await readFile(new URL("./workspace.tsx", import.meta.url), "utf8");
const settings = await readFile(new URL("./settings-shell.tsx", import.meta.url), "utf8");
const pluginsView = await readFile(new URL("./plugins-view.tsx", import.meta.url), "utf8");
const workspaceMode = await readFile(new URL("../lib/workspace-mode.ts", import.meta.url), "utf8");

assert.match(
  workspaceMode,
  /\|\s*"roles"/,
  "Roles should be a first-class workspace mode",
);

assert.match(
  sidebar,
  /\{ id: "roles", label: "Roles"[\s\S]*group: "tools"/,
  "Roles should appear in the main sidebar Tools group",
);

assert.match(
  workspace,
  /roles: "Roles"/,
  "Workspace surface labels should include Roles",
);

assert.match(
  workspace,
  /mode === "roles"[\s\S]*<PluginsView[\s\S]*tabs=\{\["roles", "workflows"\]\}/,
  "Workspace should render Roles and Workflows as a Tools surface",
);

assert.match(
  settings,
  /<PluginsView[\s\S]*tabs=\{\["plugins", "skills"\]\}/,
  "Settings Plugins should only expose marketplace plugins and skills",
);

assert.match(
  pluginsView,
  /tabs\?: Tab\[\]/,
  "PluginsView should support caller-selected tab sets",
);
