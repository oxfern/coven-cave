"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type Placement = "top" | "bottom";

export type TooltipProps = {
  label: ReactNode;
  placement?: Placement;
  delay?: number;
  children: ReactElement;
};

/**
 * Lightweight tooltip. Wraps a single child element and shows the label
 * after `delay` ms of hover/focus. Closes on blur/leave/escape. Does not
 * attempt complex positioning — flips to top/bottom only.
 */
export function Tooltip({ label, placement = "top", delay = 300, children }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const isTop = placement === "top";
    setStyle({
      ...(isTop
        ? { top: r.top - 6, transform: "translate(-50%, -100%)" }
        : { top: r.bottom + 6, transform: "translate(-50%, 0)" }),
      left: r.left + r.width / 2,
    });
  }, [placement]);

  const show = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      place();
      setOpen(true);
    }, delay);
  }, [delay, place]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hide]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  if (!isValidElement(children)) return children;

  const childProps = children.props as Record<string, unknown>;
  const childRef = (children as unknown as { ref?: React.Ref<HTMLElement> }).ref;

  const merged = cloneElement(children as ReactElement<Record<string, unknown>>, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      if (typeof childRef === "function") childRef(node);
      else if (childRef && typeof childRef === "object") {
        (childRef as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    },
    onMouseEnter: (e: MouseEvent) => {
      (childProps.onMouseEnter as ((e: MouseEvent) => void) | undefined)?.(e);
      show();
    },
    onMouseLeave: (e: MouseEvent) => {
      (childProps.onMouseLeave as ((e: MouseEvent) => void) | undefined)?.(e);
      hide();
    },
    onFocus: (e: FocusEvent) => {
      (childProps.onFocus as ((e: FocusEvent) => void) | undefined)?.(e);
      show();
    },
    onBlur: (e: FocusEvent) => {
      (childProps.onBlur as ((e: FocusEvent) => void) | undefined)?.(e);
      hide();
    },
    "aria-describedby": open ? id : (childProps["aria-describedby"] as string | undefined),
  });

  return (
    <>
      {merged}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div id={id} role="tooltip" className="ui-tooltip" style={style}>
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
