"use client";

import "@/styles/library.css";
import { useCallback, useEffect, useState } from "react";
import { LibraryCollectionRail } from "@/components/library-collection-rail";
import { LibraryDocList } from "@/components/library-doc-list";
import { LibraryDocPreview } from "@/components/library-doc-preview";
import { LibraryBookmarksList } from "@/components/library-bookmarks-list";
import { LibraryReadingList } from "@/components/library-reading-list";
import { LibraryGitHubList } from "@/components/library-github-list";
import type {
  LibraryCollection,
  LibraryDoc,
  LibraryDocBody,
  LibrarySectionKind,
} from "@/lib/library-types";

// Section ids that are research collection ids (from API)
function isDocSection(id: string): boolean {
  return !["bookmarks", "reading", "github"].includes(id);
}

export function LibraryView() {
  const [activeSection, setActiveSection] = useState<string>("all");
  const [collections, setCollections] = useState<LibraryCollection[]>([]);
  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<LibraryDocBody | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadDocs = useCallback(async (collectionId: string) => {
    if (!isDocSection(collectionId)) return;
    setLoading(true);
    setSelectedDoc(null);
    try {
      const res = await fetch(`/api/library?collection=${encodeURIComponent(collectionId)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json.ok) {
        setDocs(json.docs ?? []);
        if (json.collections?.length) setCollections(json.collections);
      } else {
        setDocs([]);
      }
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load collections list once on mount (for the rail)
  useEffect(() => {
    void loadDocs("all");
  }, [loadDocs]);

  useEffect(() => {
    if (isDocSection(activeSection)) {
      void loadDocs(activeSection);
    } else {
      setDocs([]);
      setSelectedDoc(null);
    }
    setSearchQuery("");
  }, [activeSection, loadDocs]);

  const handleSelectDoc = useCallback(async (doc: LibraryDoc) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(
        `/api/library/doc?id=${encodeURIComponent(doc.id)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (json.ok) setSelectedDoc(json.doc as LibraryDocBody);
    } catch {
      /* no-op */
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const docCounts: Record<string, number> = { all: docs.length };

  return (
    <div className="library-shell">
      <LibraryCollectionRail
        collections={collections}
        activeId={activeSection}
        docCounts={docCounts}
        onSelect={(id) => setActiveSection(id)}
      />

      <div className="library-divider" />

      {/* Middle pane — dispatch by section */}
      {activeSection === "bookmarks" ? (
        <LibraryBookmarksList
          selectedId={null}
          onSelect={() => {}}
        />
      ) : activeSection === "reading" ? (
        <LibraryReadingList
          selectedId={null}
          onSelect={() => {}}
        />
      ) : activeSection === "github" ? (
        <LibraryGitHubList
          selectedId={null}
          onSelect={() => {}}
        />
      ) : (
        <LibraryDocList
          docs={docs}
          selectedId={selectedDoc?.id ?? null}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelect={handleSelectDoc}
          loading={loading}
        />
      )}

      <div className="library-divider" />

      {/* Right pane — only for doc sections; list sections own their own detail */}
      {isDocSection(activeSection) && (
        <LibraryDocPreview doc={selectedDoc} loading={previewLoading} />
      )}
    </div>
  );
}
