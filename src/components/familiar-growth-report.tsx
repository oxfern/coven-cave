"use client";

import { useMemo } from "react";
import { Icon } from "@/lib/icon";
import type { IconName } from "@/lib/icon";
import { RelativeTime } from "@/components/ui/relative-time";
import type { FamiliarCardStats } from "@/components/familiars-view-stats";
import type { FamiliarGrowthReport as FamiliarGrowthReportModel, GrowthSignal } from "@/lib/familiar-growth-signals";
import type { RetroOutcome, RetroRun, RetroTrack } from "@/lib/retro-runs";
import type { Familiar, SessionRow } from "@/lib/types";

const TRACKS: RetroTrack[] = ["synthesis", "prompt", "memory"];
const DAY_MS = 24 * 60 * 60_000;

function percent(value: number | null): string {
  return value == null ? "No data" : `${Math.round(value * 100)}%`;
}

function scoreLabel(delta: number): string {
  if (delta > 0) return `+${delta.toFixed(2)}`;
  return delta.toFixed(2);
}

function trackLabel(track: RetroTrack): string {
  return track.slice(0, 1).toUpperCase() + track.slice(1);
}

function signalIcon(signal: GrowthSignal): IconName {
  if (signal.kind === "healthy") return "ph:check-circle-bold";
  if (signal.severity === "crit") return "ph:warning-circle-fill";
  if (signal.severity === "warn") return "ph:warning-circle";
  return "ph:info-bold";
}

function OutcomePill({ outcome }: { outcome: RetroOutcome }) {
  return (
    <span className={`retro-pill retro-pill--${outcome.toLowerCase()}`}>
      {outcome === "ACCEPT" ? "Accepted" : "Reverted"}
    </span>
  );
}

function RunRow({ run }: { run: RetroRun }) {
  return (
    <article className="retro-run-row growth-run-row">
      <div className="retro-run-row__rail" aria-hidden />
      <div className="retro-run-row__main">
        <div className="retro-run-row__top">
          <div className="retro-run-row__identity">
            <span className="retro-avatar">{run.familiarName.slice(0, 1).toUpperCase()}</span>
            <span className="retro-run-row__names">
              <span className="retro-run-row__familiar">{run.familiarName}</span>
              <span className="retro-run-row__meta">
                {run.familiarRole ? `${run.familiarRole} · ` : ""}
                {run.track} · iteration {run.iteration}
              </span>
            </span>
          </div>
          <OutcomePill outcome={run.outcome} />
        </div>

        <p className="retro-run-row__summary">{run.changeSummary}</p>
        <div className="retro-run-row__stats">
          <span className={`retro-delta ${run.delta >= 0 ? "retro-delta--good" : "retro-delta--bad"}`}>
            {scoreLabel(run.delta)}
          </span>
          <span>{run.metricBefore.toFixed(2)} -&gt; {run.metricAfter.toFixed(2)}</span>
          <RelativeTime iso={run.timestamp} />
        </div>
      </div>
    </article>
  );
}

function buildSessionTrend(sessions: SessionRow[], familiarId: string, now: number) {
  return Array.from({ length: 14 }, (_, index) => {
    const daysBack = 13 - index;
    const day = new Date(now - daysBack * DAY_MS);
    const key = day.toISOString().slice(0, 10);
    const count = sessions.filter((session) => {
      if (session.familiarId !== familiarId) return false;
      const updated = Date.parse(session.updated_at);
      if (!Number.isFinite(updated)) return false;
      return new Date(updated).toISOString().slice(0, 10) === key;
    }).length;
    return { key, label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }), count };
  });
}

