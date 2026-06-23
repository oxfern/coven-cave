// @ts-nocheck
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const helper = await readFile(
  new URL("../../lib/server/project-permission-requests.ts", import.meta.url),
  "utf8",
);
const projectFile = await readFile(new URL("./project-file/route.ts", import.meta.url), "utf8");
const projectTree = await readFile(new URL("./project-tree/route.ts", import.meta.url), "utf8");
const projectFiles = await readFile(new URL("./project/files/route.ts", import.meta.url), "utf8");
const projectSearch = await readFile(new URL("./project/search/route.ts", import.meta.url), "utf8");
const projectTreeClient = await readFile(
  new URL("../../components/project-tree.tsx", import.meta.url),
  "utf8",
);
const comuxView = await readFile(new URL("../../components/comux-view.tsx", import.meta.url), "utf8");
const chatView = await readFile(new URL("../../components/chat-view.tsx", import.meta.url), "utf8");
const codeQuickOpen = await readFile(
  new URL("../../components/code-quick-open.tsx", import.meta.url),
  "utf8",
);

assert.match(
  helper,
  /import \{[\s\S]*ProjectAccessDeniedError,[\s\S]*assertProjectAccess,[\s\S]*\} from "@\/lib\/project-permissions";/,
  "project API request helper should use the shared project-permission chokepoint",
);
assert.match(
  helper,
  /export async function assertProjectApiAccess\([\s\S]*familiarId[\s\S]*projectRootForPath[\s\S]*await assertProjectAccess\(\{ familiarId \}, project\.id, surface\)/,
  "project API request helper should resolve a registered project from the requested path/root and assert access",
);
assert.match(
  helper,
  /ProjectAccessDeniedError\("missing familiarId for project access"\)/,
  "project API request helper should fail closed when no familiarId is supplied",
);

for (const [name, source] of [
  ["project-file", projectFile],
  ["project-tree", projectTree],
  ["project/files", projectFiles],
  ["project/search", projectSearch],
] as const) {
  assert.match(
    source,
    /assertProjectApiAccess/,
    `${name} route should call the shared project API permission helper before project filesystem work`,
  );
}

assert.match(projectFile, /surface: "file-read"/, "project-file GET should audit file reads");
assert.match(projectFile, /surface: "file-write"/, "project-file POST should audit file writes");
assert.match(projectTree, /surface: "file-browse"/, "project-tree GET should audit browsing");
assert.match(projectTree, /surface: "file-write"/, "project-tree POST moves should audit writes");
assert.match(projectFiles, /surface: "project-api"/, "project files index should audit project API access");
assert.match(projectSearch, /surface: "project-api"/, "project search should audit project API access");

assert.match(
  projectTreeClient,
  /familiarId\?: string/,
  "ProjectTree should accept familiarId so browse and move calls can be scoped",
);
assert.match(
  projectTreeClient,
  /new URLSearchParams\(\{ root: dirPath, depth: "1", familiarId \}\)/,
  "ProjectTree fetches should include familiarId",
);
assert.match(
  projectTreeClient,
  /JSON\.stringify\(\{ from, toDir, familiarId \}\)/,
  "ProjectTree move requests should include familiarId",
);
assert.match(
  comuxView,
  /const selectedProjectFamiliarId = useMemo\([\s\S]*selectedProjectSessions\[0\]\?\.familiarId/,
  "Comux project view should derive a familiar for project-scoped API calls",
);
assert.match(
  comuxView,
  /familiarId: selectedProjectFamiliarId/,
  "Comux file preview, save, tree, and search calls should pass familiarId",
);
assert.match(
  chatView,
  /new URLSearchParams\(\{ root: mentionRoot, familiarId: familiar\.id \}\)/,
  "chat mention file index should pass the active familiarId",
);
assert.match(
  codeQuickOpen,
  /new URLSearchParams\(\{ root, familiarId \}\)/,
  "code quick open should pass familiarId to the file index",
);

console.log("project-permission-routes.test.ts: ok");
