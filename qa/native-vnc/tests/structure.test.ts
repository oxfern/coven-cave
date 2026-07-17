import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { harnessRoot } from "../core/paths.ts";
import { scenarioIds } from "../scenarios/cases.ts";

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(absolute) : [absolute];
  }));
  return nested.flat();
}

describe("native VNC harness structure", () => {
  test("contains no shell scripts or checked-in media", async () => {
    const files = await filesUnder(harnessRoot);
    const forbidden = files.filter((file) => /\.(?:sh|webm|mp4|mov|gif)$/i.test(file));
    expect(forbidden).toEqual([]);
  });

  test("keeps the workflow template inactive", async () => {
    const workflow = await readFile(
      path.join(harnessRoot, "workflow-template", "native-vnc.yml"),
      "utf8",
    );
    expect(workflow).toContain("if: ${{ false }}");
    expect(workflow).toContain("bun qa/native-vnc/cli/ci.ts");
  });

  test("uses Bun Shell instead of child_process", async () => {
    const files = (await filesUnder(harnessRoot)).filter((file) => file.endsWith(".ts"));
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
    const forbiddenImport = ["node", "child_process"].join(":");
    expect(sources.some((source) => source.includes(forbiddenImport))).toBe(false);
    for (const entrypoint of ["start.ts", "view.ts", "smoke.ts", "ci.ts"]) {
      const source = await readFile(path.join(harnessRoot, "cli", entrypoint), "utf8");
      expect(source).toContain('import { $ } from "bun"');
    }
  });

  test("retains the complete scenario contract", () => {
    expect(scenarioIds).toEqual([
      "01-first-launch",
      "02-familiar-creation",
      "03-daemon-recovery",
      "04-runtime-inventory",
      "05-summon-choices",
      "06-chat-round-trip",
      "07-resume-recovery",
      "08-permissions-scope",
      "09-failure-ux",
      "10-trust-boundary",
      "11-openclaw-warnings",
    ]);
  });
});
