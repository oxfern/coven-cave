# Native VNC harness architecture

The harness separates lifecycle, runtime behavior, scenario assertions, and
operator commands so each layer can change without turning the suite into one
large orchestration script.

```text
qa/native-vnc/
├── cli/               operator entrypoints
├── core/              configuration, isolation, daemon, ports, processes
├── desktop/           the lightweight LXPanel profile
├── runtimes/          deterministic Coven and vendor process doubles
├── scenarios/         scenario context, assertions, and manifest contract
├── tests/             fast structural and protocol tests
└── workflow-template/ inactive CI proposal
```

Commands use Bun Shell for readable, escaped, cross-platform process
invocation. `Bun.spawn` is reserved for services that must stay alive while the
harness supervises them: Xvfb, the window manager, VNC servers, Cave, ffmpeg,
and the temporary evidence card. This gives long-lived processes explicit PIDs,
logs, signals, and shutdown deadlines.

The launcher uses three containment boundaries:

- Xvfb disables its TCP listener, while x11vnc and noVNC bind only to
  `127.0.0.1`.
- Cave and the daemon receive a temporary `HOME`, `COVEN_HOME`,
  `COVEN_CAVE_HOME`, and XDG tree that is removed at shutdown.
- Credential-free mode prepends generated runtime shims from the temporary
  state directory. No generated executables or user credentials enter Git.

The runtime doubles implement process protocols, not product behavior. They
exercise generic JSON streams, Copilot JSONL, one-shot manifests, OpenClaw's
local bridge, resume errors, provider-style failures, permission flags, and
path-boundary events. Authenticated provider canaries belong in a separate,
secret-backed check because their availability and billing should not control
the deterministic PR gate.

Every scenario produces structured assertions in `scenario-manifest.json`.
Video is optional and lives under the ignored runtime artifact directory. A PR
may link a release-hosted recording and animated preview; the repository should
never contain those binaries.
