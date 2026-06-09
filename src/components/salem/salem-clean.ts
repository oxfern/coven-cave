// Strip MDX/JSX leakage out of Salem replies (raw <Cards>, <Mermaid>,
// <DocsDataTable>, <HubCards>, <GraphView>, MDX import/export, MDX
// {/* comments */}, heading anchors, etc.) and convert <Cards>/<Card />
// blocks into clean markdown link lists.
//
// Salem's replies come from llms-full.txt, which is the MDX docs corpus with
// component tags preserved. Without sanitization those tags render as broken
// markup in the chat panel — especially the `<Mermaid chart="...">` blocks
// whose multi-line attribute values dump raw flowchart syntax into the
// message body. The 800-char retrieval truncation also frequently slices
// tags in half, leaving dangling openers.

export function cleanSalemMarkdown(text: string): string {
  function cardToLink(attrs: string): string | null {
    const title = /\btitle="([^"]*)"/.exec(attrs)?.[1];
    const href = /\bhref="([^"]*)"/.exec(attrs)?.[1];
    const desc = /\bdescription="([^"]*)"/.exec(attrs)?.[1];
    if (!title || !href) return null;
    return `- [${title}](${href})${desc ? ` — ${desc}` : ""}`;
  }

  // 1. <Cards>…</Cards> → markdown link list (extract every child <Card />).
  text = text.replace(/<Cards>([\s\S]*?)<\/Cards>/g, (_match, inner: string) => {
    const links: string[] = [];
    const cardRe = /<Card\s+([^>]*?)\/?>/g;
    let m: RegExpExecArray | null;
    while ((m = cardRe.exec(inner)) !== null) {
      const link = cardToLink(m[1]);
      if (link) links.push(link);
    }
    return links.length ? links.join("\n") : "";
  });

  // 2. Self-closing <Card .../> that escaped a <Cards> wrapper → link item.
  text = text.replace(/<Card\s+([^>]*?)\/>/g, (_m, attrs: string) => cardToLink(attrs) ?? "");

  // 3. MDX import/export statements ("import { Mermaid } from '...';").
  text = text.replace(/^\s*(?:import|export)\s[^\n]*$/gm, "");

  // 4. MDX comments: {/* ... */}.
  text = text.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  // 5. Self-closing PascalCase JSX components: <Foo … />.
  //    [^<>]*? prevents the lazy match from swallowing a sibling tag when
  //    the `/>` got truncated off the end.
  text = text.replace(/<[A-Z][A-Za-z0-9]*\b[^<>]*?\/>/g, "");

  // 6. Opening PascalCase JSX tags: <Foo …> (matching closing tag stripped in 7).
  text = text.replace(/<[A-Z][A-Za-z0-9]*\b[^<>]*?>/g, "");

  // 7. Closing PascalCase JSX tags: </Foo>.
  text = text.replace(/<\/[A-Z][A-Za-z0-9]*\s*>/g, "");

  // 8. Dangling PascalCase opener at end-of-text (no closing `>` at all —
  //    happens when retrieval truncates mid-tag at ~800 chars).
  text = text.replace(/<[A-Z][A-Za-z0-9]*\b[^<>]*$/g, "");

  // 9. Heading anchors like " [#docs-map]" after heading text.
  text = text.replace(/\s\[#[\w-]+\]/g, "");

  // 10. Collapse 3+ consecutive blank lines that the stripping left behind.
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}
