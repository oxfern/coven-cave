import assert from "node:assert/strict";
import test from "node:test";
import { selectSignedArtifact } from "./generate-latest-json.mjs";

test("linux updater manifest prefers the ubuntu-24.04 AppImage when both dist builds are signed", () => {
  const assets = [
    "CovenCave_0.0.140_amd64_ubuntu-22.04.AppImage",
    "CovenCave_0.0.140_amd64_ubuntu-22.04.AppImage.sig",
    "CovenCave_0.0.140_amd64_ubuntu-24.04.AppImage",
    "CovenCave_0.0.140_amd64_ubuntu-24.04.AppImage.sig",
  ];
  const sigs = new Set(assets.filter((name) => name.endsWith(".sig")));

  assert.equal(
    selectSignedArtifact(
      assets,
      (name) => name.endsWith(".AppImage"),
      (name) => sigs.has(`${name}.sig`),
      (name) => name.includes("ubuntu-24.04"),
    ),
    "CovenCave_0.0.140_amd64_ubuntu-24.04.AppImage",
  );
});

test("signed artifact selection falls back to the first signed match", () => {
  const assets = [
    "CovenCave_0.0.140_amd64.AppImage",
    "CovenCave_0.0.140_amd64.AppImage.sig",
  ];
  const sigs = new Set(assets.filter((name) => name.endsWith(".sig")));

  assert.equal(
    selectSignedArtifact(
      assets,
      (name) => name.endsWith(".AppImage"),
      (name) => sigs.has(`${name}.sig`),
      (name) => name.includes("ubuntu-24.04"),
    ),
    "CovenCave_0.0.140_amd64.AppImage",
  );
});
