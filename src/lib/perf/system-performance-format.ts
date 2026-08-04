import type { WebVitalRating } from "./web-vitals-format";

const MEBIBYTE = 1024 ** 2;
const GIBIBYTE = 1024 ** 3;

export type SystemPerformanceSnapshot = {
  cpuPercent: number;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
  powerImpactPercent: number;
  sampledAtMs: number;
};

export function performanceTone(percent: number): WebVitalRating {
  if (!Number.isFinite(percent)) return "unknown";
  if (percent < 50) return "good";
  if (percent < 80) return "needs-improvement";
  return "poor";
}

export function formatPercent(percent: number): string {
  if (!Number.isFinite(percent)) return "—";
  const digits = Math.abs(percent) < 10 ? 1 : 0;
  return `${percent.toFixed(digits)}%`;
}

function formatMemory(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes >= GIBIBYTE) return `${(bytes / GIBIBYTE).toFixed(1)} GiB`;
  return `${Math.round(bytes / MEBIBYTE)} MiB`;
}

export function formatMemoryUsage(usedBytes: number, totalBytes: number): string {
  const used = formatMemory(usedBytes);
  const total = formatMemory(totalBytes);
  if (used === "—" || total === "—") return "—";
  return `${used} / ${total}`;
}

export function formatPowerImpact(percent: number): string {
  if (!Number.isFinite(percent)) return "—";
  if (percent < 5) return "Idle";
  if (percent < 25) return "Low";
  if (percent < 60) return "Moderate";
  return "High";
}
