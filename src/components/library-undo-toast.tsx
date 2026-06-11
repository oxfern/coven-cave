"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/lib/icon";

type Props = {
  label: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
};

export function LibraryUndoToast({ label, onUndo, onDismiss, durationMs = 4000 }: Props) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());
  const rafRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [durationMs]);

  return (
    <div
      className="library-undo-toast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="library-undo-toast-content">
        <Icon name="ph:trash" className="library-undo-toast-icon" aria-hidden />
        <span className="library-undo-toast-label">
          Deleted <strong>{label}</strong>
        </span>
        <button
          className="library-undo-toast-undo"
          onClick={onUndo}
          aria-label={`Undo delete ${label}`}
        >
          Undo
        </button>
        <button
          className="library-undo-toast-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <Icon name="ph:x-bold" aria-hidden />
        </button>
      </div>
      <div
        className="library-undo-toast-progress"
        style={{ width: `${progress}%` }}
        aria-hidden
      />
    </div>
  );
}
