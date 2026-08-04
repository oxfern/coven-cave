// @ts-nocheck
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatMemoryUsage,
  formatPercent,
  formatPowerImpact,
  performanceTone,
} from "./system-performance-format.ts";

test("formats CPU and binary memory readings compactly", () => {
  assert.equal(formatPercent(4.24), "4.2%");
  assert.equal(formatPercent(84.9), "85%");
  assert.equal(formatMemoryUsage(512 * 1024 ** 2, 16 * 1024 ** 3), "512 MiB / 16.0 GiB");
});

test("classifies resource pressure and power impact", () => {
  assert.equal(performanceTone(49.9), "good");
  assert.equal(performanceTone(50), "needs-improvement");
  assert.equal(performanceTone(80), "poor");
  assert.equal(formatPowerImpact(4.9), "Idle");
  assert.equal(formatPowerImpact(24.9), "Low");
  assert.equal(formatPowerImpact(59.9), "Moderate");
  assert.equal(formatPowerImpact(60), "High");
});

test("invalid readings render as unavailable", () => {
  assert.equal(formatPercent(Number.NaN), "—");
  assert.equal(formatMemoryUsage(-1, 100), "—");
  assert.equal(formatPowerImpact(Number.POSITIVE_INFINITY), "—");
  assert.equal(performanceTone(Number.NaN), "unknown");
});

console.log("system-performance-format.test.ts: ok");
