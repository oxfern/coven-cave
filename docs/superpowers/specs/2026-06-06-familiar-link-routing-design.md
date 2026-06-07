# Familiar-driven link routing — design spec

**Date:** 2026-06-06
**Status:** Design approved; awaiting written-spec review before implementation plan.
**Scope:** v1 — chat, browser, and /save adapters; heuristic-first classifier with familiar fallback; unified timeline view with group-by-source toggle. RSS adapter contract defined but not built.

## Context

The Library view ships today with three sub-lists (Bookmarks, Reading, GitHub) backed by JSON files under `~/.openclaw/workspace/sage/library/`. Each list has full CRUD endpoints. Every item in the schema already carries a `familiar` field — but every route hardcodes it to `"sage"`. There is no automated ingestion: a link only lands in a list if the user opens the existing modal and types it in.

This spec adds:

1. Four **ingestion adapters** — chat-message scanning, browser-pane "Save", `/save` slash command, and a (stubbed for v2) RSS/feed adapter.
2. A **link classifier** — a five-tier deterministic rule table that decides Bookmarks vs Reading vs GitHub, with a small familiar-fallback call for ambiguous hosts only.
3. **Per-familiar attribution + source context** — items record who routed them and from where (chat session + turn id, browser tab, slash invocation, feed item).
4. A **unified timeline view** — a new "All" tab in the Library that shows every link across the three lists, with a group-by-source toggle and a familiar filter.

The shared library directory stays put (`~/.openclaw/workspace/sage/library/`). No data migration. Existing per-list tabs and views keep working untouched.

## Architecture

```
┌────────────────────┐
│ chat-view scan     │──┐
├────────────────────┤  │
│ browser-pane Save  │──┤        POST /api/library/route-link             ┌──────────────────┐
├────────────────────┤  │       ┌──────────────────────────────┐          │ bookmarks.json   │
│ /save slash cmd    │──┼──→    │ URL classifier (heuristic)   │──→ writes├──────────────────┤
├────────────────────┤  │       │ ↓ ambiguous → familiar call  │          │ reading.json     │
│ RSS / GH feed (v2) │──┘       └──────────────────────────────┘          ├──────────────────┤
└────────────────────┘                                                    │ github.json      │
                                                                          │ .index.json (new)│
                                                                          └──────────────────┘
                                                                                    │
                                                                                    ▼
                                                          GET /api/library/all (new unified read)
                                                                                    │
                                                                                    ▼
                                                            LibraryView (timeline default, group-by-source toggle)
```

### Module boundaries (one purpose each)

- **`src/lib/link-classifier.ts`** — pure: `(url) → ClassifyResult`. No I/O.
- **`src/lib/link-extractor.ts`** — pure: `(text) → URL[]`. Strips code blocks, image targets, localhost/file URLs.
- **`src/lib/familiar-classify.ts`** — async: `(url, context, familiar) → ClassifyResult`. Only called when the classifier returns `rule: "familiar-fallback"`.
- **`src/lib/library-store.ts`** (new — extracted from the three existing `library/*` routes) — `appendBookmark`, `appendReading`, `appendGithub`, `readIndex`, `writeIndex`, in-memory mutex.
- **`src/lib/slash-save-parser.ts`** — pure: `(args: string) → { url, listHint?, tags }`.
- **`src/app/api/library/route-link/route.ts`** (new) — POST endpoint composing classifier + store.
- **`src/app/api/library/all/route.ts`** (new) — GET unified timeline read.
- **`src/components/library-timeline.tsx`** (new) — the new "All" view.
- **`src/components/library-timeline-row.tsx`** (new) — row template reused in both groupings.

### Adapter call sites (where each ingestion fires)

