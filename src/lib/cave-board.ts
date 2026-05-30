import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";

const BOARD_PATH = path.join(homedir(), ".coven", "cave-board.json");

/** Column ids are arbitrary strings now — users can add their own. */
export type CardStatus = string;
export type CardPriority = "low" | "medium" | "high" | "urgent";

export type Card = {
  id: string;
  title: string;
  notes: string;
  status: CardStatus;
  priority: CardPriority;
  familiarId: string | null;
  sessionId: string | null;
  labels: string[];
  template?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Column = {
  id: string;
  label: string;
  accent?: string;
};

const DEFAULT_COLUMNS: Column[] = [
  { id: "inbox", label: "Inbox", accent: "border-sky-500/40" },
  { id: "running", label: "Running", accent: "border-emerald-500/60" },
  { id: "review", label: "Review", accent: "border-violet-500/60" },
];

export const PRIORITIES: CardPriority[] = ["urgent", "high", "medium", "low"];

type BoardFile = {
  version: number;
  columns: Column[];
  cards: Card[];
};

const EMPTY: BoardFile = { version: 2, columns: DEFAULT_COLUMNS, cards: [] };

async function ensureDir() {
  await mkdir(path.dirname(BOARD_PATH), { recursive: true });
}

export async function loadBoard(): Promise<BoardFile> {
  try {
    const raw = await readFile(BOARD_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<BoardFile>;
    return {
      version: parsed.version ?? 2,
      columns:
        Array.isArray(parsed.columns) && parsed.columns.length > 0
          ? parsed.columns
          : DEFAULT_COLUMNS,
      cards: Array.isArray(parsed.cards) ? parsed.cards : [],
    };
  } catch {
    return EMPTY;
  }
}

export async function saveBoard(board: BoardFile): Promise<void> {
  await ensureDir();
  await writeFile(BOARD_PATH, JSON.stringify(board, null, 2), "utf8");
}

export type NewCardInput = {
  title: string;
  notes?: string;
  status?: CardStatus;
  priority?: CardPriority;
  familiarId?: string | null;
  sessionId?: string | null;
  labels?: string[];
  template?: string | null;
};

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function createCard(input: NewCardInput): Promise<Card> {
  const board = await loadBoard();
  const now = new Date().toISOString();
  const card: Card = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    notes: (input.notes ?? "").trim(),
    status: input.status ?? board.columns[0]?.id ?? "inbox",
    priority: input.priority ?? "medium",
    familiarId: input.familiarId ?? null,
    sessionId: input.sessionId ?? null,
    labels: (input.labels ?? []).map((l) => l.trim()).filter(Boolean),
    template: input.template ?? null,
    createdAt: now,
    updatedAt: now,
  };
  board.cards.push(card);
  await saveBoard(board);
  return card;
}

export async function updateCard(
  id: string,
  patch: Partial<Omit<Card, "id" | "createdAt">>,
): Promise<Card | null> {
  const board = await loadBoard();
  const idx = board.cards.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const current = board.cards[idx];
  const next: Card = {
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
    labels: patch.labels
      ? patch.labels.map((l) => l.trim()).filter(Boolean)
      : current.labels,
  };
  board.cards[idx] = next;
  await saveBoard(board);
  return next;
}

export async function deleteCard(id: string): Promise<boolean> {
  const board = await loadBoard();
  const before = board.cards.length;
  board.cards = board.cards.filter((c) => c.id !== id);
  if (board.cards.length === before) return false;
  await saveBoard(board);
  return true;
}

export async function addColumn(label: string): Promise<Column> {
  const board = await loadBoard();
  const baseId = slug(label) || `col-${board.columns.length + 1}`;
  let id = baseId;
  let i = 2;
  while (board.columns.some((c) => c.id === id)) {
    id = `${baseId}-${i++}`;
  }
  const column: Column = { id, label: label.trim() };
  board.columns.push(column);
  await saveBoard(board);
  return column;
}

export async function deleteColumn(id: string): Promise<boolean> {
  const board = await loadBoard();
  const before = board.columns.length;
  board.columns = board.columns.filter((c) => c.id !== id);
  if (board.columns.length === before) return false;
  // Move cards out of the deleted column into the first remaining one
  const fallback = board.columns[0]?.id ?? "inbox";
  for (const card of board.cards) {
    if (card.status === id) card.status = fallback;
  }
  await saveBoard(board);
  return true;
}

export async function renameColumn(id: string, label: string): Promise<Column | null> {
  const board = await loadBoard();
  const col = board.columns.find((c) => c.id === id);
  if (!col) return null;
  col.label = label.trim();
  await saveBoard(board);
  return col;
}

export { BOARD_PATH, DEFAULT_COLUMNS };
