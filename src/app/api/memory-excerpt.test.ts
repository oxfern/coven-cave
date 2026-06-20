import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../../lib/server/memory-file-inventory.ts", import.meta.url), "utf8");
assert.match(source, /excerpt\?: string/, "MemoryEntry carries an excerpt");
assert.match(source, /readExcerpt/, "scan reads a body excerpt");
console.log("memory-excerpt.test: ok");
