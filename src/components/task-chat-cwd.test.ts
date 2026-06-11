// @ts-nocheck
// Chats can specify or update a working directory, and task chats run in the
// CWD tied to the task — prompting (optionally) for one when the card has none.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chatView = readFileSync(new URL("./chat-view.tsx", import.meta.url), "utf8");
const boardView = readFileSync(new URL("./board-view.tsx", import.meta.url), "utf8");
const taskChatRoute = readFileSync(
  new URL("../app/api/board/[id]/chat/route.ts", import.meta.url),
  "utf8",
);

// ── Chat: user-specified CWD ─────────────────────────────────────────────────

assert.match(
  chatView,
  /const \[cwdRootDraft, setCwdRootDraft\] = useState\(session\?\.project_root \?\? projectRoot \?\? ""\)/,
  "ChatView seeds the editable ROOT from the opened session or pending project root",
);
assert.match(
  chatView,
  /const \[cwdDraft, setCwdDraft\] = useState\(""\)/,
  "ChatView keeps the CWD override separate so relative paths can resolve under ROOT",
);
assert.match(
  chatView,
  /resolveRootedCwd\(cwdDraft, cwdRootDraft, projectRoot\)/,
  "ChatView resolves relative CWD values against the editable ROOT before sending",
);
assert.match(
  chatView,
  /\.\.\.\(effectiveProjectRoot \? \{ projectRoot: effectiveProjectRoot \} : \{\}\)/,
  "Every send includes the edited CWD when present, even for existing sessions",
);
assert.match(
  chatView,
  /onCwdChange=\{setCwdDraft\}/,
  "The CWD field remains editable after the session exists",
);
assert.match(
  chatView,
  /function InlineCwdField[\s\S]*aria-label="Working directory for this chat"/,
  "Active chats expose a compact CWD editor in the header",
);
assert.match(
  chatView,
  /sessionId && \(\s*<>\s*<InlineCwdField[\s\S]*root=\{cwdRootDraft\}[\s\S]*onRootChange=\{setCwdRootDraft\}[\s\S]*cwd=\{cwdDraft\}[\s\S]*onCwdChange=\{setCwdDraft\}/,
  "The active-chat ROOT and CWD editors share the same drafts used by send",
);
assert.match(
  chatView,
  /aria-label="Working directory for this chat"/,
  "Empty state exposes a labeled working-directory input",
);
assert.match(
  chatView,
  /aria-label="Root directory for relative CWD"/,
  "ChatView exposes an editable ROOT for resolving short relative CWD values",
);

// ── Task chat: card CWD wins; optional prompt when absent ───────────────────

assert.match(
  taskChatRoute,
  /card\.cwd \?\? body\.projectRoot \?\? process\.cwd\(\)/,
  "Task chat sessions start in the card's CWD when it has one",
);
assert.match(
  taskChatRoute,
  /!card\.cwd && body\.projectRoot \? \{ cwd: body\.projectRoot \}/,
  "A start-time CWD is persisted onto the card",
);
assert.match(
  boardView,
  /if \(card && !card\.sessionId && !card\.cwd\) \{\s*\n\s*setCwdPromptCardId\(id\);/,
  "Starting a task chat for a CWD-less card prompts instead of POSTing immediately",
);
assert.match(
  boardView,
  /Skip[\s\S]*?Set &amp; start/,
  "The prompt is optional — Skip starts without a CWD, Set & start uses the typed one",
);
assert.match(
  boardView,
  /onStart\(trimmed \? trimmed : undefined\)/,
  "Submitting an empty path behaves like Skip",
);

console.log("task-chat-cwd.test.ts: ok");
