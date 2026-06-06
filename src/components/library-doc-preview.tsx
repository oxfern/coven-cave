"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/lib/icon";
import type { LibraryDocBody } from "@/lib/library-types";

type Props = {
  doc: LibraryDocBody | null;
  loading: boolean;
};

const dateFmt = new Intl.DateTimeFormat([], { year: "numeric", month: "short", day: "numeric" });

function fmtDate(iso: string): string {
  try { return dateFmt.format(new Date(iso)); } catch { return iso; }
}

// ---------------------------------------------------------------------------
// Markdown rendering (same pattern as MarkdownBlock in message-bubble.tsx)
// ---------------------------------------------------------------------------

type MdToHtmlFn = (md: string) => Promise<string>;
let mdToHtmlCached: MdToHtmlFn | null = null;

async function getMdToHtml(): Promise<MdToHtmlFn> {
  if (mdToHtmlCached) return mdToHtmlCached;
  const { renderAsync } = await import("@create-markdown/preview");
  const { parse } = await import("@create-markdown/core");
  mdToHtmlCached = async (markdown: string) => {
    const blocks = parse(markdown);
    return renderAsync(blocks);
  };
  return mdToHtmlCached;
}

function RenderedMarkdown({ text }: { text: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!text) { setHtml(null); return; }
    let cancelled = false;
    void (async () => {
      const fn = await getMdToHtml();
      const raw = await fn(text);
      if (cancelled) return;
      // Sanitize: strip script/iframe/on* attrs
      const doc = new DOMParser().parseFromString(raw, "text/html");
      for (const el of Array.from(doc.querySelectorAll("script, iframe, object, embed, link, style"))) el.remove();
      for (const el of Array.from(doc.querySelectorAll<HTMLElement>("*"))) {
        for (const attr of Array.from(el.attributes)) {
          if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
          if ((attr.name === "href" || attr.name === "src") && /^\s*javascript:/i.test(attr.value)) {
            el.removeAttribute(attr.name);
          }
        }
      }
      setHtml(doc.body.innerHTML);
    })();
    return () => { cancelled = true; };
  }, [text]);

  if (!html) {
    return (
      <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-[var(--text-secondary)]">
        {text}
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      className="cave-md library-preview-md"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LibraryDocPreview({ doc, loading }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopyPath() {
    if (!doc) return;
    const fullPath = `${process.env.HOME ?? "~"}/.openclaw/workspace/sage/${doc.id}`;
    navigator.clipboard.writeText(fullPath).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => undefined);
  }

  if (loading) {
    return (
      <div className="library-preview library-preview--empty">
        <span className="library-preview-empty-text">Loading…</span>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="library-preview library-preview--empty">
        <Icon name="ph:book-open" width={32} className="library-preview-empty-icon" />
        <span className="library-preview-empty-text">Select a document to preview</span>
      </div>
    );
  }

  return (
    <div className="library-preview">
      {/* Metadata header */}
      <div className="library-preview-header">
        <div className="library-preview-title">{doc.title}</div>
        <div className="library-preview-meta">
          <span className="library-preview-familiar">🌿 Sage</span>
          <span className="library-preview-sep">·</span>
          <span className="library-preview-date">{fmtDate(doc.modifiedAt)}</span>
          {doc.tags.length > 0 && (
            <>
              <span className="library-preview-sep">·</span>
              <div className="library-preview-tags">
                {doc.tags.map((tag) => (
                  <span key={tag} className="library-doclist-tag">{tag}</span>
                ))}
              </div>
            </>
          )}
        </div>
        {Object.keys(doc.frontmatter).filter((k) => !["tags", "tag"].includes(k)).length > 0 && (
          <div className="library-preview-frontmatter">
            {Object.entries(doc.frontmatter)
              .filter(([k]) => !["tags", "tag"].includes(k))
              .map(([k, v]) => (
                <span key={k} className="library-preview-fm-entry">
                  <span className="library-preview-fm-key">{k}:</span>{" "}
                  <span className="library-preview-fm-val">{v}</span>
                </span>
              ))}
          </div>
        )}
        <div className="library-preview-actions">
          <button
            type="button"
            className="library-preview-action-btn"
            onClick={handleCopyPath}
            title="Copy full path to clipboard"
          >
            <Icon name={copied ? "ph:check" : "ph:copy"} width={13} />
            <span>{copied ? "Copied!" : "Open in editor"}</span>
          </button>
        </div>
      </div>

      {/* Rendered body */}
      <div className="library-preview-body">
        <RenderedMarkdown text={doc.body} />
      </div>
    </div>
  );
}
