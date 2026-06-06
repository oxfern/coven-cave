"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DaemonConnectionState =
  | "connecting"    // initial; haven't heard back yet
  | "online"        // last health check succeeded
  | "reconnecting"  // was online, missed at least one poll
  | "offline";      // confirmed offline (missed N consecutive polls)

export type UseDaemonConnectionResult = {
  state: DaemonConnectionState;
  running: boolean;           // true only when state === "online"
  consecutiveFailures: number;
  lastSuccessAt: number | null; // ms timestamp
  retry: () => void;          // manual immediate retry
};

/**
 * Returns the next poll interval in ms based on consecutive failure count.
 *
 * Backoff schedule:
 *   0 failures  → 5 000 ms (online baseline)
 *   1 failure   → 5 000 ms (first miss; still "reconnecting")
 *   2–3         → 10 000 ms
 *   4–7         → 20 000 ms
 *   8+          → 30 000 ms (cap)
 */
function getInterval(consecutiveFailures: number): number {
  if (consecutiveFailures <= 1) return 5_000;
  if (consecutiveFailures <= 3) return 10_000;
  if (consecutiveFailures <= 7) return 20_000;
  return 30_000;
}

/**
 * Derive connection state from consecutive failure count.
 * Transitions to "offline" after 4 consecutive failures.
 * "reconnecting" covers 1–3 failures.
 */
function deriveState(
  failures: number,
  prevState: DaemonConnectionState,
): DaemonConnectionState {
  if (failures === 0) return "online";
  if (failures < 4) {
    // Never go from "offline" back to "reconnecting" without a real success
    if (prevState === "offline") return "offline";
    return prevState === "connecting" ? "connecting" : "reconnecting";
  }
  return "offline";
}

export function useDaemonConnection(opts?: {
  onOnline?: () => void;
  onOffline?: () => void;
}): UseDaemonConnectionResult {
  const [state, setState] = useState<DaemonConnectionState>("connecting");
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);

  // Stable refs to avoid stale closures in the polling loop
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const stateRef = useRef<DaemonConnectionState>("connecting");
  const failuresRef = useRef(0);
  const onOnlineRef = useRef(opts?.onOnline);
  const onOfflineRef = useRef(opts?.onOffline);

  // Keep callback refs current
  onOnlineRef.current = opts?.onOnline;
  onOfflineRef.current = opts?.onOffline;

  const scheduleNext = useCallback((failures: number) => {
    if (cancelledRef.current) return;
    const delay = getInterval(failures);
    timerRef.current = setTimeout(() => {
      if (!cancelledRef.current) {
        void poll(); // eslint-disable-line @typescript-eslint/no-use-before-define
      }
    }, delay);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const poll = useCallback(async () => {
    if (cancelledRef.current) return;

    // Cancel any pending timer (covers the retry() fast-path)
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3_000);
    let success = false;

    try {
      const res = await fetch("/api/daemon/status", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (res.ok) {
        const json = (await res.json()) as { running?: boolean };
        success = json.running === true;
      }
    } catch {
      success = false;
    } finally {
      clearTimeout(timeoutId);
    }

    if (cancelledRef.current) return;

    const prevState = stateRef.current;

    if (success) {
      const wasOfflineOrReconnecting =
        prevState === "reconnecting" || prevState === "offline";
      failuresRef.current = 0;
      setConsecutiveFailures(0);
      setLastSuccessAt(Date.now());
      stateRef.current = "online";
      setState("online");
      if (wasOfflineOrReconnecting || prevState === "connecting") {
        onOnlineRef.current?.();
      }
    } else {
      const newFailures = failuresRef.current + 1;
      failuresRef.current = newFailures;
      setConsecutiveFailures(newFailures);
      const nextState = deriveState(newFailures, prevState);
      stateRef.current = nextState;
      setState(nextState);
      if (nextState === "offline" && prevState !== "offline") {
        onOfflineRef.current?.();
      }
    }

    scheduleNext(failuresRef.current);
  }, [scheduleNext]);

  // Manual retry: cancel any pending timer and poll immediately
  const retry = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    void poll();
  }, [poll]);

  // Mount: run initial check; unmount: cancel everything
  useEffect(() => {
    cancelledRef.current = false;
    void poll();
    return () => {
      cancelledRef.current = true;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    state,
    running: state === "online",
    consecutiveFailures,
    lastSuccessAt,
    retry,
  };
}

export default useDaemonConnection;
