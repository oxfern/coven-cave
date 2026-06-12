// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./csv-import-modal.tsx", import.meta.url), "utf8");

assert.match(
  source,
  /import \{ useEffect, useMemo, useState \} from "react";/,
  "CsvImportModal imports useMemo for render-stable parsed CSV data",
);

assert.match(
  source,
  /const parsed = useMemo\(\(\) => parseCsv\(raw\), \[raw\]\);/,
  "CsvImportModal memoizes parsed CSV data by raw content",
);

assert.doesNotMatch(
  source,
  /const parsed = parseCsv\(raw\);/,
  "CsvImportModal must not create a fresh headers array on every render",
);

console.log("csv-import-modal.test.ts: ok");
