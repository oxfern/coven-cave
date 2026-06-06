export type LibraryCollection = {
  id: string;
  label: string;
  path: string;
  glob?: string;
};

export type LibraryDoc = {
  id: string;            // relative path from workspace sage root
  title: string;         // first H1 or filename stem
  familiar: string;      // always "sage" for Phase 1
  collection: string;
  modifiedAt: string;    // ISO
  tags: string[];        // from frontmatter `tags:` or empty
  excerpt: string;       // first ~200 chars of body, stripped of markdown
};

export type LibraryDocBody = LibraryDoc & {
  body: string;
  frontmatter: Record<string, string>;
};