export function FamiliarGrowthReport({
  familiar,
  report,
  sessions,
  stats,
  now,
}: {
  familiar: Familiar;
  report: FamiliarGrowthReportModel;
  sessions: SessionRow[];
  stats?: FamiliarCardStats;
  now?: number;
}) {
  const nowMs = now ?? Date.now();
  const sessionTrend = useMemo(
    () => buildSessionTrend(sessions, familiar.id, nowMs),
    [familiar.id, nowMs, sessions],
  );
  const maxSessions = Math.max(1, ...sessionTrend.map((day) => day.count));

  return (
    <article className="growth-report" aria-label={`Growth report for ${familiar.display_name}`}>
      <header className="growth-report__header">
        <div>
          <p className="retro-eyebrow">
            <Icon name="ph:chart-bar-bold" aria-hidden />
            Growth report for {familiar.display_name}
          </p>
          <h3>{familiar.display_name}</h3>
          <p>{familiar.role || familiar.harness || "Familiar"} performance patterns, activity signals, and growth flags.</p>
        </div>
        <span className={`growth-health growth-health--${report.healthLabel}`}>
          {report.healthLabel}
        </span>
      </header>

      <section className="growth-summary" aria-label="Growth summary">
        <div className="growth-summary__item">
          <Icon name="ph:heartbeat" aria-hidden />
          <span>{report.healthLabel}</span>
          <p>Health signal</p>
        </div>
        <div className="growth-summary__item">
          <Icon name="ph:clock-countdown" aria-hidden />
          <span>{report.sessionsLast7d}</span>
          <p>Sessions last 7d</p>
        </div>
        <div className="growth-summary__item">
          <Icon name="ph:check-circle-bold" aria-hidden />
          <span>{percent(report.retroAcceptRate)}</span>
          <p>Retro accept rate</p>
        </div>
        <div className="growth-summary__item">
          <Icon name="ph:clock-bold" aria-hidden />
          <span><RelativeTime iso={report.lastActiveAt} now={nowMs} fallback="never" /></span>
          <p>Last active</p>
        </div>
      </section>

      <section className="growth-section" aria-labelledby="growth-activity">
        <div className="growth-section__head">
          <h4 id="growth-activity">Activity Trends</h4>
          <span>{sessionTrend.reduce((sum, day) => sum + day.count, 0)} sessions in 14d</span>
        </div>
        <div className="growth-bars" role="img" aria-label="Session activity over the last 14 days">
          {sessionTrend.map((day) => (
            <span key={day.key} className="growth-bar" title={`${day.label}: ${day.count} sessions`}>
              <i style={{ height: `${Math.max(8, (day.count / maxSessions) * 100)}%` }} />
            </span>
          ))}
        </div>
        <div className="growth-memory-line">
          <Icon name="ph:brain-bold" aria-hidden />
          <span>
            {stats
              ? `${stats.memoryCount} memory ${stats.memoryCount === 1 ? "entry" : "entries"}`
              : "Memory trend derived from current signals"}
          </span>
          {stats?.latestMemory ? <RelativeTime iso={stats.latestMemory.updatedAt} now={nowMs} /> : null}
        </div>
      </section>

      <section className="growth-section" aria-labelledby="growth-eval">
        <div className="growth-section__head">
          <h4 id="growth-eval">Eval Performance</h4>
          <span>{report.recentRuns.length} recent runs</span>
        </div>
        <div className="growth-track-grid">
          {TRACKS.map((track) => {
            const item = report.trackStats[track];
            const rate = item.total > 0 ? item.accepted / item.total : null;
            return (
              <div key={track} className="growth-track-card">
                <span>{trackLabel(track)}</span>
                <b>{item.total}</b>
                <p>{percent(rate)} accepted</p>
              </div>
            );
          })}
        </div>
        <div className="growth-run-list">
          {report.recentRuns.length > 0 ? (
            report.recentRuns.map((run) => <RunRow key={run.id} run={run} />)
          ) : (
            <p className="retro-muted">No recent retro runs.</p>
          )}
        </div>
      </section>

      <section className="growth-section" aria-labelledby="growth-opportunities">
        <div className="growth-section__head">
          <h4 id="growth-opportunities">Growth Opportunities</h4>
          <span>Derived signals</span>
        </div>
        <div className="growth-signals">
          {report.signals.map((signal) => (
            <div key={`${signal.kind}-${signal.track ?? "all"}`} className={`growth-signal growth-signal--${signal.severity}`}>
              <Icon name={signalIcon(signal)} aria-hidden />
              <span>
                <b>{signal.label}</b>
                <small>{signal.detail}</small>
              </span>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
