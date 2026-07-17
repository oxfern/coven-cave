# Native VNC hardening roadmap

The current harness is useful as an opt-in Linux native smoke and deterministic
runtime matrix. The following steps would make it a dependable gate without
mixing experimental infrastructure into the existing CI.

## Before enabling CI

- Run the inactive workflow on a fork by temporarily copying it into
  `.github/workflows/` and removing the job-level `if: false` guard.
- Pin every action, Bun version, Coven CLI version, uv version, and Linux image;
  update them intentionally with a recorded successful matrix.
- Measure cold and warm durations, then set the timeout and artifact retention
  from observed data.
- Add a failure-path run that proves cleanup removes the daemon, X server,
  websockify process, temporary home, and occupied ports.
- Decide whether recordings are needed on every run or only on failures and
  manual evidence runs.

## Reliability improvements

- Add schema validation for `runtime.json` and `scenario-manifest.json`.
- Replace fixed UI delays with observable state or accessibility conditions
  where Cave exposes them.
- Record process PIDs and exit reasons in the manifest for faster diagnosis.
- Add a disk-space preflight before Rust compilation and video capture.
- Exercise non-default display numbers and occupied-port selection in a
  container-level test.
- Test SIGINT, SIGTERM, app crash, daemon crash, and ffmpeg failure cleanup.
- Make the evidence card position derive from the selected desktop geometry.

## Coverage growth

- Add keyboard-only navigation and focus-order scenarios.
- Add window resize, high-DPI, and smaller-desktop cases.
- Add clipboard, drag/drop, attachment, and native dialog coverage where those
  paths are supported on Linux.
- Add one authenticated canary per supported vendor as a manual, secret-backed
  workflow. Keep it outside the deterministic PR matrix.
- Add adapter conformance tests before promoting any external manifest into the
  trusted runtime registry or summon flow.

## Enablement decision

The template at `workflow-template/native-vnc.yml` is inert both because it is
outside `.github/workflows/` and because the job has `if: false`. The repository
owner can enable it by copying the file into `.github/workflows/`, reviewing the
versions and permissions, removing the guard, and choosing `workflow_dispatch`,
scheduled, or pull-request triggers. Existing CI should remain untouched until
that decision is made.
