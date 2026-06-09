// @ts-nocheck
import assert from "node:assert/strict";
import { cleanSalemMarkdown } from "./salem-clean.ts";

// 1. <Cards>/<Card /> blocks → markdown link list (existing contract).
{
  const input = [
    "<Cards>",
    "  <Card title=\"Getting Started\" href=\"/docs/guide/getting-started\" description=\"Set up your first familiar in minutes.\" />",
    "  <Card title=\"Concepts\" href=\"/docs/guide/concepts\" description=\"Understand how Coven works at its core.\" />",
    "</Cards>",
  ].join("\n");
  const out = cleanSalemMarkdown(input);
  assert.match(out, /- \[Getting Started\]\(\/docs\/guide\/getting-started\) — Set up your first familiar in minutes\./);
  assert.match(out, /- \[Concepts\]\(\/docs\/guide\/concepts\) — Understand how Coven works at its core\./);
  assert.doesNotMatch(out, /<Cards>/);
  assert.doesNotMatch(out, /<Card\s/);
}

// 2. <Mermaid chart="..." /> with multi-line attribute must be stripped wholesale.
{
  const input = [
    "## Architecture",
    "",
    "<Mermaid",
    "  chart=\"`",
    "flowchart LR",
    "  UI[CastCodes UI] --> Agent[Cast Agent]",
    "  Agent --> Gateway[Coven Gateway]",
    "`\"",
    "/>",
    "",
    "Some prose after.",
  ].join("\n");
  const out = cleanSalemMarkdown(input);
  assert.doesNotMatch(out, /<Mermaid/, "Mermaid opener must not leak");
  assert.doesNotMatch(out, /flowchart LR/, "raw mermaid chart body must be stripped with the tag");
  assert.doesNotMatch(out, /chart=/, "attribute value must not leak as plain text");
  assert.match(out, /## Architecture/);
  assert.match(out, /Some prose after\./);
}

// 3. <DocsDataTable> with multi-line array attributes must not leak as raw text.
{
  const input = [
    "<DocsDataTable",
    "  caption=\"Coven differentiators\"",
    "  searchPlaceholder=\"Filter differentiators...\"",
    "  columns=\"[",
    "  { key: 'pillar', label: 'Pillar' },",
    "]\"",
    "  rows=\"[",
    "  { pillar: '**Persistent familiars**' },",
    "]\"",
    "/>",
    "",
    "Trailing prose.",
  ].join("\n");
  const out = cleanSalemMarkdown(input);
  assert.doesNotMatch(out, /<DocsDataTable/);
  assert.doesNotMatch(out, /Coven differentiators/, "attribute string contents must go with the tag");
  assert.doesNotMatch(out, /Persistent familiars/);
  assert.match(out, /Trailing prose\./);
}

// 4. <GraphView />, <HubCards /> and other self-closing PascalCase components.
{
  const input = [
    "## Docs Map",
    "",
    "<GraphView graph=\"buildGraph()\" />",
    "",
    "<HubCards href=\"/docs/familiars\" />",
    "",
    "After.",
  ].join("\n");
  const out = cleanSalemMarkdown(input);
  assert.doesNotMatch(out, /<GraphView/);
  assert.doesNotMatch(out, /<HubCards/);
  assert.doesNotMatch(out, /buildGraph/);
  assert.match(out, /## Docs Map/);
  assert.match(out, /After\./);
}

// 5. Wrapping components (e.g. <Callout>...</Callout>) — preserve inner prose.
{
  const input = [
    "<Callout type=\"warn\">",
    "Watch out for stale caches.",
    "</Callout>",
  ].join("\n");
  const out = cleanSalemMarkdown(input);
  assert.doesNotMatch(out, /<Callout/);
  assert.doesNotMatch(out, /<\/Callout>/);
  assert.match(out, /Watch out for stale caches\./, "inner prose of wrapping components must survive");
}

// 6. Truncated/dangling tag at end of reply (800-char retrieval cut).
{
  const input = "Some prose.\n\n<Mermaid\n  chart=\"`\nflowchart LR\n  UI --> Agent";
  const out = cleanSalemMarkdown(input);
  assert.doesNotMatch(out, /<Mermaid/, "dangling opener (no closing >) must be scrubbed");
  assert.match(out, /Some prose\./);
}

// 7. MDX import/export lines that occasionally leak from the source.
{
  const input = [
    "import { Mermaid } from 'fumadocs-ui/components/mermaid';",
    "export const meta = { title: 'Foo' };",
    "",
    "# Heading",
    "",
    "Body.",
  ].join("\n");
  const out = cleanSalemMarkdown(input);
  assert.doesNotMatch(out, /import \{ Mermaid/);
  assert.doesNotMatch(out, /export const meta/);
  assert.match(out, /# Heading/);
  assert.match(out, /Body\./);
}

// 8. MDX block comments {/* ... */} must be stripped.
{
  const input = "Before.\n{/* TODO: rewrite */}\nAfter.";
  const out = cleanSalemMarkdown(input);
  assert.doesNotMatch(out, /TODO: rewrite/);
  assert.doesNotMatch(out, /\{\/\*/);
  assert.match(out, /Before\./);
  assert.match(out, /After\./);
}

// 9. Heading anchors like " [#docs-map]" continue to be stripped.
{
  const input = "## Docs Map [#docs-map]\n\nBody.";
  const out = cleanSalemMarkdown(input);
  assert.match(out, /## Docs Map\n/);
  assert.doesNotMatch(out, /\[#docs-map\]/);
}

// 10. Real-world HTML (lowercase tag names) must not be eaten.
{
  const input = "Some <em>emphasis</em> and a <code>snippet</code>.";
  const out = cleanSalemMarkdown(input);
  assert.match(out, /<em>emphasis<\/em>/, "standard inline HTML must survive");
  assert.match(out, /<code>snippet<\/code>/);
}

console.log("✅  Salem markdown cleaner tests passed (10 sections)");
