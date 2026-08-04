// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");

test("the frontend monitor is mounted only in development", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(
    layout,
    /process\.env\.NODE_ENV\s*===\s*"development"\s*\?\s*\(await import\("@\/components\/perf\/development-performance-tools"\)\)/,
  );
  assert.match(
    layout,
    /DevelopmentPerformanceTools\s*\?\s*<DevelopmentPerformanceTools \/>\s*:\s*null/,
  );
  assert.doesNotMatch(layout, /^import .*perf\//m, "production must not statically import monitor code");
});

test("the native command is absent from release command registries", () => {
  const lib = read("src-tauri/src/lib.rs");
  const setup = read("src-tauri/src/tauri_setup.rs");
  assert.match(lib, /#\[cfg\(debug_assertions\)\]\s*mod dev_performance;/);
  assert.equal(
    setup.match(/#\[cfg\(debug_assertions\)\]\s*dev_performance::dev_performance_snapshot/g)?.length,
    2,
    "desktop and mobile command registrations must both be debug-only",
  );
});

test("dismissal stops native polling and the render layer stays headless", () => {
  const overlay = read("src/components/perf/perf-overlay.tsx");
  assert.match(overlay, /enabled:\s*!dismissed\s*&&\s*nativeMetricsAvailable/);
  assert.doesNotMatch(overlay, /\buseEffect\s*\(/);
  assert.doesNotMatch(overlay, /onClick=\{\(\)\s*=>/);
});

console.log("perf-overlay-contract.test.ts: ok");
