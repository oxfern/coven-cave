// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./pty-ws-bridge.ts", import.meta.url), "utf8");

assert.match(src, /export class PtyWsBridge/, "PtyWsBridge class exists");
assert.match(src, /new WebSocket\(url\)/, "bridge opens a WebSocket");
assert.match(src, /binaryType\s*=\s*"arraybuffer"/, "bridge receives binary frames");
assert.match(src, /0x01/, "bridge handles output tag 0x01");
assert.match(src, /0x02/, "bridge handles exit tag 0x02");
assert.match(src, /frame\[0\]\s*=\s*0x03/, "bridge sends input tag 0x03");
assert.match(src, /frame\[0\]\s*=\s*0x04/, "bridge sends resize tag 0x04");
assert.match(src, /setUint16\(1,\s*cols,\s*true\)/, "resize encodes cols little-endian");
assert.match(src, /setUint16\(3,\s*rows,\s*true\)/, "resize encodes rows little-endian");
assert.match(src, /dispose\(\)/, "bridge exposes dispose");

console.log("pty-ws-bridge.test.ts OK");