| Adapter | File touched | Trigger |
|---|---|---|
| chat-scan (in) | `src/app/api/chat/send/route.ts` | On POST, extract URLs from user prompt, fire-and-forget `routeLink` |
| chat-scan (out) | `src/app/api/chat/send/route.ts` | At stream completion, extract URLs from assistant text, fire-and-forget `routeLink` |
| browser-pane Save | `src/components/browser-pane.tsx` | New `<IconButton>` in toolbar, click → `routeLink` |
| `/save` slash | `src/lib/slash-commands.ts` + composer dispatcher | Slash command entry; uses `slash-save-parser` |
| RSS / feed (v2) | `src/lib/feed-adapter.ts` (stub only) | Contract defined; poller not built |

## Data model

### New shared `LinkCapture` block on every item type

```ts
// src/lib/library-types.ts
export type LinkSource =
  | { kind: "chat";    sessionId: string; turnId: string; chatTitle: string }
  | { kind: "browser"; tabUrl: string; tabTitle: string }
  | { kind: "slash";   originSessionId: string | null }
  | { kind: "feed";    feedId: string; feedTitle: string }
  | { kind: "manual" };

export type LinkCapture = {
  source: LinkSource;
  familiar: string;        // who routed it
  capturedAt: string;      // ISO; primary sort key in the unified timeline
  classifier: {
    rule: "github" | "article-host" | "paper-host" | "video-host" | "default-bookmark" | "familiar-fallback";
    confidence: "high" | "low";
  };
};
```

### Extension of each item type

```ts
export type LibraryBookmark = { /* unchanged */, capture?: LinkCapture };
export type LibraryReadingItem = { /* unchanged */, capture?: LinkCapture };
export type LibraryGitHubItem = { /* unchanged */, capture?: LinkCapture };
```

`capture` is **optional** on disk. Items that predate this spec render in the timeline without source pill / familiar face. Items written by the new endpoint always populate `capture` *and* the existing top-level `familiar` field (for backward compatibility). UI prefers `capture.familiar` when present.

### `.index.json` (new dedup index)

```jsonc
// ~/.openclaw/workspace/sage/library/.index.json
{
  "version": 1,
  "entries": [
    { "url": "https://github.com/foo/bar", "sessionId": "s-123", "turnId": "t-7", "list": "github", "itemId": "gh_..." },
    ...
  ]
}
```

Rebuilt from the three list files if missing or corrupt.

## The classifier

`classifyLink(url): ClassifyResult` runs five tiers, first match wins:

| Tier | Match | Result | Confidence |
|---|---|---|---|
| 1. GitHub | `host === "github.com"` or ends `.github.com` | `list: "github"` + `parseGitHubUrl()` | high |
| 2. Paper hosts | `host ∈ { arxiv.org, paperswithcode.com, nature.com, sciencemag.org, aclanthology.org, openreview.net, semanticscholar.org }` | `list: "reading"`, `readingKind: "paper"` | high |
| 3. Video hosts | `host ∈ { youtube.com, youtu.be, vimeo.com, loom.com }` | `list: "reading"`, `readingKind: "video"` | high |
| 4. Article hosts | `host` matches `*.substack.com` / `*.medium.com` / `dev.to` / `hashnode.dev` / starts with `blog.` OR `path` contains `/blog/`, `/posts/`, `/articles/` | `list: "reading"`, `readingKind: "article"` | high |
| 5. Ambiguous hosts | `host ∈ { twitter.com, x.com, news.ycombinator.com, reddit.com }` | `rule: "familiar-fallback"` — caller awaits `classifyWithFamiliar` | low |
| Default | anything else | `list: "bookmarks"` | low |

Each tier's allowlist is a `const` array at the top of `link-classifier.ts`. Adding a host is a one-line PR.

### Familiar fallback

Fires *only* on Tier 5. Calls the active familiar's harness with this prompt:

> Given URL `<url>` and the surrounding context `<200-char snippet>`, classify as one of:
> - **(a)** bookmark — a tool, landing page, or reference site
> - **(b)** reading — an article, paper, thread, or video meant to be consumed
> - **(c)** github — a github.com URL
>
> Reply with one letter only.

