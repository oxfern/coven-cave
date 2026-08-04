import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const iconRoot = join(repoRoot, "src-tauri", "icons");
const outputRoot = join(iconRoot, "dev");
const sourceIcon = join(iconRoot, "icon-source-1024.png");
const generatedFiles = [
  "32x32.png",
  "128x128.png",
  "128x128@2x.png",
  "icon.icns",
  "icon.ico",
];

const canvasSize = 1024;
const artworkSize = 824;
const artworkInset = (canvasSize - artworkSize) / 2;

function superellipsePath(size, exponent = 5, segments = 256) {
  const radius = size / 2;
  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const x = radius + radius * Math.sign(cosine) * Math.abs(cosine) ** (2 / exponent);
    const y = radius + radius * Math.sign(sine) * Math.abs(sine) ** (2 / exponent);
    points.push(`${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `${points.join(" ")} Z`;
}

// Map the production icon's black background to OpenCoven lavender while
// preserving its white mark and grayscale antialiasing.
const background = [0x68, 0x59, 0xac];
const scale = background.map((channel) => (255 - channel) / 255);
const mask = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${artworkSize}" height="${artworkSize}" viewBox="0 0 ${artworkSize} ${artworkSize}"><path d="${superellipsePath(artworkSize)}" fill="white"/></svg>`,
);
const temporaryRoot = await mkdtemp(join(tmpdir(), "coven-cave-dev-icons-"));
const tintedSource = join(temporaryRoot, "icon-source-1024.png");
const generatedRoot = join(temporaryRoot, "generated");

try {
  await sharp(sourceIcon)
    .linear(scale, background)
    .resize(artworkSize, artworkSize)
    .composite([{ input: mask, blend: "dest-in" }])
    .extend({
      top: artworkInset,
      bottom: artworkInset,
      left: artworkInset,
      right: artworkInset,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(tintedSource);

  let outputIsCurrent = false;
  try {
    const [nextSource, existingSource, ...existingIcons] = await Promise.all([
      readFile(tintedSource),
      readFile(join(outputRoot, "icon-source-1024.png")),
      ...generatedFiles.map((file) => readFile(join(outputRoot, file))),
    ]);
    outputIsCurrent =
      nextSource.equals(existingSource) &&
      existingIcons.every((icon) => icon.length > 0);
  } catch {
    outputIsCurrent = false;
  }

  if (outputIsCurrent) {
    console.log(`Development app icons are up to date in ${outputRoot}`);
  } else {
    const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    const result = spawnSync(
      pnpm,
      ["exec", "tauri", "icon", tintedSource, "--output", generatedRoot],
      { cwd: repoRoot, encoding: "utf8" },
    );
    if (result.status !== 0) {
      process.stderr.write(result.stderr || result.stdout);
      process.exitCode = result.status ?? 1;
      throw new Error("Tauri could not generate the development icon set");
    }

    await mkdir(outputRoot, { recursive: true });
    await copyFile(tintedSource, join(outputRoot, "icon-source-1024.png"));
    await Promise.all(
      generatedFiles.map((file) =>
        copyFile(join(generatedRoot, file), join(outputRoot, file)),
      ),
    );
    console.log(`Generated development app icons in ${outputRoot}`);
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
