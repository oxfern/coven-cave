// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./chat-list.tsx", import.meta.url), "utf8");

assert.doesNotMatch(
  source,
  /busyTuiId|openInTui|tui\s*→|Open in Coven Code TUI/,
  "ChatList should replace the old TUI row action with deletion",
);

assert.match(
  source,
  /const \[confirmDeleteId, setConfirmDeleteId\] = useState<string \| null>\(null\)/,
  "ChatList should keep an explicit per-row delete confirmation state",
);

assert.match(
  source,
  /fetch\(`\/api\/chat\/conversation\/\$\{encodeURIComponent\(sessionId\)\}`,[\s\S]*method: "DELETE"/,
  "ChatList should delete through the conversation endpoint for the selected session",
);

assert.match(
  source,
  /onSessionsChanged\?\.\(\)/,
  "ChatList should ask the shell to refresh sessions after deleting a chat",
);

assert.match(
  source,
  /<Icon name="ph:trash"/,
  "ChatList delete action should use the trash icon",
);

console.log("chat-list-delete.test.ts: ok");
