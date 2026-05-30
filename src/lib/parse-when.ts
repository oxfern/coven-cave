import type { Recurrence } from "@/lib/cave-inbox";

export type ParsedWhen = {
  fireAt: string;
  recurrence: Recurrence;
};

const RE_IN = /^in\s+(\d+)\s*(s|sec|secs|m|min|mins|h|hr|hrs|d|day|days)\b/i;
const RE_TODAY = /^today\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?\b/i;
const RE_TOMORROW = /^tomorrow\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?\b/i;
const RE_AT = /^at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?\b/i;

function unitMs(unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith("s")) return 1_000;
  if (u.startsWith("m")) return 60_000;
  if (u.startsWith("h")) return 3_600_000;
  if (u.startsWith("d")) return 86_400_000;
  return 0;
}

function normalizeHour(h: number, ampm: string | undefined): number {
  if (!ampm) return h;
  const lower = ampm.toLowerCase();
  if (lower === "am") return h === 12 ? 0 : h;
  return h === 12 ? 12 : h + 12;
}

/**
 * Phase 1 parser. Recognized:
 *   in 5s | in 5m | in 2h | in 1d
 *   today 9am | today 17:30
 *   tomorrow 9am | tomorrow 17:30
 *   at 9am | at 17:30  (today if still future, else tomorrow)
 *
 * Returns null on no match — caller should fall back to explicit inputs.
 */
export function parseWhen(input: string, now: Date = new Date()): ParsedWhen | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  const inMatch = text.match(RE_IN);
  if (inMatch) {
    const n = Number(inMatch[1]);
    const ms = unitMs(inMatch[2]);
    if (!Number.isFinite(n) || ms === 0) return null;
    const fireAt = new Date(now.getTime() + n * ms).toISOString();
    return { fireAt, recurrence: { type: "none" } };
  }

  const todayMatch = text.match(RE_TODAY);
  if (todayMatch) {
    const h = normalizeHour(Number(todayMatch[1]), todayMatch[3]);
    const m = Number(todayMatch[2] ?? 0);
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= now.getTime()) return null; // already past
    return { fireAt: d.toISOString(), recurrence: { type: "none" } };
  }

  const tomMatch = text.match(RE_TOMORROW);
  if (tomMatch) {
    const h = normalizeHour(Number(tomMatch[1]), tomMatch[3]);
    const m = Number(tomMatch[2] ?? 0);
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(h, m, 0, 0);
    return { fireAt: d.toISOString(), recurrence: { type: "none" } };
  }

  const atMatch = text.match(RE_AT);
  if (atMatch) {
    const h = normalizeHour(Number(atMatch[1]), atMatch[3]);
    const m = Number(atMatch[2] ?? 0);
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
    return { fireAt: d.toISOString(), recurrence: { type: "none" } };
  }

  return null;
}

/**
 * Splits a "/remind" body into a when-phrase and the reminder text.
 * Greedy: tries the longest leading token sequence that parses; falls back
 * to no-when (returns null + full text).
 */
export function splitWhenAndText(
  body: string,
  now: Date = new Date(),
): { when: ParsedWhen | null; text: string } {
  const trimmed = body.trim();
  if (!trimmed) return { when: null, text: "" };
  const tokens = trimmed.split(/\s+/);
  for (let i = Math.min(tokens.length, 5); i >= 1; i--) {
    const candidate = tokens.slice(0, i).join(" ");
    const when = parseWhen(candidate, now);
    if (when) {
      const text = tokens.slice(i).join(" ").trim();
      return { when, text };
    }
  }
  return { when: null, text: trimmed };
}
