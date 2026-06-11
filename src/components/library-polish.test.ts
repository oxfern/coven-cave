// @ts-nocheck
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const bookmarks = await readFile(new URL("./library-bookmarks-list.tsx", import.meta.url), "utf8");
const reading   = await readFile(new URL("./library-reading-list.tsx",   import.meta.url), "utf8");
const github    = await readFile(new URL("./library-github-list.tsx",    import.meta.url), "utf8");
const bookmarksRoute = await readFile(new URL("../app/api/library/bookmarks/route.ts", import.meta.url), "utf8");

// ───────── Task 1: localeCompare null-guards ─────────
// bookmarks — title, domain, savedAt
assert.match(bookmarks, /\(a\.title \?\? ""\)\.localeCompare\(b\.title \?\? ""\)/,    "bookmarks title null-guard");
assert.match(bookmarks, /\(a\.domain \?\? ""\)\.localeCompare\(b\.domain \?\? ""\)/,  "bookmarks domain null-guard");
assert.match(bookmarks, /\(a\.savedAt \?\? ""\)\.localeCompare\(b\.savedAt \?\? ""\)/,"bookmarks savedAt null-guard");
assert.match(bookmarks, /function bookmarkTags\(item: LibraryBookmark\): string\[\]/, "bookmarks normalize tag arrays before grouping/searching");
assert.match(bookmarks, /const domain = displayDomain\(item\);[\s\S]{0,120}const keys = by === "domain" \? \[domain\] : \(tags\.length > 0 \? tags : \["\(untagged\)"\]\);/, "bookmarks group by a display-safe domain");
assert.match(bookmarksRoute, /function normalizeBookmark\(item: Partial<LibraryBookmark>\): LibraryBookmark/, "bookmarks API normalizes legacy bookmark records");
assert.match(bookmarksRoute, /const domain = cleanString\(item\.domain\) \|\| \(url \? domainFrom\(url\) : "\(unknown\)"\);/, "bookmarks API backfills missing domains");

// reading — title, addedAt, label
assert.match(reading, /\(a\.title \?\? ""\)\.localeCompare\(b\.title \?\? ""\)/,     "reading title null-guard");
assert.match(reading, /\(a\.addedAt \?\? ""\)\.localeCompare\(b\.addedAt \?\? ""\)/, "reading addedAt null-guard");
assert.match(reading, /\(a\.label \?\? ""\)\.localeCompare\(b\.label \?\? ""\)/,     "reading label null-guard");

