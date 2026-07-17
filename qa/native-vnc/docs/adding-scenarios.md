# Adding a native VNC scenario

Add scenarios when a behavior crosses a native boundary, depends on a real
desktop or daemon, or benefits from visible evidence. Prefer faster unit or API
tests for behavior that does not need the Tauri window or VNC transport.

1. Add a stable, numbered identifier to `scenarioIds` in
   `scenarios/cases.ts`.
2. Add one `context.runScenario(...)` block. Keep setup inside the scenario or
   make its dependency on an earlier case explicit.
3. Drive product state through the real API where possible. Use
   `context.xdotool(...)` only when the visible native interaction is part of
   the contract.
4. Return a short summary and concrete assertion labels. They become the
   durable manifest and the pass card in recorded evidence.
5. If a vendor process response is needed, extend the appropriate protocol in
   `runtimes/`. Do not add credentials or imitate application internals.
6. Add a fast test for any new parser, invariant, or structural rule.
7. Run the checks below, then run the full native matrix on Linux.

```bash
bun test qa/native-vnc/tests
bun build qa/native-vnc/cli/start.ts qa/native-vnc/cli/view.ts \
  qa/native-vnc/cli/smoke.ts qa/native-vnc/cli/record-scenarios.ts \
  qa/native-vnc/cli/ci.ts qa/native-vnc/runtimes/fake-coven.ts \
  --target=bun --outdir=/tmp/coven-cave-native-vnc-build
```

For a local matrix, start Cave with `CAVE_VNC_FAKE_RUNTIMES=1`, run the smoke
entrypoint, then run `record-scenarios.ts`. Inspect the manifest, the final
screenshot, service logs, and each recording. A passing manifest alone is not
enough when the scenario's purpose is visual UX.

Keep generated screenshots, recordings, traces, and logs under
`artifacts/openvnc-qa/`. Before review, verify that no `.webm`, `.mp4`, `.mov`,
`.gif`, or generated artifact directory is staged. Publish review evidence as
external PR-linked assets instead.
