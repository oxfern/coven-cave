// @ts-nocheck
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const floor = await readFile(new URL("./coven-floor.tsx", import.meta.url), "utf8");

assert.match(
  floor,
  /<table className="board-table floor-table"/,
  "CovenFloor should render as one data table, reusing the task table pattern",
);

assert.match(
  floor,
  /floor-familiar-row/,
  "CovenFloor should render each familiar as a primary table row",
);

assert.match(
  floor,
  /floor-session-row/,
  "CovenFloor should render expanded session traceability as sub-category table rows",
);

assert.match(
  floor,
  /aria-expanded=\{expandedId === card\.id\}/,
  "Familiar rows should expose expandable session traceability state",
);

assert.match(
  floor,
  /colSpan=\{6\}/,
  "Session traceability rows should span the full familiar table width",
);

assert.doesNotMatch(
  floor,
  /FamiliarStatusCard|grid grid-cols-1 gap-3 sm:grid-cols-2/,
  "CovenFloor should not keep the old card-grid Floor layout",
);
