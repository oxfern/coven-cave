import { NextResponse } from "next/server";
import {
  pluginWithInstallState,
  readMarketplaceCatalog,
} from "@/lib/plugin-marketplace";
import {
  installMarketplacePlugin,
  loadConfig,
  uninstallMarketplacePlugin,
} from "@/lib/cave-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const catalog = await readMarketplaceCatalog();
    const config = await loadConfig();
    const plugins = catalog.plugins.map((plugin) =>
      pluginWithInstallState(plugin, config.marketplace.installed[plugin.name]),
    );
    return NextResponse.json({ ok: true, catalog, plugins });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "failed to load marketplace",
        catalog: null,
        plugins: [],
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  let body: { action?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  const name = body.name;
  if ((action !== "install" && action !== "uninstall") || !name) {
    return NextResponse.json(
      { ok: false, error: "action must be install or uninstall, and name is required" },
      { status: 400 },
    );
  }

  try {
    const catalog = await readMarketplaceCatalog();
    const plugin = catalog.plugins.find((entry) => entry.name === name);
    if (!plugin) {
      return NextResponse.json({ ok: false, error: "unknown marketplace plugin" }, { status: 404 });
    }

    if (action === "install") {
      await installMarketplacePlugin(plugin.name, plugin.version, "catalog");
    } else {
      await uninstallMarketplacePlugin(plugin.name);
    }

    const config = await loadConfig();
    const plugins = catalog.plugins.map((entry) =>
      pluginWithInstallState(entry, config.marketplace.installed[entry.name]),
    );
    return NextResponse.json({
      ok: true,
      plugin: pluginWithInstallState(plugin, config.marketplace.installed[plugin.name]),
      plugins,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "failed to update marketplace",
      },
      { status: 500 },
    );
  }
}
