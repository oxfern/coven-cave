---
name: coven-cave
description: >
  Default mandatory workspace discipline for all repository and development work in
  OpenCoven Coven Cave (github.com/OpenCoven/coven-cave). Always activate when the
  current working directory or target repository is Coven Cave, even if the user's
  prompt does not name the project. Use for planning, status and diff inspection, Git
  operations, setup, coding, reviewing, debugging, testing, building, running, release
  work, and any task touching coven-cave / CovenCave / OpenCoven cave, ~/.coven,
  COVEN_HOME, or the Cave Tauri/Next app. Enforces isolated-home VFS: never let the app
  or tooling read the real user home. Triggers include a coven-cave path or remote,
  Coven Cave, OpenCoven cave, "isolated cave", dev:app, pnpm dev for cave, ~/.coven,
  COVEN_HOME, Tauri cave shell, and /coven-cave. This is the way.
---

# Coven Cave — isolated workspace (this is the way)

When the current checkout or target repository is Coven Cave, **load this skill by
default and follow it before any other repository or development work**. The user does
not need to mention Coven Cave or invoke the skill explicitly.

Coven Cave persists state under `~/.coven` / `os.homedir()` unless redirected. On this
machine the contract is: **development never reads or writes the real user home**.
Use the isolated tree + env-level fake home instead of a kernel VFS.

## Detect that you are in coven-cave

Any of these → this skill owns the session:

- `cwd` or a parent is a `coven-cave` checkout (look for `src-tauri/`, `package.json`
  name `coven-cave`, or `ai.opencoven.cave`)
- git remote contains `OpenCoven/coven-cave`
- User asks to run, fix, review, or develop Cave / CovenCave / coven-cave
- Any plan would touch `~/.coven`, `COVEN_HOME`, or install Cave tools into real `~`

If you are **not** in that repo and the user did not ask for Cave, do not load this
workflow.

## Non-negotiable rules

1. **Never** run `pnpm dev`, `pnpm dev:app`, `scripts/dev-app.sh`, Tauri, or tests
   against the real `$HOME` / real `~/.coven`.
2. **Always** use the isolation launcher so `HOME`, `COVEN_HOME`, `COVEN_CAVE_HOME`,
   `XDG_*`, `CARGO_HOME`, and `CARGO_TARGET_DIR` sit under the isolated tree.
3. Prefer the existing isolated checkout over cloning into `~/…`.
4. If isolation is missing, recreate it with the skill script — do not “just use”
   the real home for speed.
5. Real `~/.coven` may already exist from a production install. Treat it as **off
   limits** unless the user explicitly asks to inspect production state.

## Canonical isolated root

| Item | Path |
|------|------|
| Checkout | `/tmp/coven-cave-isolated` |
| Fake home | `/tmp/coven-cave-isolated/.isolated-home` |
| `$COVEN_HOME` | `…/.isolated-home/.coven` |
| `$COVEN_CAVE_HOME` | `…/.isolated-home/.coven/cave` |
| Cargo home | `…/.isolated-home/.cargo` |
| Cargo target | `…/src-tauri/target` |
| Launcher | `…/dev-isolated.sh` |
| Toolchain | `…/.bin` (node + pnpm, auto-downloaded) |

Override root with `COVEN_CAVE_ISOLATED_ROOT` if needed; keep it **outside** the
real user home.

## Bootstrap (if missing)

Resolve this skill’s directory (folder containing this `SKILL.md`), then:

```bash
bash "<SKILL_DIR>/scripts/ensure-isolated.sh"
```

That clones `https://github.com/OpenCoven/coven-cave` into the isolated root if
needed, seeds empty cave state, installs `dev-isolated.sh`, and optionally seeds
the cargo registry **once** from the host (runtime still never points at real `~`).

## Every command goes through the launcher

```bash
ROOT=/tmp/coven-cave-isolated   # or $COVEN_CAVE_ISOLATED_ROOT
cd "$ROOT"

./dev-isolated.sh pnpm install
./dev-isolated.sh env PORT=3011 pnpm dev
./dev-isolated.sh env PORT=3011 bash scripts/dev-app.sh   # Tauri shell
./dev-isolated.sh pnpm typecheck
./dev-isolated.sh pnpm test:app
```

`dev-isolated.sh` **exits non-zero** if `HOME` or `CARGO_HOME` still resolve under
the real user home. Do not bypass it.

