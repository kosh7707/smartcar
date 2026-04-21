import React from "react";
import type { StaticAnalysisDashboardSummary, Run, Severity } from "@aegis/shared";
import type { DashboardPeriod } from "../../../shared/ui/PeriodSelector";
import { cn } from "@/lib/utils";
import {
  DonutChart,
  PeriodSelector,
  TrendChart,
  FindingSummary,
} from "../../../shared/ui";
import { TopFilesCard } from "./TopFilesCard";
import { TopRulesCard } from "./TopRulesCard";
import { RecentRunsList } from "./RecentRunsList";

interface Props {
  summary: StaticAnalysisDashboardSummary;
  recentRuns: Run[];
  period: DashboardPeriod;
  onPeriodChange: (p: DashboardPeriod) => void;
  onViewRun: (runId: string) => void;
  onFileClick?: (filePath: string) => void;
}

const POSTURE: Array<{ key: Exclude<Severity, "info">; label: string }> = [
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

export const OverallStatusTab: React.FC<Props> = ({
  summary,
  recentRuns,
  period,
  onPeriodChange,
  onViewRun,
  onFileClick,
}) => {
  const totalFindings = Object.values(summary.bySeverity).reduce((a, b) => a + b, 0);
  const unresolvedTotal =
    summary.unresolvedCount.open +
    summary.unresolvedCount.needsReview +
    summary.unresolvedCount.needsRevalidation +
    summary.unresolvedCount.sandbox;

  const severitySummary = {
    total: totalFindings,
    critical: summary.bySeverity["critical"] ?? 0,
    high: summary.bySeverity["high"] ?? 0,
    medium: summary.bySeverity["medium"] ?? 0,
    low: summary.bySeverity["low"] ?? 0,
    info: summary.bySeverity["info"] ?? 0,
  };

  const sourceTotal = Object.values(summary.bySource).reduce((a, b) => a + b, 0);
  const gateRatePct = Math.round(summary.gateStats.rate * 100);
  const resolvedPct =
    totalFindings > 0 ? Math.round(((totalFindings - unresolvedTotal) / totalFindings) * 100) : 0;

  return (
    <div className="overall-status-stack" data-chore>
      <div className="overall-status-controls chore c-1">
        <span className="overall-status-controls__label">PERIOD</span>
        <PeriodSelector value={period} onChange={onPeriodChange} />
      </div>

      <section className="chore c-2" aria-labelledby="overall-posture-head">
        <div className="section-head">
          <h2 id="overall-posture-head">
            보안 현황
            <span className="count">{totalFindings}</span>
          </h2>
          <span className="hint">기간 내 누적</span>
        </div>
        <div className="severity-tally severity-tally--row" role="group" aria-label="심각도별 누적 현황">
          {POSTURE.map(({ key, label }) => (
            <div key={key} className={`severity-tally__cell severity-tally__cell--${key}`}>
              <span className={`sev-chip ${key}`}>
                <span className="sev-dot" aria-hidden="true" />
                {label}
              </span>
              <span className="severity-tally__count">{severitySummary[key] ?? 0}</span>
            </div>
          ))}
        </div>

        <dl className="overall-status-stats">
          <div className="overall-status-stat">
            <dt>미해결</dt>
            <dd className={cn(unresolvedTotal > 0 && "is-warn")}>{unresolvedTotal}</dd>
            <span className="overall-status-stat__hint">해결률 {resolvedPct}%</span>
          </div>
          <div className="overall-status-stat">
            <dt>Gate 통과율</dt>
            <dd>{gateRatePct}%</dd>
            <span className="overall-status-stat__hint">
              {summary.gateStats.passed}/{summary.gateStats.total}
            </span>
          </div>
          <div className="overall-status-stat">
            <dt>최근 Run</dt>
            <dd>{recentRuns.length}</dd>
            <span className="overall-status-stat__hint">기간 내</span>
          </div>
        </dl>
      </section>

      <section className="chore c-3" aria-labelledby="overall-distribution-head">
        <div className="section-head">
          <h2 id="overall-distribution-head">분포</h2>
        </div>
        <div className="overall-status-split">
          <div className="panel">
            <div className="panel-head">
              <h3>심각도</h3>
            </div>
            <div className="panel-body panel-body--chart">
              <DonutChart summary={severitySummary} size={140} />
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <h3>출처</h3>
            </div>
            {sourceTotal === 0 ? (
              <div className="panel-empty">
                <span className="panel-empty__eyebrow">NO DATA</span>
                <p className="panel-empty__copy">기간 내 출처 데이터가 없습니다.</p>
              </div>
            ) : (
              <div className="panel-body">
                <div className="distribution-list">
                  {Object.entries(summary.bySource).map(([key, val]) => (
                    <div key={key} className="distribution-row">
                      <div className="distribution-meta">
                        <span className="distribution-label">
                          {key === "rule-engine"
                            ? "RULE ENGINE"
                            : key === "llm-assist"
                              ? "LLM ASSIST"
                              : key === "both"
                                ? "RULE + LLM"
                                : key.toUpperCase()}
                        </span>
                        <span className="distribution-count">{val}</span>
                      </div>
                      <div className="distribution-bar">
                        <div
                          className={cn(
                            "distribution-fill",
                            key === "rule-engine" && "distribution-fill--rule",
                            key === "llm-assist" && "distribution-fill--ai",
                            key === "both" && "distribution-fill--hybrid",
                          )}
                          style={{ width: `${(val / sourceTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="chore c-4" aria-labelledby="overall-trend-head">
        <div className="section-head">
          <h2 id="overall-trend-head">트렌드</h2>
        </div>
        <div className="panel">
          <div className="panel-body panel-body--chart">
            <TrendChart data={summary.trend} />
          </div>
        </div>
      </section>

      {Object.keys(summary.byStatus).length > 0 && (
        <section className="chore c-5" aria-labelledby="overall-status-head">
          <div className="section-head">
            <h2 id="overall-status-head">상태 분포</h2>
          </div>
          <div className="panel">
            <div className="panel-body">
              <FindingSummary byStatus={summary.byStatus} />
            </div>
          </div>
        </section>
      )}

      <section className="chore c-6" aria-labelledby="overall-top-head">
        <div className="section-head">
          <h2 id="overall-top-head">Top 파일 · 룰</h2>
        </div>
        <div className="overall-status-split">
          <TopFilesCard topFiles={summary.topFiles} onFileClick={onFileClick} />
          <TopRulesCard topRules={summary.topRules} />
        </div>
      </section>

      <section className="chore c-7" aria-labelledby="overall-runs-head">
        <div className="section-head">
          <h2 id="overall-runs-head">
            최근 Run
            <span className="count">{recentRuns.length}</span>
          </h2>
        </div>
        <RecentRunsList runs={recentRuns} onClickRun={onViewRun} />
      </section>
    </div>
  );
};
