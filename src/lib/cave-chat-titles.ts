type SessionLike = {
  id: string;
  title: string;
};

export const MAX_CHAT_TITLE_LENGTH = 120;

export function normalizeChatTitle(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const title = input.trim().replace(/\s+/g, " ");
  if (!title) return null;
  return title.slice(0, MAX_CHAT_TITLE_LENGTH);
}

export function mergeSessionTitleOverrides<T extends SessionLike>(
  sessions: T[],
  titles: Record<string, string | undefined>,
): T[] {
  return sessions.map((session) => {
    const title = normalizeChatTitle(titles[session.id]);
    return title ? { ...session, title } : session;
  });
}
