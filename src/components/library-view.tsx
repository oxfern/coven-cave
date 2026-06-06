"use client";

import "@/styles/library.css";
import { useCallback, useEffect, useState } from "react";
import { LibraryCollectionRail } from "@/components/library-collection-rail";
import { LibraryDocList } from "@/components/library-doc-list";
import { LibraryDocPreview } from "@/components/library-doc-preview";
import type { LibraryCollection, LibraryDoc, LibraryDocBody } from "@/lib/library-types";

export function LibraryView() {
  const [activeCollection, setActiveCollection] = useState("all");
  const [collections, setCollections] = useState<LibraryCollection[]>([]);
  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<LibraryDocBody | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadDocs = useCallback(async (collectionId: string) => {
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

  useEffect(() => {
    void loadDocs(activeCollection);
  }, [activeCollection, loadDocs]);

  const handleSelectDoc = useCallback(async (doc: LibraryDoc) => {
    setPreviewLoading(true);
    try {
      // Build full path from id (relative to SAGE_ROOT)
      const res = await fetch(
        `/api/library/doc?id=${encodeURIComponent(doc.id)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (json.ok) {
        setSelectedDoc(json.doc as LibraryDocBody);
      }
    } catch {
      /* no-op */
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  // Build doc counts per collection (use total docs for "all", 0 for others until loaded)
  const docCounts: Record<string, number> = { all: docs.length };

  return (
    <div className="library-shell">
      {/* Left rail: collection picker */}
      <LibraryCollectionRail
        collections={collections}
        activeId={activeCollection}
        docCounts={docCounts}
        onSelect={(id) => {
          setActiveCollection(id);
          setSearchQuery("");
        }}
      />

      {/* Divider */}
      <div className="library-divider" />

      {/* Middle: document list */}
      <LibraryDocList
        docs={docs}
        selectedId={selectedDoc?.id ?? null}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelect={handleSelectDoc}
        loading={loading}
      />

      {/* Divider */}
      <div className="library-divider" />

      {/* Right: document preview */}
      <LibraryDocPreview doc={selectedDoc} loading={previewLoading} />
    </div>
  );
}