Maps `a/b/c` → `bookmarks/reading/github`. Returns `confidence: "low"`, `rule: "familiar-fallback"`. Failure modes (timeout > 3 s, garbage reply, daemon offline, `c` answer for non-github URL) all default to bookmarks.

### Title sourcing (no server-side fetch in v1)

- **GitHub** — `parseGitHubUrl` gives `owner/repo` and `#number`; use that.
- **Reading** — last path segment, kebab → Title Case (`/blog/relay-routing-deep-dive` → `Relay Routing Deep Dive`). Falls back to domain.
- **Bookmarks** — domain (existing behavior).

User can rename via existing per-list edit affordances. Server-side HTML fetching is explicitly out of scope (timeout / cookie / redirect surface area not worth v1).

## Ingestion adapters

### "Active familiar" — definition shared across adapters

Three adapters refer to "the active familiar." The value used depends on the source:

- **chat-scan** — the familiar bound to the chat session being sent. Always present (every chat has a familiar). Source of truth: the `familiarId` already on the `/api/chat/send` request body.
- **browser-pane** and **`/save`** — whichever familiar is currently selected in the workspace right pane (`activeFamiliarId` in `workspace.tsx` state). If no familiar is selected, the action falls back to the first familiar in the list. If the list is empty, the adapter surfaces a toast "Pick a familiar in the right rail first" and does not call `routeLink`.
- **feed (v2)** — the feed configuration specifies which familiar owns the feed; that familiar is recorded on every routed item.

### Chat-scan — `/api/chat/send`

- **Inbound:** `extractLinks(prompt)` → for each URL, fire-and-forget `routeLink({ url, source: { kind: "chat", sessionId, turnId: <userTurnId>, chatTitle }, familiar: familiarId })`. Doesn't block the send.
- **Outbound:** at stream completion, same extraction over the assistant text with `turnId: <assistantTurnId>`.

**Failure handling for chat-scan specifically:** every `routeLink` call from `/api/chat/send` is wrapped in `try / catch`. Any error (network, write failure, 503 busy) is logged to the server console and swallowed. Chat-scan failures must never affect the chat stream or surface as a user-visible error — they're best-effort by design.

`extractLinks(text)` (`src/lib/link-extractor.ts`):
- Strips fenced code blocks (```` ```...``` ````) and inline backtick spans.
- Strips markdown image targets `![alt](url)`.
- Skips `localhost`, `127.0.0.1`, `file://`, anything that fails `new URL(...)`.
- Returns absolute URLs only, deduped within the input.

### Browser-pane Save

New `<IconButton icon="ph:bookmark-simple" aria-label="Save to library">` in the browser toolbar, left of the daemon-status pill.

- Click → `routeLink({ url: currentTabUrl, source: { kind: "browser", tabUrl, tabTitle }, familiar: activeFamiliarId })`.
- After success: icon swaps to `ph:check-bold` for 3 s; `<Tooltip label="Saved to <list>">`.
- After dedup: icon swaps to `ph:bookmark-simple-fill`; `<Tooltip label="Already in <list>">`.
- Disabled when `tabUrl == null`.

### `/save` slash command

Add to `SLASH_COMMANDS`:

```ts
{ name: "/save", aliases: ["/bookmark", "/read"], hint: "/save <url> [tag tag]", description: "Route a URL into the library (auto-classified)" }
```

Argument forms:
- `/save https://...` — heuristic routes it.
- `/save https://... reading` — explicit list hint overrides classifier.
- `/save https://... #ai #papers` — tags only.

Parser: `slashSaveParse(args: string) → { url, listHint?, tags } | { error: "url_required" }` in `src/lib/slash-save-parser.ts`. Composer dispatcher calls `routeLink({ url, source: { kind: "slash", originSessionId }, familiar: activeFamiliarId, tags })` with optional `listHint` short-circuiting the classifier.

### RSS / feed adapter (v2 — contract only)