const libraryCss = await readFile(new URL("../styles/library.css", import.meta.url), "utf8");
assert.match(
  reading,
  /className="board-table-title library-reading-title"/,
  "reading titles should opt into library-specific wrapping instead of the shared one-line board title style",
);
assert.match(
  libraryCss,
  /\.library-reading-title\s*\{[\s\S]*?-webkit-line-clamp:\s*2[\s\S]*?white-space:\s*normal/,
  "reading titles should wrap and clamp at two visible lines",
);

// github — title, repo, savedAt
assert.match(github, /\(a\.title \?\? ""\)\.localeCompare\(b\.title \?\? ""\)/,   "github title null-guard");
assert.match(github, /\(a\.repo \?\? ""\)\.localeCompare\(b\.repo \?\? ""\)/,     "github repo null-guard");
assert.match(github, /\(a\.savedAt \?\? ""\)\.localeCompare\(b\.savedAt \?\? ""\)/,"github savedAt null-guard");

// ───────── Task 2: Timeline placeholder shortened ─────────
const timeline = await readFile(new URL("./library-timeline.tsx", import.meta.url), "utf8");
assert.match(timeline, /placeholder="Search links…"/, "Timeline placeholder must be 'Search links…'");
assert.match(timeline, /title="Search links — try chat: github: sage:"/, "Verbose hint must live in title=");
assert.doesNotMatch(timeline, /placeholder="Search links — try chat: github: sage:"/, "Old long placeholder must be removed");

// ───────── Task 3: Lists "All" renamed to "Timeline" ─────────
const rail = await readFile(new URL("./library-collection-rail.tsx", import.meta.url), "utf8");
assert.match(rail, /\{ id: "all",\s+label: "Timeline",\s+icon: "ph:link" \}/, "STATIC_LIST_SECTIONS first row label must be 'Timeline'");

// ───────── Task 4: Section-aware preview empty state ─────────
const preview = await readFile(new URL("./library-doc-preview.tsx", import.meta.url), "utf8");
const view    = await readFile(new URL("./library-view.tsx",        import.meta.url), "utf8");

assert.match(preview, /LibrarySectionKind[\s\S]{0,200}?from "@\/lib\/library-types"/, "LibrarySectionKind must be imported from library-types");
assert.match(preview, /const EMPTY_TEXT: Record<LibrarySectionKind, string> = \{/, "EMPTY_TEXT typed Record<LibrarySectionKind, string>");
for (const section of ["all", "docs", "bookmarks", "reading", "github", "projects", "skills"]) {
  assert.ok(new RegExp(`${section}:\\s*"Select`).test(preview), `EMPTY_TEXT entry for ${section}`);
}
assert.match(preview, /activeSection \? EMPTY_TEXT\[activeSection\] : "Select an item to preview"/, "Empty render uses EMPTY_TEXT[activeSection]");
assert.match(view, /<LibraryDocPreview\s+selected=\{selectedItem\}\s+loading=\{previewLoading\}\s+activeSection=\{activeSection\}/, "library-view passes activeSection");

// ───────── Task 5: [ shortcut toggles list panel ─────────
const view2 = await readFile(new URL("./library-view.tsx", import.meta.url), "utf8");
assert.match(view2, /if \(e\.key !== "\["\) return;/, "library-view must filter keydown events for '['");
assert.match(view2, /setListPinned\(\(v\) => !v\)/, "library-view must call setListPinned((v) => !v)");
assert.match(view2, /\["input", "textarea", "select"\]\.includes\(tag\)/, "library-view must skip when focus is in an input");

console.log("library-polish.test.ts: ok");

// ── Reading list fit (narrow panel) ──
assert.match(
  reading,
  /className="board-table library-reading-table"/,
  "Reading table carries its own class so narrow-container rules can scope to it",
);
assert.match(
  libraryCss,
  /overflow-wrap: break-word;/,
  "Reading titles wrap at word boundaries instead of shattering mid-word",
);
assert.match(
  libraryCss,
  /\.library-list-shell \{\s*container-type: inline-size;/,
  "List shell is a size container so the table adapts to the panel, not the viewport",
);
assert.match(
  libraryCss,
  /@container \(max-width: 560px\) \{[\s\S]*?\.library-reading-table th:nth-child\(4\)/,
  "Narrow panels drop the Type/Progress columns so Title keeps the space",
);

// ── Projects section owns the full canvas (was: ComuxView crushed into the
//    narrow list panel while an empty doc preview hogged the width) ──
assert.match(
  view,
  /activeSection === "projects" \? \([\s\S]{0,200}<ComuxView/,
  "Projects renders in the dominant full-canvas branch, not the list panel",
);
assert.match(
  view,
  /activeSection !== "graph" && activeSection !== "skills" && activeSection !== "projects" &&/,
  "List panel is hidden while Projects is active",
);

// ── Browse-first empty canvas ──
assert.match(
  view,
  /const showBrowseCanvas = selectedItem === null && activeSection !== "graph" && activeSection !== "skills" && activeSection !== "projects"/,
  "When no library item is selected, the dominant center canvas should become the browse list instead of an empty placeholder",
);
assert.match(
  view,
  /showBrowseCanvas \? \([\s\S]{0,160}<div className="library-browse-canvas">[\s\S]{0,160}renderLibraryListContent\(\)/,
  "Browse canvas should render the active list content in the center pane",
);
assert.match(
  view,
  /activeSection !== "graph" && activeSection !== "skills" && activeSection !== "projects" && !showBrowseCanvas &&/,
  "Right list panel should be hidden while the center browse canvas is active",
);
assert.match(
  libraryCss,
  /\.library-browse-canvas\s*\{[\s\S]*?flex:\s*1;[\s\S]*?overflow:\s*hidden;/,
  "Center browse canvas should own the available library width without overflowing",
);
assert.match(
  libraryCss,
  /\.library-browse-content\s*\{[\s\S]*?width:\s*100%;[\s\S]*?border-inline:\s*0;/,
  "Browse list content should fill the full center pane instead of being capped to a narrow column",
);
assert.doesNotMatch(
  libraryCss,
  /\.library-browse-content\s*\{[\s\S]*?width:\s*min\(920px,\s*100%\)/,
  "Browse list content should not be constrained to the old centered 920px column",
);

// ── Vertical overflow boundaries ──
assert.match(
  libraryCss,
  /\.library-browse-canvas\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden;/,
  "Browse canvas should be height-bounded so its list content can scroll vertically",
);
assert.match(
  libraryCss,
  /\.library-browse-content\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?min-height:\s*0;/,
  "Browse content should preserve a min-height-zero flex chain for timeline and table lists",
);
assert.match(
  libraryCss,
  /\.library-list-shell\s*\{[\s\S]*?flex:\s*1;[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden;/,
  "Saved-list shells should stay bounded inside the library and delegate scrolling to their body",
);
assert.match(
  libraryCss,
  /\.library-list-shell \.board-table-wrap\s*\{[\s\S]*?flex:\s*1;[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*auto;/,
  "Library table wrappers should own vertical overflow without relying on board.css import order",
);
assert.match(
  libraryCss,
  /\.library-timeline\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden;/,
  "Timeline shell should clamp overflow so only the timeline scroll pane moves",
);
assert.match(
  libraryCss,
  /\.library-timeline-scroll\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/,
  "Timeline scroll pane should be the vertical scroll owner",
);
assert.match(
  libraryCss,
  /\.library-preview-body\s*\{[\s\S]*?flex:\s*1;[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/,
  "Document preview body should be height-bounded and vertically scrollable",
);
assert.match(
  libraryCss,
  /\.library-reader-body\s*\{[\s\S]*?flex:\s*1;[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/,
  "Reader modal body should keep long documents inside the modal scrollport",
);
