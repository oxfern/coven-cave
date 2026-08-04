import { PerfOverlay } from "@/components/perf/perf-overlay";
import { WebVitalsReporter } from "@/components/perf/web-vitals-reporter";

export function DevelopmentPerformanceTools() {
  return (
    <>
      <WebVitalsReporter />
      <PerfOverlay />
    </>
  );
}