```ts
// src/lib/feed-adapter.ts — stub
export type FeedItem = { url: string; title: string; feedId: string; feedTitle: string };
export async function routeFeedItem(item: FeedItem, familiar: string): Promise<RouteResult> {
  return routeLink({ url: item.url, source: { kind: "feed", feedId: item.feedId, feedTitle: item.feedTitle }, familiar });
}
```

Type exported, function body throws `not_implemented`. v2 polls feeds and calls this.

## The endpoints

### `POST /api/library/route-link`

Request:
```ts
{ url: string; source: LinkSource; familiar: string; tags?: string[]; listHint?: "bookmarks"|"reading"|"github" }
```

Behavior:
1. Parse URL; reject `400 { error: "invalid_url" }` on failure.
2. Acquire library-store mutex.
3. Read `.index.json`. If `(url, source.sessionId ?? null, source.turnId ?? null)` already routed → release mutex, return `200 { ok: true, deduped: true, item }`.
4. If `listHint` provided, skip classifier and use it as the list.
5. Else `classify = classifyLink(url)`. If `classify.rule === "familiar-fallback"`, `classify = await classifyWithFamiliar(url, context, familiar)` (3 s budget; on failure default to bookmarks).
6. Build the item (with `capture` populated; legacy `item.familiar` set to the same value).
7. Append to the appropriate list file via `library-store`.
8. Append dedup entry to `.index.json`.
9. Release mutex.
10. Return `200 { ok: true, deduped: false, item, classify }`.

Errors:
- `400 invalid_url`
- `500 write_failed` (with in-memory rollback)
- `503 busy` (mutex held > 5 s; adapter retries once with jitter)

### `GET /api/library/all`

Request: optional `?familiar=<id>&list=<bookmarks|reading|github>&since=<ISO>` query params.

Behavior: reads the three list files, normalizes each entry into a `TimelineEntry`, filters per query, returns sorted desc by `capturedAt` (falling back to per-type timestamp for legacy items).

```ts
export type TimelineEntry = {
  list: "bookmarks" | "reading" | "github";
  item: LibraryBookmark | LibraryReadingItem | LibraryGitHubItem;
  capturedAt: string;       // normalized
  familiar: string | null;  // from capture.familiar OR legacy item.familiar
  source: LinkSource | null;
};
```

Response: `{ ok: true, entries: TimelineEntry[] }`.

## UI

### LibraryView changes

- Extend `LibrarySectionKind` to include `"all"`.
- Make `"all"` the default landing (currently `"docs"`).
- Collection rail order: All / Bookmarks / Reading / GitHub / Docs / Skills.
- All five existing sections keep working unchanged.

### `library-timeline.tsx` (new)

State:
```ts
{ groupBy: "date" | "source",
  familiarFilter: string | "all",
  listFilter: "all" | "bookmarks" | "reading" | "github",
  search: string }
```

Fetches from `GET /api/library/all` on mount + when filter changes.

Toolbar uses `<ViewHeader>`:
- **eyebrow** "LIBRARY"
- **title** "All"
- **search** `<SearchInput>` placeholder `Search links — try sage: cody: chat: github:`
- **filters** two `<Popover>` chips: Familiar (dropdown of `Familiar[]` + "all") and Group toggle ("date" / "source")
- **actions** `<IconButton icon="ph:plus" aria-label="Add link manually">` opens the existing manual-add modal

### `library-timeline-row.tsx` (new)

Grid: `[list-pill 20px] [title + meta (familiar face + source pill)] [classifier badge] [time]`

- **list-pill** colored per list (uses `--bg-raised` / `--color-success-soft` / `--accent-presence-soft` for B/R/G), Phosphor icon inside (`ph:bookmark-simple`, `ph:book-open`, `ph:github-logo`).
- **familiar face** `<FamiliarGlyph>` size 14, color-coded per familiar.
- **source pill** plain-text styled subtly:
  - `chat "<chatTitle>"` (chat source)
  - `/save (browser)` (slash from inside chat)
  - `Save button` (browser source)
  - `RSS · <feedTitle>` (feed source — v2)
