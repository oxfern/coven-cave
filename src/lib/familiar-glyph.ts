/**
 * Familiar glyph model.
 *
 * A glyph is a Phosphor icon name (`ph:cat-fill`).
 *
 * The `ph:` prefix is the discriminator on the wire (in the legacy familiar
 * glyph field or the Cave-local override store). The `name` is intentionally a plain string:
 * chrome icons stay type-checked via `IconName` in `@/lib/icon`, but
 * user-picked icons can reference any of Phosphor's names without needing
 * each to land in the strict registry.
 */

import type { Familiar } from "@/lib/types";

export type FamiliarGlyph = { kind: "icon"; name: string };

/** Fallback rendered when no daemon icon and no override are present. */
export const DEFAULT_FAMILIAR_GLYPH: FamiliarGlyph = {
  kind: "icon",
  name: "ph:sparkle-fill",
};

/**
 * Parse a raw glyph string into a structured glyph. Only Phosphor icon names
 * are accepted; older non-icon values are ignored so the app stays
 * icon-only at render time. Empty / undefined returns null so the caller can
 * apply its own fallback.
 */
export function parseGlyphString(raw: string | undefined | null): FamiliarGlyph | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("ph:")) {
    return { kind: "icon", name: trimmed };
  }
  return null;
}

/** Serialize a glyph for storage (override store, or eventually familiars.toml). */
export function serializeGlyph(glyph: FamiliarGlyph): string {
  return glyph.name;
}

/**
 * Resolve the glyph to render for a familiar.
 *
 * Precedence (highest first):
 *   1. Cave-local override (`overrides[familiar.id]`) — picks that haven't
 *      finished syncing to the daemon yet, or that exist on this Cave only.
 *   2. Daemon-provided `familiar.icon` — the canonical source written by the
 *      `PUT /api/v1/familiars/{id}/icon` endpoint and persisted to TOML.
 *   3. Legacy daemon glyph field — accepted only when it already stores
 *      a `ph:` icon name; other values are ignored.
 *   4. `DEFAULT_FAMILIAR_GLYPH`.
 */
export function resolveFamiliarGlyph(
  familiar: Pick<Familiar, "id" | "emoji" | "icon">,
  overrides: Record<string, string>,
): FamiliarGlyph {
  const override = parseGlyphString(overrides[familiar.id]);
  if (override) return override;
  const daemonIcon = parseGlyphString(familiar.icon);
  if (daemonIcon) return daemonIcon;
  const daemonEmoji = parseGlyphString(familiar.emoji);
  if (daemonEmoji) return daemonEmoji;
  return DEFAULT_FAMILIAR_GLYPH;
}
