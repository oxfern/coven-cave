"use client";

import { useState, type HTMLAttributes } from "react";

export type SeparatorHandleProps = HTMLAttributes<HTMLDivElement> & {
  orientation: "col" | "row";
};

/**
 * Thin wrapper for resizable separators. Gives a visible hover affordance,
 * the right cursor, and a wider hit area than the 1px line.
 *
 * Note: react-resizable-panels' <Separator> already handles drag events.
 * This component is purely the visual layer — render it as the Separator's
 * child, or use it standalone when wrapping a custom drag handler.
 */
export function SeparatorHandle({
  orientation,
  className,
  onMouseDown,
  ...rest
}: SeparatorHandleProps) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      role="separator"
      aria-orientation={orientation === "col" ? "vertical" : "horizontal"}
      className={[
        "ui-sep-handle",
        orientation === "col" ? "ui-sep-handle--col" : "ui-sep-handle--row",
        dragging ? "ui-sep-handle--dragging" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseDown={(e) => {
        setDragging(true);
        const onUp = () => {
          setDragging(false);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mouseup", onUp);
        onMouseDown?.(e);
      }}
      {...rest}
    />
  );
}
