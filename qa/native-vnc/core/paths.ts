import path from "node:path";

export const harnessRoot = path.resolve(import.meta.dir, "..");
export const repoRoot = path.resolve(harnessRoot, "../..");

export function fromRepo(...parts: string[]): string {
  return path.join(repoRoot, ...parts);
}

export function fromHarness(...parts: string[]): string {
  return path.join(harnessRoot, ...parts);
}
