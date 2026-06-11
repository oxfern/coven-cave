"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const UNDO_WINDOW_MS = 4_000;

export type UndoEntry<T> = {
  id: string;       // unique key for this pending deletion
  item: T;          // the item being deleted, for potential restore
  label: string;    // human-readable name for toast copy
  deleteFn: () => Promise<void>;  // fires the actual DELETE
  timeoutId: ReturnType<typeof setTimeout>;
};

export function useUndoDelete<T>() {
  const [pending, setPending] = useState<UndoEntry<T> | null>(null);
  const pendingRef = useRef<UndoEntry<T> | null>(null);

  // keep ref in sync so cleanup can read the latest
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // flush on unmount — commit any pending delete
  useEffect(() => {
    return () => {
      const p = pendingRef.current;
      if (p) {
        clearTimeout(p.timeoutId);
        void p.deleteFn();
      }
    };
  }, []);

  const scheduleDelete = useCallback(
    (item: T, label: string, deleteFn: () => Promise<void>) => {
      // If there's already a pending delete, commit it immediately before scheduling the new one
      if (pendingRef.current) {
        clearTimeout(pendingRef.current.timeoutId);
        void pendingRef.current.deleteFn();
      }

      const id = `undo-${Date.now()}`;
      const timeoutId = setTimeout(() => {
        setPending(null);
        void deleteFn();
      }, UNDO_WINDOW_MS);

      const entry: UndoEntry<T> = { id, item, label, deleteFn, timeoutId };
      setPending(entry);
    },
    [],
  );

  const undo = useCallback(() => {
    if (!pendingRef.current) return;
    clearTimeout(pendingRef.current.timeoutId);
    setPending(null);
  }, []);

  const commit = useCallback(() => {
    if (!pendingRef.current) return;
    clearTimeout(pendingRef.current.timeoutId);
    void pendingRef.current.deleteFn();
    setPending(null);
  }, []);

  return { pending, scheduleDelete, undo, commit };
}
