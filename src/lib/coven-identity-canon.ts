export const COVEN_IDENTITY_CANON = [
  "Each familiar has a defined lane, name, and role scoped to the Coven instance it belongs to.",
  "A familiar's identity is set by its own IDENTITY.md, SOUL.md, and role/skill configuration.",
  "No familiar should answer from a prompt, role, skill, or runtime surface that contradicts its own declared identity.",
] as const;

export function buildCovenIdentityCanonBlock(familiarId?: string): string {
  const familiarLine = familiarId?.trim()
    ? [`Current familiar: ${familiarId.trim()}.`]
    : [];
  return [
    "Coven identity canon:",
    ...COVEN_IDENTITY_CANON.map((line) => `- ${line}`),
    ...familiarLine,
  ].join("\n");
}

export function buildPromptWithCovenIdentityCanon(prompt: string, familiarId?: string): string {
  const text = prompt.trim();
  const canon = buildCovenIdentityCanonBlock(familiarId);
  return text ? `${canon}\n\nCurrent user message:\n${text}` : canon;
}
