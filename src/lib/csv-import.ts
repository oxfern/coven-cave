import type { LibraryBookmark, LibraryReadingItem, LibraryGitHubItem } from "./library-types";

// ── CSV Parser (no external deps) ───────────────────────────────

export function parseCsv(raw: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCsvRow(lines[0] ?? "");
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i] ?? "");
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j] ?? ""] = cells[j] ?? "";
    }
    rows.push(row);
  }

  return { headers, rows };
}

/** Parse a single CSV row, handling quoted fields with embedded commas/newlines. */
function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      i++; // skip opening quote
      let cell = "";
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++; // skip closing quote
          break;
        } else {
          cell += line[i];
          i++;
        }
      }
      // Skip comma
      if (line[i] === ",") i++;
      cells.push(cell);
    } else {
      // Unquoted field
      const end = line.indexOf(",", i);
      if (end === -1) {
        cells.push(line.slice(i).trim());
        break;
      }
      cells.push(line.slice(i, end).trim());
      i = end + 1;
    }
  }
  // If line ended with comma, add empty cell
  if (line.endsWith(",")) cells.push("");
  return cells;
}

// ── Target list detection ────────────────────────────────────────

export type CsvTargetList = "bookmarks" | "reading" | "github" | "unknown";

const normalize = (s: string) => s.toLowerCase().replace(/[_\s-]/g, "");

export function detectTargetList(headers: string[]): CsvTargetList {
  const norm = headers.map(normalize);

  const hasUrl = norm.some((h) => ["url", "link", "href"].includes(h));
  const hasTitle = norm.some((h) => ["title", "name"].includes(h));
  const hasAuthor = norm.some((h) => ["author", "writer"].includes(h));
  const hasStatus = norm.some((h) => h === "status");
  const hasSourceType = norm.some((h) => ["sourcetype", "type", "format"].includes(h));
  const hasRepo = norm.some((h) => ["repo", "repository"].includes(h));
  const hasNumber = norm.some((h) => ["number", "issue", "issuenumber", "pr"].includes(h));

  if (hasRepo && hasNumber) return "github";
  if (hasUrl && (hasAuthor || hasStatus || hasSourceType)) return "reading";
  if (hasUrl && hasTitle) return "bookmarks";
  if (hasTitle && (hasAuthor || hasStatus)) return "reading";
  return "unknown";
}

// ── Column mapping ───────────────────────────────────────────────

export type ColumnMapping = {
  targetList: CsvTargetList;
  fieldMappings: Record<string, string>; // libraryFieldName → csvColumnName
};

/** Suggest best-guess column mapping given detected target list and CSV headers. */
export function suggestMapping(headers: string[], targetList: CsvTargetList): ColumnMapping {
  const find = (candidates: string[]): string => {
    const norm = headers.map(normalize);
    for (const c of candidates) {
      const idx = norm.indexOf(normalize(c));
      if (idx !== -1) return headers[idx] ?? "";
    }
    return "";
  };

  if (targetList === "bookmarks") {
    return {
      targetList,
      fieldMappings: {
        url:   find(["url", "link", "href"]),
        title: find(["title", "name", "label"]),
        notes: find(["notes", "description", "note", "comment"]),
        tags:  find(["tags", "tag", "categories", "category"]),
      },
    };
  }

  if (targetList === "reading") {
    return {
      targetList,
      fieldMappings: {
        title:      find(["title", "name"]),
        url:        find(["url", "link", "href"]),
        author:     find(["author", "writer", "by"]),
        sourceType: find(["sourceType", "type", "format", "kind"]),
        status:     find(["status", "state"]),
        notes:      find(["notes", "description", "note", "comment"]),
        tags:       find(["tags", "tag", "categories"]),
      },
    };
  }

  if (targetList === "github") {
    return {
      targetList,
      fieldMappings: {
        url:   find(["url", "link", "href"]),
        title: find(["title", "name"]),
        repo:  find(["repo", "repository"]),
        kind:  find(["kind", "type"]),
        notes: find(["notes", "description", "note"]),
      },
    };
  }

  return { targetList: "unknown", fieldMappings: {} };
}

// ── Build library items from rows ────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function cell(row: Record<string, string>, col: string): string {
  return (col ? (row[col] ?? "") : "").trim();
}

export function buildBookmarksFromCsv(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  familiar: string,
): LibraryBookmark[] {
  const m = mapping.fieldMappings;
  return rows
    .filter((row) => cell(row, m["url"] ?? ""))
    .map((row): LibraryBookmark => {
      const url = cell(row, m["url"] ?? "");
      let domain = "";
      try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { domain = url; }
      return {
        id: generateId("bm"),
        url,
        title: cell(row, m["title"] ?? "") || domain,
        domain,
        notes: cell(row, m["notes"] ?? "") || undefined,
        tags: cell(row, m["tags"] ?? "").split(/[,;]/).map((t) => t.trim()).filter(Boolean),
        savedAt: new Date().toISOString(),
        familiar,
      };
    });
}

export function buildReadingItemsFromCsv(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  familiar: string,
): LibraryReadingItem[] {
  const m = mapping.fieldMappings;
  const validStatus = new Set(["want-to-read", "reading", "done", "abandoned"]);
  const validSource = new Set(["article", "paper", "book", "thread", "video", "other"]);

  return rows
    .filter((row) => cell(row, m["title"] ?? ""))
    .map((row): LibraryReadingItem => {
      const rawStatus = cell(row, m["status"] ?? "").toLowerCase();
      const rawSource = cell(row, m["sourceType"] ?? "").toLowerCase();
      return {
        id: generateId("rd"),
        title: cell(row, m["title"] ?? ""),
        url: cell(row, m["url"] ?? "") || undefined,
        author: cell(row, m["author"] ?? "") || undefined,
        sourceType: (validSource.has(rawSource) ? rawSource : "article") as LibraryReadingItem["sourceType"],
        status: (validStatus.has(rawStatus) ? rawStatus : "want-to-read") as LibraryReadingItem["status"],
        notes: cell(row, m["notes"] ?? "") || undefined,
        tags: cell(row, m["tags"] ?? "").split(/[,;]/).map((t) => t.trim()).filter(Boolean),
        addedAt: new Date().toISOString(),
        familiar,
      };
    });
}

export function buildGitHubItemsFromCsv(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  familiar: string,
): LibraryGitHubItem[] {
  const m = mapping.fieldMappings;
  const validKind = new Set(["repo", "issue", "pr", "discussion"]);

  return rows
    .filter((row) => cell(row, m["url"] ?? "") || cell(row, m["repo"] ?? ""))
    .map((row): LibraryGitHubItem => {
      const url = cell(row, m["url"] ?? "");
      const rawKind = cell(row, m["kind"] ?? "").toLowerCase();
      return {
        id: generateId("gh"),
        url,
        title: cell(row, m["title"] ?? "") || url,
        repo: cell(row, m["repo"] ?? ""),
        kind: (validKind.has(rawKind) ? rawKind : "repo") as LibraryGitHubItem["kind"],
        labels: [],
        notes: cell(row, m["notes"] ?? "") || undefined,
        savedAt: new Date().toISOString(),
        familiar,
      };
    });
}

// ── Quick CSV detection (for paste/drop heuristic) ───────────────

/**
 * Returns true if the text looks like CSV content:
 * - 3+ lines
 * - first line has 2+ commas
 */
export function looksLikeCsv(text: string): boolean {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 3) return false;
  const firstLine = lines[0] ?? "";
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  return commaCount >= 2;
}
