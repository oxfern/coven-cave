// @ts-nocheck
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const list = await readFile(new URL("./library-doc-list.tsx", import.meta.url), "utf8");
const view = await readFile(new URL("./library-view.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../styles/library.css", import.meta.url), "utf8");

assert.match(
  list,
  /collections\?: LibraryCollection\[\]/,
  "LibraryDocList should receive collections so files can move between folders",
);
assert.match(
  list,
  /onRenameMove\?: \(doc: LibraryDoc, patch: \{ title\?: string; collection\?: string \}\) => Promise<void>/,
  "LibraryDocList should expose a rename/move callback",
);
assert.match(
  list,
  /aria-label=\{`Rename \$\{doc\.title\}`\}/,
  "Each library file row should expose a rename action",
);
assert.match(
  list,
  /aria-label=\{`Move \$\{doc\.title\}`\}/,
  "Each library file row should expose a move selector",
);
assert.match(
  view,
  /fetch\("\/api\/library\/doc",\s*\{[\s\S]*?method:\s*"PATCH"[\s\S]*?JSON\.stringify\(\{ id: doc\.id, title: patch\.title, collection: patch\.collection \}\)/,
  "LibraryView should persist file rename/move through the document API",
);
assert.match(
  css,
  /\.library-doclist-item-actions\s*\{[\s\S]*?display:\s*flex/,
  "Library file actions should have dedicated row styling",
);

console.log("library-file-actions.test.ts: ok");
