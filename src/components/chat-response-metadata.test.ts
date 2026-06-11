// @ts-nocheck
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const chatRoute = await readFile(new URL("../app/api/chat/send/route.ts", import.meta.url), "utf8");
const chatView = await readFile(new URL("./chat-view.tsx", import.meta.url), "utf8");
const conversations = await readFile(new URL("../lib/cave-conversations.ts", import.meta.url), "utf8");
const sessionMerge = await readFile(new URL("../lib/session-list-merge.ts", import.meta.url), "utf8");
const types = await readFile(new URL("../lib/types.ts", import.meta.url), "utf8");

assert.match(
  chatRoute,
  /type StreamEvent =[\s\S]*kind: "done";[\s\S]*responseMetadata\?: ChatResponseMetadata/,
  "Chat send done events should carry explicit response metadata",
);

assert.match(
  chatRoute,
  /const responseMetadata: ChatResponseMetadata = \{[\s\S]*familiarId: body\.familiarId,[\s\S]*harness: binding\.harness,[\s\S]*model: binding\.model,[\s\S]*runtime:/,
  "Coven harness responses should derive metadata from the actual binding and runtime",
);

assert.match(
  chatRoute,
  /kind: "done",[\s\S]*responseMetadata,/,
  "Final done events should include response metadata in the SSE payload",
);

assert.match(
  chatRoute,
  /const assistantTurn: ChatTurn = \{[\s\S]*responseMetadata,/,
  "Persisted assistant turns should store the response metadata that produced them",
);

assert.match(
  chatRoute,
  /model: responseMetadata\.model,[\s\S]*runtime: responseMetadata\.runtime,/,
  "Saved conversations should keep session-level model and runtime metadata",
);

assert.match(
  chatRoute,
  /openClawChatResponse\(\{[\s\S]*model: binding\.model/,
  "OpenClaw bridge responses should receive the familiar model for response metadata",
);

assert.match(
  chatView,
  /type StreamEvent =[\s\S]*kind: "done";[\s\S]*responseMetadata\?: ChatResponseMetadata/,
  "ChatView should accept response metadata from done events",
);

assert.match(
  chatView,
  /responseMetadata\?: ChatResponseMetadata/,
  "Chat turns should carry response metadata for per-response display",
);

assert.match(
  chatView,
  /case "done":[\s\S]*responseMetadata: ev\.responseMetadata,/,
  "Done handling should store response metadata on the settled assistant turn",
);

assert.match(
  chatView,
  /durationMs: t\.durationMs,[\s\S]*responseMetadata: t\.responseMetadata,/,
  "History loading should restore persisted response metadata",
);

assert.match(
  chatView,
  /modelLabel\(args\.model\)[\s\S]*runtimeLabel\(args\.runtime\)/,
  "Chat session metadata should label model and runtime clearly in the header",
);

assert.match(
  chatView,
  /<ResponseMetadataText metadata=\{turn\.responseMetadata\} \/>/,
  "Assistant turn rows should show the model/runtime metadata for each response",
);

assert.match(
  conversations,
  /model\?: string;[\s\S]*runtime\?: string;/,
  "Conversation files should persist session-level model and runtime metadata",
);

assert.match(
  conversations,
  /responseMetadata\?: ChatResponseMetadata/,
  "Conversation turns should persist response metadata",
);

assert.match(
  sessionMerge,
  /\.\.\.\(conv\.model \? \{ model: conv\.model \} : \{\}\),[\s\S]*\.\.\.\(conv\.runtime \? \{ runtime: conv\.runtime \} : \{\}\),/,
  "Local conversation session rows should expose saved model and runtime",
);

assert.match(
  types,
  /model\?: string \| null;[\s\S]*runtime\?: string \| null;/,
  "Session rows should carry optional model/runtime metadata",
);

console.log("chat-response-metadata.test.ts: ok");
