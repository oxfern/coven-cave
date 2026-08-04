#!/usr/bin/env node

import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  prerequisiteById,
  type NpmPackage,
  type PrerequisiteId,
} from "../src/lib/onboarding-prerequisites.ts";
import {
  installManagedNodeToolchain,
  managedNodeSpawnEnv,
  managedNpmLaunch,
  probeManagedNodeToolchain,
  type ManagedNodePaths,
  type ManagedNodeProbe,
} from "../src/lib/server/managed-node-toolchain.ts";

const REVIEWED_PACKAGE_IDS = [
  "coven-cli",
  "runtime-claude",
  "runtime-codex",
  "runtime-copilot",
  "runtime-openclaw",
] as const satisfies readonly PrerequisiteId[];

type ReviewedPackage = NpmPackage & {
  id: (typeof REVIEWED_PACKAGE_IDS)[number];
  label: string;
};

type IsolationEnvironment = {
  home: string;
  isolatedRoot: string | undefined;
  covenHome: string | undefined;
  caveHome: string | undefined;
};

export function assertIsolatedDevEnvironment(environment: IsolationEnvironment): string {
  if (!environment.isolatedRoot) {
    throw new Error("COVEN_CAVE_ISOLATED_ROOT is missing; run this script through dev-isolated.sh");
  }
  const isolatedRoot = path.resolve(environment.isolatedRoot);
  const expectedHome = path.join(isolatedRoot, ".isolated-home");
  if (path.resolve(environment.home) !== expectedHome) {
    throw new Error(`HOME must be the isolated dev home: ${expectedHome}`);
  }
  if (path.resolve(environment.covenHome ?? "") !== path.join(expectedHome, ".coven")) {
    throw new Error("COVEN_HOME must be inside the isolated dev home");
  }
  if (path.resolve(environment.caveHome ?? "") !== path.join(expectedHome, ".coven", "cave")) {
    throw new Error("COVEN_CAVE_HOME must be inside the isolated dev home");
  }
  return isolatedRoot;
}

export function reviewedDevPackages(): ReviewedPackage[] {
  return REVIEWED_PACKAGE_IDS.map((id) => {
    const definition = prerequisiteById(id);
    if (definition.install.kind !== "managed-npm") {
      throw new Error(`${id} is not configured for the managed npm lane`);
    }
    return { id, label: definition.label, ...definition.install.package };
  });
}

export function globalPackageManifestPath(
  paths: Pick<ManagedNodePaths, "platform" | "npmPrefix">,
  packageName: string,
): string {
  const modulesRoot = paths.platform === "win32"
    ? path.join(paths.npmPrefix, "node_modules")
    : path.join(paths.npmPrefix, "lib", "node_modules");
  return path.join(modulesRoot, ...packageName.split("/"), "package.json");
}

export async function installedPackageVersion(
  paths: Pick<ManagedNodePaths, "platform" | "npmPrefix">,
  packageName: string,
): Promise<string | null> {
  try {
    const manifest = JSON.parse(await readFile(globalPackageManifestPath(paths, packageName), "utf8"));
    return typeof manifest.version === "string" ? manifest.version : null;
  } catch {
    return null;
  }
}

export async function packagesNeedingInstall(
  paths: Pick<ManagedNodePaths, "platform" | "npmPrefix">,
  packages = reviewedDevPackages(),
): Promise<ReviewedPackage[]> {
  const versions = await Promise.all(
    packages.map((entry) => installedPackageVersion(paths, entry.packageName)),
  );
  return packages.filter((entry, index) => versions[index] !== entry.version);
}

function managedEnvironment(paths: ManagedNodePaths): NodeJS.ProcessEnv {
  const environment = managedNodeSpawnEnv(process.env, paths);
  if (!environment) throw new Error("managed Node/npm is unavailable on this platform");
  return {
    ...environment,
    NPM_CONFIG_AUDIT: "false",
    NPM_CONFIG_FUND: "false",
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
  };
}

async function runVisible(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { ...options, shell: false, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`command exited with ${code === null ? `signal ${signal ?? "unknown"}` : `code ${code}`}`));
    });
  });
}

async function capture(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { ...options, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `command exited with ${code === null ? `signal ${signal ?? "unknown"}` : `code ${code}`}`));
    });
  });
}

