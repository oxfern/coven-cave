# Isolated coven-cave layout

Default root: `/tmp/coven-cave-isolated` (`$COVEN_CAVE_ISOLATED_ROOT`).

## Tree

```
$ROOT/
  .git/                          # clone of OpenCoven/coven-cave
  node_modules/
  src/  src-tauri/  scripts/ …
  dev-isolated.sh                # required entrypoint for all commands
  .bin/                          # self-contained toolchain, first on PATH
    node → toolchain/node-v…/bin/node
    npm  npx  corepack           # symlinks into the node dist
    pnpm                         # standalone binary (packageManager pin)
    toolchain/node-v…/           # extracted node dist (.nvmrc pin)
    .provision.lock/             # transient; serializes concurrent provisioning
  .pnpm-home/
  .isolated-home/                # fake $HOME
    .coven/                      # $COVEN_HOME
      cave/                      # $COVEN_CAVE_HOME
      familiars.toml
      memory/ prompts/ skills/ adapters/ workspaces/
    .cargo/                      # $CARGO_HOME
    .pnpm-store/
    .npm/
    .config/  .local/  .cache/   # XDG_*
    Library/
      Application Support/OpenCoven/CovenCave/toolchains/
        node/v…/                  # Cave-managed Node/npm runtime
        npm/                      # reviewed global CLI packages + launchers
      Application Support/ai.opencoven.cave/
      Logs/ai.opencoven.cave/
  src-tauri/target/              # $CARGO_TARGET_DIR
```

## Environment (set by `dev-isolated.sh`)

| Variable | Value |
|----------|--------|
| `HOME` | `$ROOT/.isolated-home` |
| `COVEN_HOME` | `$HOME/.coven` |
| `COVEN_CAVE_HOME` | `$HOME/.coven/cave` |
| `XDG_CONFIG_HOME` | `$HOME/.config` |
| `XDG_DATA_HOME` | `$HOME/.local/share` |
| `XDG_STATE_HOME` | `$HOME/.local/state` |
| `XDG_CACHE_HOME` | `$HOME/.cache` |
| `CARGO_HOME` | `$HOME/.cargo` |
| `CARGO_TARGET_DIR` | `$ROOT/src-tauri/target` |
| `PNPM_STORE_PATH` | `$HOME/.pnpm-store` |
| `npm_config_cache` | `$HOME/.npm` |
| `npm_config_userconfig` | `$HOME/.npmrc` |
| `PATH` | `$ROOT/.bin` first, then `$CARGO_HOME/bin`, `$PNPM_HOME`, system dirs; homebrew last (fallback only) |

## Toolchain pins

- node — `.nvmrc` in the checkout (bare major resolves to newest release).
- pnpm — `"packageManager"` in the checkout's `package.json`.
- rust — not auto-installed; `COVEN_CAVE_ENSURE_RUST=1` installs rustup into
  the isolated `CARGO_HOME`/`RUSTUP_HOME`; a host cargo is used as fallback.
- Cave-managed runtime tools — `scripts/setup-isolated-dev-tools.ts` reads the
  exact Node and npm package pins from `src/lib/onboarding-prerequisites.ts`.

## Why both `HOME` and `COVEN_HOME`

- `src/lib/coven-paths.ts` prefers `COVEN_HOME` / `COVEN_CAVE_HOME`.
- Some routes still use `homedir() + "/.coven"` (e.g. onboarding status,
  github-subscriptions). Fake `HOME` covers those.

## Ports

Preferred isolated web port: **3011**. Reuse it for Tauri `devUrl` so the shell
and Next share one origin. `scripts/dev-app.sh` also auto-picks `3000..3010` if
`PORT` is unset — pin `PORT` when the isolated server is already up.
