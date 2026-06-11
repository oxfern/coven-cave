import { chmodSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") {
  process.exit(0);
}

const root = process.cwd();
const candidates = [
  path.join(root, "node_modules", "node-pty"),
  path.join(root, "node_modules", ".pnpm"),
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (entry === "node_modules" && full.includes(`${path.sep}.pnpm${path.sep}`)) {
        walk(full, out);
      } else if (entry === "node-pty" || full.includes(`${path.sep}node-pty${path.sep}`)) {
        walk(full, out);
      } else if (full.endsWith(`${path.sep}.pnpm`)) {
        walk(full, out);
      }
    } else if (entry === "spawn-helper" && full.includes(`${path.sep}prebuilds${path.sep}darwin-`)) {
      out.push(full);
    }
  }
  return out;
}

const helpers = [...new Set(candidates.flatMap((candidate) => walk(candidate)))];
for (const helper of helpers) {
  chmodSync(helper, 0o755);
}

if (helpers.length > 0) {
  console.log(`fixed node-pty spawn-helper mode (${helpers.length})`);
}
