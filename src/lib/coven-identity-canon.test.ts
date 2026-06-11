// @ts-nocheck
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const canon = await readFile(new URL("./coven-identity-canon.ts", import.meta.url), "utf8");
const chatRoute = await readFile(new URL("../app/api/chat/send/route.ts", import.meta.url), "utf8");
const salemContext = await readFile(new URL("../components/salem/salem-context.ts", import.meta.url), "utf8");
const salemRoute = await readFile(new URL("../app/api/salem/route.ts", import.meta.url), "utf8");

assert.match(canon, /Each familiar has a defined lane/, "canon must define per-familiar identity");
assert.match(canon, /IDENTITY\.md.*SOUL\.md|SOUL\.md.*IDENTITY\.md/, "canon must reference identity files");
assert.match(canon, /buildPromptWithCovenIdentityCanon/, "canon helper must wrap prompts");

assert.match(
  chatRoute,
  /buildPromptWithCovenIdentityCanon\([\s\S]*body\.familiarId[\s\S]*\)/,
  "Cave chat prompts must inject Coven identity canon for every familiar",
);

assert.match(
  salemContext,
  /courtCanon|identityCanon|COVEN_IDENTITY_CANON/,
  "Salem preload context must expose the identity canon",
);
assert.match(
  salemRoute,
  /COVEN_IDENTITY_CANON/,
  "Salem route must use the shared Coven identity canon",
);

console.log("coven-identity-canon.test.ts: ok");
