"use client";

import { useCallback, useRef, useState } from "react";
import type { CaveVital } from "@/components/perf/web-vitals-reporter";
import { useAnnouncer } from "@/components/ui/live-region";
import { Icon } from "@/lib/icon";
import { getPerfMeasures, type PerfMeasure } from "@/lib/perf/marks";
import {
  formatMemoryUsage,
  formatPercent,
  formatPowerImpact,
  performanceTone,
  type SystemPerformanceSnapshot,
} from "@/lib/perf/system-performance-format";
import { formatWebVital, type WebVitalRating } from "@/lib/perf/web-vitals-format";
import { useMountEffect } from "@/lib/use-mount-effect";
import { usePausablePoll } from "@/lib/use-pausable-poll";
import { useTauriPlatform } from "@/lib/tauri-platform";

import "@/styles/perf-overlay.css";

type SystemMetricState =
  | { status: "sampling"; snapshot: null }
  | { status: "ready"; snapshot: SystemPerformanceSnapshot }
  | { status: "error"; snapshot: null };

type MetricRow = {
  label: string;
  value: string;
  tone: WebVitalRating;
  title?: string;
};

const SYSTEM_POLL_MS = 1_500;

async function requestSystemSnapshot(): Promise<SystemPerformanceSnapshot> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<SystemPerformanceSnapshot>("dev_performance_snapshot");
}

function usePerfOverlay() {
  const { announce } = useAnnouncer();
  const platform = useTauriPlatform();
  const [dismissed, setDismissed] = useState(false);
  const [systemMetric, setSystemMetric] = useState<SystemMetricState>({
    status: "sampling",
    snapshot: null,
  });
  const [vitals, setVitals] = useState<Record<string, CaveVital>>({});
  const [measures, setMeasures] = useState<readonly PerfMeasure[]>([]);
  const systemRequestPending = useRef(false);

  const nativeMetricsAvailable =
    platform === "desktop" || platform === "ios" || platform === "android";

  const sampleSystem = useCallback(async () => {
    if (systemRequestPending.current) return;
    systemRequestPending.current = true;
    try {
      const snapshot = await requestSystemSnapshot();
      setSystemMetric({ status: "ready", snapshot });
    } catch {
      setSystemMetric({ status: "error", snapshot: null });
    } finally {
      systemRequestPending.current = false;
    }
  }, []);

  usePausablePoll(sampleSystem, SYSTEM_POLL_MS, {
    enabled: !dismissed && nativeMetricsAvailable,
  });

  useMountEffect(() => {
    setVitals({ ...(window.__caveVitals ?? {}) });
    setMeasures([...getPerfMeasures()]);
    const onVital = () => setVitals({ ...(window.__caveVitals ?? {}) });
    const onMeasure = () => setMeasures([...getPerfMeasures()]);
    window.addEventListener("cave:web-vital", onVital as EventListener);
    window.addEventListener("cave:perf-measure", onMeasure as EventListener);
    return () => {
      window.removeEventListener("cave:web-vital", onVital as EventListener);
      window.removeEventListener("cave:perf-measure", onMeasure as EventListener);
    };
  });

  const dismiss = useCallback(() => {
    setDismissed(true);
    announce("Performance monitor dismissed.");
  }, [announce]);

  const snapshot = systemMetric.snapshot;
  const memoryPercent = snapshot
    ? (snapshot.memoryUsedBytes / snapshot.memoryTotalBytes) * 100
    : 0;
  const systemRows: MetricRow[] = snapshot
    ? [
        {
          label: "CPU",
          value: formatPercent(snapshot.cpuPercent),
          tone: performanceTone(snapshot.cpuPercent),
          title: "System-wide CPU utilization",
        },
        {
          label: "Memory",
          value: formatMemoryUsage(snapshot.memoryUsedBytes, snapshot.memoryTotalBytes),
          tone: performanceTone(memoryPercent),
          title: "System memory in use",
        },
        {
          label: "Power",
          value: formatPowerImpact(snapshot.powerImpactPercent),
          tone: performanceTone(snapshot.powerImpactPercent),
          title: "Estimated impact, smoothed from system CPU utilization",
        },
      ]
    : [
        { label: "CPU", value: "—", tone: "unknown" },
        { label: "Memory", value: "—", tone: "unknown" },
        { label: "Power", value: "—", tone: "unknown" },
      ];

  const systemStatus =
    platform === "unknown"
      ? "Finding native metrics…"
      : platform === "browser"
        ? "System metrics need the native app shell."
        : systemMetric.status === "sampling"
          ? "Sampling system metrics…"
          : systemMetric.status === "error"
            ? "Couldn’t load system metrics."
            : null;

  return {
    visible: !dismissed,
    dismissButtonProps: {
      type: "button" as const,
      onClick: dismiss,
      "aria-label": "Dismiss performance monitor",
      title: "Dismiss performance monitor",
    },
    systemRows,
    systemStatus,
    vitalRows: Object.values(vitals).sort((a, b) => a.name.localeCompare(b.name)),
    recentMeasures: measures.slice(-4),
  };
}

export function PerfOverlay() {
  const {
    visible,
    dismissButtonProps,
    systemRows,
    systemStatus,
    vitalRows,
    recentMeasures,
  } = usePerfOverlay();

  if (!visible) return null;

  return (
    <aside className="perf-overlay" role="region" aria-label="Development performance monitor">
      <header className="perf-overlay__header">
        <span className="perf-overlay__title">Performance</span>
        <button {...dismissButtonProps} className="perf-overlay__dismiss focus-ring">
          <Icon name="ph:x-bold" aria-hidden />
        </button>
      </header>

      <div className="perf-overlay__section" aria-label="System metrics">
        {systemRows.map((metric) => (
          <div
            className="perf-overlay__metric"
            data-tone={metric.tone}
            key={metric.label}
            title={metric.title}
          >
            <span>{metric.label}</span>
            <span className="perf-overlay__value">{metric.value}</span>
          </div>
        ))}
        {systemStatus ? <p className="perf-overlay__status">{systemStatus}</p> : null}
        <p className="perf-overlay__note">System-wide · power is estimated</p>
      </div>

      <div className="perf-overlay__section" aria-label="Web vitals">
        <span className="perf-overlay__section-label">Web vitals</span>
        {vitalRows.length === 0 ? (
          <p className="perf-overlay__status">Waiting for vitals…</p>
        ) : (
          vitalRows.map((vital) => (
            <div className="perf-overlay__metric" data-tone={vital.rating} key={vital.name}>
              <span>{vital.name}</span>
              <span className="perf-overlay__value">
                {formatWebVital(vital.name, vital.value)}
              </span>
            </div>
          ))
        )}
      </div>

      {recentMeasures.length > 0 ? (
        <div className="perf-overlay__section" aria-label="Recent performance measures">
          <span className="perf-overlay__section-label">Recent measures</span>
          {recentMeasures.map((measure, index) => (
            <div className="perf-overlay__metric" key={`${measure.name}-${index}`}>
              <span className="perf-overlay__measure-name">{measure.name}</span>
              <span className="perf-overlay__value">{Math.round(measure.duration)} ms</span>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
