"use client";

import type { ReactNode } from "react";

export type ViewHeaderProps = {
  /** Plain string or composed node. Eyebrow + title use the meta slot. */
  title: ReactNode;
  /** Tiny uppercase label above the title (e.g. "BOARD", "LIBRARY"). */
  eyebrow?: ReactNode;
  /** Centered search slot — typically a <SearchInput>. */
  search?: ReactNode;
  /** Filter chips, view-mode toggles, etc. Sits left of actions. */
  filters?: ReactNode;
  /** Right-aligned action buttons. */
  actions?: ReactNode;
  className?: string;
};

export function ViewHeader({ title, eyebrow, search, filters, actions, className }: ViewHeaderProps) {
  return (
    <header className={["ui-view-header", className ?? ""].filter(Boolean).join(" ")}>
      <div className="ui-view-header-meta">
        {eyebrow ? <div className="ui-view-header-eyebrow">{eyebrow}</div> : null}
        <div className="ui-view-header-title">
          <span className="ui-view-header-title-text">{title}</span>
        </div>
      </div>
      {search ? <div className="ui-view-header-search">{search}</div> : null}
      {filters ? <div className="ui-view-header-filter">{filters}</div> : null}
      {actions ? <div className="ui-view-header-actions">{actions}</div> : null}
    </header>
  );
}
