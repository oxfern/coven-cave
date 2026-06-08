// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./familiar-studio-lifecycle-tab.tsx", import.meta.url),
  "utf8",
);

assert.match(source, /export function FamiliarStudioLifecycleTab/);
assert.match(source, /archiveFamiliar/);
assert.match(source, /unarchiveFamiliar/);
assert.match(source, /clearAllFamiliarOverrides/);
assert.match(source, /clearGlyphOverride/);
assert.match(source, /clearFamiliarImage/);
assert.match(source, /listView/);
assert.match(source, /setFamiliarOrder/, "List view must call setFamiliarOrder on move");
assert.match(source, /canMoveUp/, "Rows expose canMoveUp prop for disabled-edge state");
assert.match(source, /canMoveDown/, "Rows expose canMoveDown prop for disabled-edge state");
assert.match(source, /ph:arrow-up-bold/, "Move-up icon is wired");
assert.match(source, /ph:arrow-down-bold/, "Move-down icon is wired");

console.log("familiar-studio-lifecycle-tab.test.ts: ok");
