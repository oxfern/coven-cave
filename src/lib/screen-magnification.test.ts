import assert from "node:assert/strict";
import {
  DEFAULT_SCREEN_SCALE,
  SCREEN_SCALE_OPTIONS,
  normalizeScreenScale,
  stepScreenScale,
} from "./screen-magnification.ts";

assert.deepEqual(
  SCREEN_SCALE_OPTIONS,
  [100, 110, 125, 150],
  "Screen magnification should expose the expected scale ladder",
);

assert.equal(normalizeScreenScale("125"), 125);
assert.equal(normalizeScreenScale(150), 150);
assert.equal(normalizeScreenScale("999"), DEFAULT_SCREEN_SCALE);
assert.equal(normalizeScreenScale("nope"), DEFAULT_SCREEN_SCALE);

assert.equal(stepScreenScale(100, 1), 110);
assert.equal(stepScreenScale(110, 1), 125);
assert.equal(stepScreenScale(150, 1), 150);
assert.equal(stepScreenScale(125, -1), 110);
assert.equal(stepScreenScale(100, -1), 100);

console.log("screen-magnification.test.ts OK");
