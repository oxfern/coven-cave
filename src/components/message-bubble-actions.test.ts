// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bubble = readFileSync(new URL("./message-bubble.tsx", import.meta.url), "utf8");
const chatView = readFileSync(new URL("./chat-view.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles/cave-chat.css", import.meta.url), "utf8");

assert.match(
  bubble,
  /onDelete\?: \(\) => void/,
  "MessageBubble should accept a per-message delete callback",
);

assert.match(
  bubble,
  /const LONG_PRESS_MS = \d+/,
  "MessageBubble should use a named long-press delay for the hold menu",
);

assert.match(
  bubble,
  /aria-label="Copy message"/,
  "The hold action sheet should offer Copy message",
);

assert.match(
  bubble,
  /aria-label="Delete message"/,
  "The hold action sheet should keep Delete message as an option",
);

assert.match(
  bubble,
  /SWIPE_COPY_THRESHOLD_PX/,
  "Right swipe should have a named copy threshold",
);

assert.match(
  bubble,
  /SWIPE_DELETE_THRESHOLD_PX/,
  "Far-left swipe should have a named delete threshold",
);

assert.match(
  bubble,
  /setConfirmDelete\(true\)/,
  "Left swipe should arm delete confirmation rather than deleting immediately",
);

assert.match(
  bubble,
  /void copyMessage\(\)/,
  "Right swipe should copy the message text",
);

assert.match(
  css,
  /\.cave-bubble-swipe-action--copy/,
  "Swipe affordance should style the right-swipe Copy action",
);

assert.match(
  css,
  /\.cave-bubble-swipe-action--delete/,
  "Swipe affordance should style the far-left Delete action",
);

assert.match(
  chatView,
  /function deleteTurn\(turn: Turn\)/,
  "ChatView should own per-turn deletion",
);

assert.match(
  chatView,
  /method: "PUT"/,
  "Per-turn deletion should persist by replacing the stored conversation turns",
);

assert.match(
  chatView,
  /onDelete=\{!t\.pending \? \(\) => deleteTurn\(t\) : undefined\}/,
  "Rendered turns should pass delete handlers into MessageBubble",
);

console.log("message-bubble-actions.test.ts: ok");