## Self-contained toolchain (`$ROOT/.bin`)

The launcher does **not** rely on host homebrew, nvm, or corepack. On every run
it ensures a pinned toolchain under `$ROOT/.bin` and puts it first on `PATH`:

- **node** — version from the checkout's `.nvmrc`, official tarball extracted
  to `.bin/toolchain/`, with `node`/`npm`/`npx`/`corepack` symlinked into `.bin`.
- **pnpm** — standalone binary (no node needed to boot it), version from
  `package.json` `"packageManager"`.
- **rust** — NOT downloaded by default (large). If `cargo` is missing the
  launcher warns; run once with `COVEN_CAVE_ENSURE_RUST=1` to install rustup
  into the isolated `CARGO_HOME`/`RUSTUP_HOME`. A host cargo (e.g. homebrew's)
  is used as fallback when present.

Provisioning is idempotent (fast no-op when versions match) and serialized via
`.bin/.provision.lock` (mkdir-atomic), so concurrent sessions can't corrupt a
download in flight — if the lock is stale (>5 min), the launcher says so;
remove the dir by hand. This means "pnpm/node: command not found" can no
longer happen from GUI-spawned shells, cron, or bare-PATH contexts: the
launcher bootstraps what it needs. Delete `.bin/` to force a re-download.

## Dev server + Tauri

- **Web only:** `./dev-isolated.sh env PORT=3011 pnpm dev` → `http://127.0.0.1:3011`
- **Native shell:** same `PORT`, then `bash scripts/dev-app.sh` (or `pnpm dev:app`).
  The wrapper reuses a healthy server on that port; first cargo build is slow.
- Whisper runtime is bundled by `scripts/whisper-runtime-bundle.sh` on first
  `dev-app` (lives under `src-tauri/resources/whisper`).
- Logs: `.isolated-home/Library/Logs/ai.opencoven.cave/CovenCave.log`
- App data: `.isolated-home/Library/Application Support/ai.opencoven.cave/`

Pin a free port if 3011 is taken; stay consistent so web + Tauri share one origin.

## Isolation model (why this works)

App code honors:

- `COVEN_HOME` / `COVEN_CAVE_HOME` (see `src/lib/coven-paths.ts`)
- `os.homedir()` for some paths that still join `~/.coven` without the env vars

So isolation must set **both** explicit coven env vars **and** fake `HOME`.
Playwright e2e in-repo already uses temp `COVEN_HOME`; this skill is the same
idea for interactive/dev work, plus full home/XDG/cargo fencing.

Not a FUSE VFS — env-root sandbox. Good enough when every process is started
through `dev-isolated.sh`.

## Repo workflow (from upstream, still apply)

While isolated for FS, still follow Cave’s engineering norms from the checkout’s
`AGENTS.md` / `CLAUDE.md`:

- Branch from current `origin/main`; short-lived PR branches / worktrees
- Prefer managed worktrees via `pnpm beads:worktrees:create` when Beads is in play
- Verify with the suite that matches the change (`typecheck`, `test:app`, `test:api`, …)

Run those commands **through** `./dev-isolated.sh` so beads/tests cannot write
real home by accident.

## Quick health checks

```bash
# Launcher points at fake home
./dev-isolated.sh node -e "const os=require('os'); console.log(os.homedir())"
# must print .../coven-cave-isolated/.isolated-home

# Toolchain is self-contained (no host homebrew/nvm involved)
./dev-isolated.sh sh -c 'command -v node pnpm'
# both must print paths under $ROOT/.bin/

# Onboarding sees isolated coven home
curl -sS http://127.0.0.1:3011/api/onboarding/status | head -c 400

# Real production state untouched (mtime should not jump because of your session)
stat -f '%Sm %N' "$HOME/.coven" 2>/dev/null || true
```

## Do not

- `cd` into a checkout under the real home and run bare `pnpm dev`
- Export `COVEN_HOME=~/.coven` “just this once”
- Point `CARGO_HOME` at `~/.cargo` for the running app (one-time rsync seed into
  the isolated cargo dir is fine; live env is not)
- Commit the isolated tree under `/tmp` as if it were the user’s product clone
  unless they asked

## References

- `references/layout.md` — path map and env vars
- `scripts/dev-isolated.sh` — launcher source of truth
- `scripts/ensure-isolated.sh` — bootstrap / repair
- Upstream: https://github.com/OpenCoven/coven-cave
