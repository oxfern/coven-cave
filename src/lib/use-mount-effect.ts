"use client";

import { useEffect, type EffectCallback } from "react";

/** Runs a one-time external-system synchronization when a component mounts. */
export function useMountEffect(effect: EffectCallback) {
  useEffect(effect, []);
}