- **classifier badge** color-coded by `capture.classifier.rule`:
  - `auto-routed` — default low-visibility chip
  - `paper-host` / `article-host` / `video-host` — specific rule names
  - `<Familiar> guessed` — for `familiar-fallback`, includes the familiar's display name
  - `manual` for legacy items without a `capture`
- **time** relative ("2m", "1d", "3w")

Click → opens preview in the existing `<LibraryDocPreview>` slot. The preview's `SelectedItem` union already supports `{kind:"bookmark"|"reading"|"github", item}`; we just route timeline-row clicks to those.

### Empty / loading states

- **Empty:** `<EmptyState icon="ph:link" headline="No links yet" subtitle="Drop a URL in any chat, hit Save in the browser, or run /save in the composer." />`
- **Loading:** `<SkeletonRows count={6} />`

### Keyboard

- `↑ / ↓` row selection
- `Enter` opens preview
- `f` focuses familiar filter
- (optional) `g s` chord toggles group-by-source

## Errors

| Failure | Behavior |
|---|---|
| Invalid URL parse | `routeLink` returns 400; UI shows toast, chat-scan silent |
| Duplicate `(url, sessionId, turnId)` | 200 `deduped: true`; UI silent for chat-scan, "Already in X" for browser/slash |
| `.index.json` corrupt | Rebuilt from the three list files; log warning |
| Concurrent write race | In-memory mutex serializes; pattern matches existing `__escalationsWriteChain` |
| Disk write fails | 500 `write_failed`; in-memory append rolled back |
| Familiar fallback timeout > 3 s | Default to bookmarks, `rule: "familiar-fallback"` |
| Familiar returns garbage | Same as timeout |
| Familiar says `c` (github) for non-github URL | Reject, default to bookmarks |
| Daemon offline | Skip familiar call entirely; default to bookmarks |
| Chat-scan URL inside code block | `extractLinks` filters it out |
| Malformed URL (`https://`) | 400, chat-scan logs and continues |
| Browser Save with no tab loaded | Button disabled when `tabUrl == null` |
| `/save` no URL | Toast: `Usage: /save <url> [tag tag]` |
| Legacy item (no `capture`) | Row renders without source pill / familiar face; badge shows `manual` |
| `library-store` mutex held > 5 s | 503 `busy`; adapter retries once with jitter |

## Testing

Six test files, matching repo conventions (`@ts-nocheck` + `node --test --experimental-strip-types`).

1. **`src/lib/link-classifier.test.ts`** — fixture table, ~30 cases including case-insensitivity, query strings, fragments, edge hosts.
2. **`src/lib/link-extractor.test.ts`** — fixture table covering fenced code blocks, inline backticks, image targets, localhost/file rejection, dedup-within-input.
3. **`src/lib/familiar-classify.test.ts`** — mocked harness: happy a/b/c, timeout (4 s mock vs 3 s budget), garbage reply, offline, mismatched-c-for-non-github.
4. **`src/app/api/library/route-link.test.ts`** — integration with temp library dir. Asserts: classify-and-write, dedup, familiar-fallback-with-mock, error responses.
5. **`src/lib/slash-save-parser.test.ts`** — fixture table for the three argument forms + error cases.
6. **Wiring tests (regex-source, matching `chat-view-polish.test.ts` pattern):**
   - `library-timeline.test.ts` — imports `<ViewHeader>`, `<SearchInput>`, `<Popover>`, `<EmptyState>`; calls `GET /api/library/all`.
   - `chat-send-routes-links.test.ts` — `src/app/api/chat/send/route.ts` calls `routeLink` for prompt + assistant text.
   - `browser-pane-save.test.ts` — `browser-pane.tsx` renders `<IconButton icon="ph:bookmark-simple" aria-label="Save to library">`.

### Out of automated scope (manual smoke)

- xterm + browser-pane interaction for the Save button
- Visual regression on the timeline rows (capture via `scripts/capture-screenshots.mjs` in a follow-up)
- Real-harness latency on the familiar fallback
- The RSS adapter (v2)

