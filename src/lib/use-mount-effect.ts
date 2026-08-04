"use client";

import { useEffect, type EffectCallback } from "react";

/** Runs a one-time external-system synchronization when a component mounts. */
export function useMountEffect(effect: EffectCallback): void {
  // The empty dependency list is the contract of this narrow escape hatch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}
