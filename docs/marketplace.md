# Marketplace

Coven Cave is the canonical user-facing marketplace surface for first-party OpenCoven plugins and MCP integrations. The seeded package catalog lives in `marketplace/catalog.json`, and `scripts/sync-marketplace.py` expands that catalog into:

- `marketplace/plugins/<name>/plugin.json`
- `marketplace/plugins/<name>/skills/<name>/SKILL.md`
- `marketplace/plugins/<name>/.codex-plugin/plugin.json`
- `marketplace/marketplace.json`
- `marketplace/exports/codex/marketplace.json`
- `marketplace/exports/mcp/mcp.json`
- `marketplace/exports/roles/role-affinity.json`

## Design

The Cave catalog is the canonical package metadata because Cave is where familiars, roles, skills, and setup state meet. Generated package directories keep Coven Code, Codex, MCP-only clients, and role-affinity views from drifting away from that Cave-owned source.

Each catalog entry includes:

- package metadata for Cave and compatible clients
- optional MCP server configuration
- user-config declarations for sensitive setup values
- trust level, source references, and role affinity
- one generated Skill that tells familiars how to use the integration safely

## Seed Packages

The first seed starts with integrations already used by Val's familiar lanes:

- GitHub
- Gmail
- Google Calendar
- Linear
- Canva
- Vercel
- Asana
- xurl

It also includes a conservative common MCP starter set:

- Filesystem
- Git
- Fetch
- Memory
- Sequential Thinking
- Time

## Trust Levels

`official-remote` packages point at a service-operated remote MCP endpoint, such as Linear, Vercel, Canva, or Asana.

`reference-local` packages use MCP reference servers. These are useful defaults, but installers should still apply local threat-model checks.

`preview-local` packages use a local tool or preview integration whose exact command surface may move before a stable marketplace release.

`local-tool` packages wrap a local OpenCoven or OpenClaw tool that is part of Val's familiar setup rather than an external MCP service.

## Updating

Edit `marketplace/catalog.json`, then run:

```bash
python3 scripts/sync-marketplace.py
python3 scripts/sync-marketplace.py --check
```

The check command fails if generated packages or exports are missing or stale.

## Local Install State

Cave records local marketplace installs in `~/.coven/cave-config.json` under `marketplace.installed`. This first pass does not write secrets or call third-party account APIs; it records which package the user chose so Cave can layer configuration, export application, and harness setup on top.