## Verification (end-to-end, what "done" means)

1. `pnpm typecheck` clean.
2. All six test files pass.
3. With `NEXT_PUBLIC_DEMO=true pnpm dev`:
   - Paste `https://arxiv.org/abs/2603.12345` in a chat. Inspect `reading.json` — new entry with `capture.source.kind === "chat"` and `capture.classifier.rule === "paper-host"`.
   - Navigate browser-pane to `https://example.com`, click Save. Inspect `bookmarks.json` — new entry with `capture.source.kind === "browser"`.
   - Run `/save https://github.com/foo/bar` in composer. Inspect `github.json` — new entry with `capture.source.kind === "slash"`.
   - Open Library → All. See the three entries in the timeline, newest first, each with list pill + familiar face + source pill + classifier badge.
   - Toggle "Group: source". See the three entries regrouped under source headings.
4. `rg "familiar: \"sage\"" src/app/api/library/` returns zero.
5. Existing per-list tabs (Bookmarks / Reading / GitHub) still load and CRUD normally.

## What's explicitly out of scope for v1

- **Backfill of existing chat history.** Only turns posted after this ships get scanned.
- **Server-side title fetching** of HTML pages. Titles come from URL paths.
- **Cross-source URL merge.** Same URL routed from chat and from browser stays as two items — the source context differs.
- **RSS / GitHub-feed polling.** Contract defined; poller is v2.
- **"Undo route" affordance** beyond the existing per-list delete button.
- **Daemon-level link extraction.** Coven session events are not touched.

## Critical files to touch

**New:**
- `src/lib/link-classifier.ts`
- `src/lib/link-extractor.ts`
- `src/lib/familiar-classify.ts`
- `src/lib/library-store.ts`
- `src/lib/slash-save-parser.ts`
- `src/lib/feed-adapter.ts` (stub)
- `src/app/api/library/route-link/route.ts`
- `src/app/api/library/all/route.ts`
- `src/components/library-timeline.tsx`
- `src/components/library-timeline-row.tsx`
- Six test files listed above.

**Modified:**
- `src/lib/library-types.ts` — add `LinkCapture`, `LinkSource`, optional `capture` on each item type.
- `src/lib/slash-commands.ts` — add `/save` entry.
- `src/app/api/chat/send/route.ts` — invoke `routeLink` for prompt + assistant text.
- `src/app/api/library/bookmarks/route.ts` / `reading/route.ts` / `github/route.ts` — stop hardcoding `familiar: "sage"`; accept `capture` and `familiar` in POST body; refactor storage helpers out into `library-store.ts`.
- `src/components/browser-pane.tsx` — add Save `<IconButton>`.
- `src/components/library-view.tsx` — add `"all"` section, make it default, route to new `<LibraryTimeline>`.
- `src/components/library-collection-rail.tsx` — show All entry first.
- (composer slash dispatcher) — wire `/save` to `slash-save-parser` + `routeLink`.

## Risk + sequencing notes

- **Largest risk** is the chat-send route. It already streams; adding two `routeLink` calls (fire-and-forget) on the inbound prompt and at stream complete needs care not to break the existing happy path. Mitigation: both calls are wrapped in `try/catch` so a route-link failure can never affect the chat stream.
- **Second risk** is the dedup index. If `.index.json` is wrong, items either get duplicated (slight UX bug, user can delete) or skipped (silent loss). Mitigation: the index is rebuildable from the three source files; on corrupt-read, rebuild and continue.
- **Sequencing for the implementation plan:**
  1. Schema + library-store extract (no behavior change, just refactor).
  2. Classifier + extractor pure functions + tests.
  3. `route-link` endpoint + integration test.
  4. `library/all` endpoint + timeline component.
  5. Three adapters wired (chat, browser, slash) — order doesn't matter, can parallelize.
  6. Stop hardcoding `"sage"` in the three existing routes (cleanup).
  7. Familiar fallback (`familiar-classify` + Tier 5 wiring) — can ship after the rest if needed.
