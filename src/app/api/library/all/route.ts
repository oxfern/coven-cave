import { NextRequest, NextResponse } from "next/server";
import { createLibraryStore } from "@/lib/library-store";
import type {
  LibraryBookmark, LibraryReadingItem, LibraryGitHubItem, LinkSource,
} from "@/lib/library-types";

export type TimelineEntry = {
  list: "bookmarks" | "reading" | "github";
  item: LibraryBookmark | LibraryReadingItem | LibraryGitHubItem;
  capturedAt: string;
  familiar: string | null;
  source: LinkSource | null;
};

function timestampOf(
  list: "bookmarks" | "reading" | "github",
  item: LibraryBookmark | LibraryReadingItem | LibraryGitHubItem,
): string {
  if (item.capture?.capturedAt) return item.capture.capturedAt;
  if (list === "reading") return (item as LibraryReadingItem).addedAt;
  return (item as LibraryBookmark | LibraryGitHubItem).savedAt;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const familiarFilter = url.searchParams.get("familiar");
  const listFilter = url.searchParams.get("list") as TimelineEntry["list"] | null;
  const since = url.searchParams.get("since");

  const store = createLibraryStore();
  const [bookmarks, reading, github] = await Promise.all([
    store.readBookmarks(), store.readReading(), store.readGithub(),
  ]);

  const all: TimelineEntry[] = [
    ...bookmarks.map((item) => ({ list: "bookmarks" as const, item,
      capturedAt: timestampOf("bookmarks", item),
      familiar: item.capture?.familiar ?? item.familiar ?? null,
      source: item.capture?.source ?? null })),
    ...reading.map((item) => ({ list: "reading" as const, item,
      capturedAt: timestampOf("reading", item),
      familiar: item.capture?.familiar ?? item.familiar ?? null,
      source: item.capture?.source ?? null })),
    ...github.map((item) => ({ list: "github" as const, item,
      capturedAt: timestampOf("github", item),
      familiar: item.capture?.familiar ?? item.familiar ?? null,
      source: item.capture?.source ?? null })),
  ];

  const filtered = all
    .filter((e) => !familiarFilter || familiarFilter === "all" || e.familiar === familiarFilter)
    .filter((e) => !listFilter || listFilter === ("all" as any) || e.list === listFilter)
    .filter((e) => !since || e.capturedAt >= since)
    .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));

  return NextResponse.json({ ok: true, entries: filtered });
}
