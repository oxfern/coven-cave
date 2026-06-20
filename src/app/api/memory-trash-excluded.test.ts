import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("./memory/route.ts", import.meta.url), "utf8");
const inventory = await readFile(
  new URL("../../lib/server/memory-file-inventory.ts", import.meta.url),
  "utf8",
);
assert.match(source, /listMemoryFileEntries/, "memory route should delegate to shared inventory");
assert.match(inventory, /startsWith\("\."\)/, "memory scan must skip dot-directories (hides .cave-trash)");
console.log("memory-trash-excluded.test: ok");
