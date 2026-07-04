# Contributing to Coven Cave

Thank you for your interest in Coven Cave.

## Pull request intake

External PR intake is staged during the July 4, 2026 OpenCoven Independence Day
PR Event.

OpenCoven maintainers and allow-listed event contributors may open PRs directly.
Other external PRs may still be routed to GitHub Issues by automation so the
technical context is preserved without overwhelming the review queue. If that
happens, continue discussion on the linked issue and wait for maintainer
direction before reopening a PR.

This is not a comment on the quality of contributions — we appreciate the
care that goes into PRs against this repo. It is purely a coordination
choice while the repo scales PR review, CI, and release stability.

## What is in scope right now

The most helpful things outside contributors can do:

- **Open a clear bug report or feature request** as a GitHub Issue. Include
  reproduction steps, environment, and the smallest possible example.
- **Discuss design tradeoffs** in issue comments before implementation.
- **Keep PRs narrow and reviewable** when a maintainer asks for one: one issue,
  one behavior change, a filled PR template, and exact verification evidence.
- **Report security issues privately** through the policy in
  [SECURITY.md](./SECURITY.md). Do not open public PRs or public issues for
  security reports.

## Independence Day PR Event

Allow-listed event PRs should follow the repository template and include:

- linked issue, bead, spec, or maintainer request
- short summary of the behavior change
- scoped file-level changes
- local verification commands and results
- risks, rollout notes, and follow-up issues

`main` is protected. Use a short-lived branch, keep the PR draft until local
verification is recorded, and expect CI plus maintainer review before merge.
OpenCoven familiars and in-house agents should also follow
[AGENTS.md](./AGENTS.md) and
[`docs/workflows/beads-familiars.md`](./docs/workflows/beads-familiars.md).

## Questions

If something is unclear or you think your change should be considered as an
exception, please file an issue rather than opening a PR. The maintainer
will respond there.