async function waitForManagedNode(result: ManagedNodeProbe): Promise<Extract<ManagedNodeProbe, { status: "ready" }>> {
  let current = result;
  for (let attempt = 0; attempt < 4 && current.status !== "ready"; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    current = await probeManagedNodeToolchain();
  }
  if (current.status !== "ready") {
    const detail = current.status === "unusable" ? current.detail : `probe returned ${current.status}`;
    throw new Error(`Cave-managed Node.js/npm verification failed: ${detail}`);
  }
  return current;
}

async function ensureManagedNode(verifyOnly: boolean): Promise<Extract<ManagedNodeProbe, { status: "ready" }>> {
  const existing = await probeManagedNodeToolchain();
  if (existing.status === "ready") return existing;
  if (verifyOnly) throw new Error(`Cave-managed Node.js/npm is not ready (${existing.status})`);
  const installed = await installManagedNodeToolchain({
    onProgress: (line) => console.log(`[dev-setup] ${line}`),
  });
  return waitForManagedNode(installed);
}

async function verifyPublishedIntegrity(
  paths: ManagedNodePaths,
  entry: ReviewedPackage,
): Promise<void> {
  const launch = managedNpmLaunch(paths);
  if (!launch) throw new Error("managed npm launcher is unavailable");
  const raw = await capture(
    launch.command,
    [...launch.args, "view", `${entry.packageName}@${entry.version}`, "dist.integrity", "--json"],
    { cwd: homedir(), env: managedEnvironment(paths) },
  );
  const published = JSON.parse(raw);
  if (published !== entry.integrity) {
    throw new Error(`${entry.packageName}@${entry.version} does not match the reviewed integrity`);
  }
}

async function installPackages(paths: ManagedNodePaths, pending: ReviewedPackage[]): Promise<void> {
  const launch = managedNpmLaunch(paths);
  if (!launch) throw new Error("managed npm launcher is unavailable");
  for (const entry of pending) {
    console.log(`[dev-setup] Verifying ${entry.packageName}@${entry.version}…`);
    await verifyPublishedIntegrity(paths, entry);
  }
  console.log(`[dev-setup] Installing ${pending.map((entry) => entry.label).join(", ")}…`);
  await runVisible(
    launch.command,
    [
      ...launch.args,
      "install",
      "--global",
      "--no-audit",
      "--no-fund",
      ...pending.map((entry) => `${entry.packageName}@${entry.version}`),
    ],
    { cwd: homedir(), env: managedEnvironment(paths) },
  );
}

async function verifyBinary(paths: ManagedNodePaths, entry: ReviewedPackage): Promise<string> {
  const suffix = paths.platform === "win32" ? ".cmd" : "";
  const binary = path.join(paths.npmBin, `${entry.binary}${suffix}`);
  await access(binary, paths.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK);
  return capture(binary, ["--version"], { cwd: homedir(), env: managedEnvironment(paths) });
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const unknown = args.filter((arg) => arg !== "--verify-only");
  if (unknown.length > 0) throw new Error(`unknown option: ${unknown[0]}`);
  const verifyOnly = args.includes("--verify-only");
  const isolatedRoot = assertIsolatedDevEnvironment({
    home: homedir(),
    isolatedRoot: process.env.COVEN_CAVE_ISOLATED_ROOT,
    covenHome: process.env.COVEN_HOME,
    caveHome: process.env.COVEN_CAVE_HOME,
  });
  console.log(`[dev-setup] Isolated root: ${isolatedRoot}`);

  const managedNode = await ensureManagedNode(verifyOnly);
  console.log(`[dev-setup] Node.js ${managedNode.version} and npm are ready.`);

  const packages = reviewedDevPackages();
  const pending = await packagesNeedingInstall(managedNode.paths, packages);
  if (pending.length > 0 && verifyOnly) {
    throw new Error(`reviewed packages are missing or mismatched: ${pending.map((entry) => entry.packageName).join(", ")}`);
  }
  if (pending.length > 0) await installPackages(managedNode.paths, pending);
  else console.log("[dev-setup] Reviewed CLI packages already match the manifest.");

  const mismatched = await packagesNeedingInstall(managedNode.paths, packages);
  if (mismatched.length > 0) {
    throw new Error(`package verification failed: ${mismatched.map((entry) => entry.packageName).join(", ")}`);
  }
  for (const entry of packages) {
    const versionOutput = await verifyBinary(managedNode.paths, entry);
    console.log(`[dev-setup] ${entry.label}: ${versionOutput.split(/\r?\n/)[0]}`);
  }
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (entryPath === import.meta.url) {
  main().catch((error) => {
    console.error(`[dev-setup] FATAL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
