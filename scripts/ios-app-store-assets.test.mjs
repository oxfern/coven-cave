import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const appIconDir = new URL(
  "../apps/ios/CovenCave/CovenCave/Assets.xcassets/AppIcon.appiconset/",
  import.meta.url,
);
const contents = JSON.parse(await readFile(new URL("Contents.json", appIconDir), "utf8"));
const infoPlist = await readFile(
  new URL("../apps/ios/CovenCave/CovenCave/Info.plist", import.meta.url),
  "utf8",
);

const requiredIcons = [
  { idiom: "iphone", size: "60x60", scale: "2x", filename: "AppIcon-60x60@2x.png" },
  { idiom: "iphone", size: "60x60", scale: "3x", filename: "AppIcon-60x60@3x.png" },
  { idiom: "ipad", size: "76x76", scale: "2x", filename: "AppIcon-76x76@2x.png" },
  { idiom: "ios-marketing", size: "1024x1024", scale: "1x", filename: "AppIcon-512@2x.png" },
];

for (const expected of requiredIcons) {
  const icon = contents.images.find((image) =>
    image.idiom === expected.idiom &&
    image.size === expected.size &&
    image.scale === expected.scale &&
    image.filename === expected.filename
  );

  assert.ok(
    icon,
    `AppIcon catalog should declare ${expected.idiom} ${expected.size}@${expected.scale}`,
  );
  await access(new URL(expected.filename, appIconDir));
}

assert.match(
  infoPlist,
  /<key>CFBundleIconName<\/key>\s*<string>AppIcon<\/string>/,
  "iOS App Store uploads require CFBundleIconName to point at the asset catalog app icon",
);

console.log("ios-app-store-assets.test.mjs: ok");
