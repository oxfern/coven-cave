import { readFile } from "node:fs/promises";
import path from "node:path";

export type MarketplaceRoleAffinity = {
  familiar: string;
  roles: string[];
};

export type MarketplacePlugin = {
  name: string;
  displayName: string;
  version: string;
  description: string;
  category: string;
  keywords: string[];
  capabilities: string[];
  sourceRefs?: string[];
  trust: "official-remote" | "reference-local" | "preview-local" | "local-tool";
  mcpServers?: Record<string, unknown>;
  userConfig?: Record<string, unknown>;
  roleAffinity: MarketplaceRoleAffinity[];
  skill: {
    description: string;
    useCases: string[];
    guardrails: string[];
  };
};

export type MarketplacePluginWithState = MarketplacePlugin & {
  installed: boolean;
  installedAt?: string;
};

export type MarketplaceCatalog = {
  schemaVersion: "opencoven.marketplace.catalog.v1";
  name: string;
  displayName: string;
  description: string;
  version: string;
  generatedBy: string;
  plugins: MarketplacePlugin[];
};

function assertCatalog(value: unknown): asserts value is MarketplaceCatalog {
  if (!value || typeof value !== "object") {
    throw new Error("marketplace catalog must be an object");
  }
  const catalog = value as Partial<MarketplaceCatalog>;
  if (catalog.schemaVersion !== "opencoven.marketplace.catalog.v1") {
    throw new Error("unsupported marketplace catalog schema");
  }
  if (!Array.isArray(catalog.plugins)) {
    throw new Error("marketplace catalog plugins must be an array");
  }
  const names = new Set<string>();
  for (const plugin of catalog.plugins) {
    if (!plugin || typeof plugin !== "object") {
      throw new Error("marketplace plugin must be an object");
    }
    const entry = plugin as Partial<MarketplacePlugin>;
    if (!entry.name || !entry.displayName || !entry.description) {
      throw new Error("marketplace plugin is missing required metadata");
    }
    if (names.has(entry.name)) {
      throw new Error(`duplicate marketplace plugin: ${entry.name}`);
    }
    names.add(entry.name);
  }
}

export async function readMarketplaceCatalog(): Promise<MarketplaceCatalog> {
  const catalogPath = path.join(process.cwd(), "marketplace", "catalog.json");
  const raw = await readFile(catalogPath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  assertCatalog(parsed);
  return parsed;
}

export function pluginWithInstallState(
  plugin: MarketplacePlugin,
  installed?: { installedAt?: string },
): MarketplacePluginWithState {
  return {
    ...plugin,
    installed: installed != null,
    installedAt: installed?.installedAt,
  };
}
