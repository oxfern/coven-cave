"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon, type IconName } from "@/lib/icon";

export type ListRowCardProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** Leading icon — picked via the resolution rules in skill-card.tsx etc. */
  icon?: IconName;
  /** Or supply a fully-rendered leading node (avatar, glyph, custom badge). */
  leading?: ReactNode;
  /** Primary name. */
  name: ReactNode;
  /** Optional uppercase meta chip after the name (e.g. version, harness). */
  meta?: ReactNode;
  /** One-line description below the name row. */
  description?: ReactNode;
  /** Trailing badge / status / count. */
  trailing?: ReactNode;
  /** Hover-revealed caret arrow. Default true. */
  showArrow?: boolean;
  selected?: boolean;
};

export const ListRowCard = forwardRef<HTMLButtonElement, ListRowCardProps>(function ListRowCard(
  {
    icon,
    leading,
    name,
    meta,
    description,
    trailing,
    showArrow = true,
    selected,
    className,
    type = "button",
    ...rest
  },
  ref,
) {
  const classes = [
    "ui-row-card",
    selected ? "ui-row-card--selected" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {leading ?? (icon ? (
        <span className="ui-row-card-icon" aria-hidden>
          <Icon name={icon} width={16} />
        </span>
      ) : null)}
      <div className="ui-row-card-body">
        <div className="ui-row-card-row">
          <span className="ui-row-card-name">{name}</span>
          {meta ? <span className="ui-row-card-meta">{meta}</span> : null}
        </div>
        {description ? <span className="ui-row-card-description">{description}</span> : null}
      </div>
      {(trailing || showArrow) && (
        <span className="ui-row-card-trailing">
          {trailing}
          {showArrow ? (
            <span className="ui-row-card-arrow" aria-hidden>
              <Icon name="ph:caret-right" width={12} />
            </span>
          ) : null}
        </span>
      )}
    </button>
  );
});
