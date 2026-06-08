// @ts-nocheck
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pluginsView = await readFile(new URL("./plugins-view.tsx", import.meta.url), "utf8");
const pluginCard = await readFile(new URL("./plugin-card.tsx", import.meta.url), "utf8");
const marketplaceApi = await readFile(new URL("../app/api/marketplace/route.ts", import.meta.url), "utf8");
const catalog = JSON.parse(
  await readFile(new URL("../../marketplace/catalog.json", import.meta.url), "utf8"),
);

assert.equal(
  catalog.schemaVersion,
  "opencoven.marketplace.catalog.v1",
  "Cave should own the canonical OpenCoven marketplace catalog schema",
);

assert.match(
  catalog.description,
  /Coven Cave/i,
  "Catalog description should make Cave the canonical marketplace surface",
);

for (const plugin of ["github", "gmail", "google-calendar", "linear", "canva", "vercel", "asana"]) {
  assert.ok(
    catalog.plugins.some((entry) => entry.name === plugin),
    `Catalog should seed familiar integration plugin: ${plugin}`,
  );
}

assert.match(
  marketplaceApi,
  /readMarketplaceCatalog/,
  "Marketplace API should read through the typed marketplace catalog helper",
);

assert.match(
  marketplaceApi,
  /export async function POST\(req: Request\)/,
  "Marketplace API should expose a local install/uninstall mutation path",
);

assert.match(
  marketplaceApi,
  /installMarketplacePlugin[\s\S]*uninstallMarketplacePlugin/,
  "Marketplace API should persist local install state through cave config helpers",
);

assert.match(
  pluginsView,
  /fetch\("\/api\/marketplace"/,
  "Plugins tab should load canonical marketplace packages instead of only harnesses",
);

assert.match(
  pluginsView,
  /body: JSON\.stringify\(\{ action: "install", name: plugin\.name \}\)/,
  "Plugins tab should install marketplace packages through the marketplace API",
);

assert.match(
  pluginsView,
  /initialTab[\s\S]*tabSet\.includes\(initialTab\)/,
  "PluginsView should support opening on the caller-selected tab",
);

assert.match(
  pluginCard,
  /MarketplacePlugin/,
  "Plugin cards should render marketplace package metadata",
);

assert.match(
  pluginCard,
  /recommendedFor/i,
  "Plugin cards should expose familiar or role affinity",
);
