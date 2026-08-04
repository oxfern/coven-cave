import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertIsolatedDevEnvironment,
  globalPackageManifestPath,
  packagesNeedingInstall,
  reviewedDevPackages,
} from "./setup-isolated-dev-tools.ts";

const testRoot = await mkdtemp(path.join(tmpdir(), "coven-dev-setup-test-"));
try {
  const testHome = path.join(testRoot, ".isolated-home");
  assert.equal(
    assertIsolatedDevEnvironment({
      home: testHome,
      isolatedRoot: testRoot,
      covenHome: path.join(testHome, ".coven"),
      caveHome: path.join(testHome, ".coven", "cave"),
    }),
    path.resolve(testRoot),
  );
  assert.throws(
    () => assertIsolatedDevEnvironment({
      home: tmpdir(),
      isolatedRoot: testRoot,
      covenHome: path.join(testHome, ".coven"),
      caveHome: path.join(testHome, ".coven", "cave"),
    }),
    /HOME must be the isolated dev home/,
  );

  const packages = reviewedDevPackages();
  assert.deepEqual(
    packages.map((entry) => entry.packageName),
    ["@opencoven/cli", "@anthropic-ai/claude-code", "@openai/codex", "@github/copilot", "openclaw"],
  );
  assert.ok(packages.every((entry) => /^\d+\.\d+\.\d+/.test(entry.version)));
  assert.ok(packages.every((entry) => entry.integrity.startsWith("sha512-")));

  const paths = {
    platform: "linux" as const,
    npmPrefix: path.join(testRoot, "toolchains", "npm"),
  };
  const first = packages[0]!;
  const manifestPath = globalPackageManifestPath(paths, first.packageName);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify({ version: first.version }), "utf8");

  const pending = await packagesNeedingInstall(paths, packages);
  assert.deepEqual(
    pending.map((entry) => entry.packageName),
    packages.slice(1).map((entry) => entry.packageName),
    "exactly pinned packages must be no-ops while missing packages remain pending",
  );

  await writeFile(manifestPath, JSON.stringify({ version: "0.0.0" }), "utf8");
  assert.equal(
    (await packagesNeedingInstall(paths, packages))[0]?.packageName,
    first.packageName,
    "a mismatched installed version must be repaired",
  );

  const ensureSource = await readFile(
    new URL("../.agents/skills/coven-cave/scripts/ensure-isolated.sh", import.meta.url),
    "utf8",
  );
  assert.match(
    ensureSource,
    /dev-isolated\.sh" node --experimental-strip-types scripts\/setup-isolated-dev-tools\.ts/,
    "the isolated workspace bootstrap must run the reviewed dev-tool setup",
  );
  const launcherSource = await readFile(
    new URL("../.agents/skills/coven-cave/scripts/dev-isolated.sh", import.meta.url),
    "utf8",
  );
  assert.match(
    launcherSource,
    /export COVEN_CAVE_ISOLATED_ROOT="\$ROOT"/,
    "the isolation launcher must identify its root for the setup safety guard",
  );
} finally {
  await rm(testRoot, { recursive: true, force: true });
}

console.log("setup-isolated-dev-tools: ok");
