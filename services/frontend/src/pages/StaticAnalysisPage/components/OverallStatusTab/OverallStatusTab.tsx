import "./OverallStatusTab.css";
import React from "react";
import type { StaticAnalysisDashboardSummary, Run, Severity } from "@aegis/shared";
import type { DashboardPeriod } from "@/common/ui/primitives/PeriodSelector";
import { cn } from "@/common/utils/cn";
import { PeriodSelector, TrendChart } from "@/common/ui/primitives";
import { TopFilesCard } from "../TopFilesCard/TopFilesCard";
import { TopRulesCard } from "../TopRulesCard/TopRulesCard";
import { RecentRunsList } from "../RecentRunsList/RecentRunsList";
import "./OverallStatusTab.css";

interface Props {
  summary: StaticAnalysisDashboardSummary;
  recentRuns: Run[];
  period: DashboardPeriod;
  onPeriodChange: (p: DashboardPeriod) => void;
  onViewRun: (runId: string) => void;
  onFileClick?: (filePath: string) => void;
}

type PostureKey = Exclude<Severity, "info">;

const POSTURE: Array<{ key: PostureKey; label: string }> = [
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

const SOURCE_LABELS: Record<string, string> = {
  "rule-engine": "RULE ENGINE",
  "llm-assist": "LLM ASSIST",
  both: "RULE + LLM",
};

const STATUS_LABELS: Record<string, string> = {
  open: "OPEN",
  needs_review: "NEEDS REVIEW",
  needsReview: "NEEDS REVIEW",
  needs_revalidation: "NEEDS REVAL.",
  needsRevalidation: "NEEDS REVAL.",
  sandbox: "SANDBOX",
  resolved: "RESOLVED",
  dismissed: "DISMISSED",
  false_positive: "FALSE POSITIVE",
  falsePositive: "FALSE POSITIVE",
};

function formatStatus(key: string): string {
  return STATUS_LABELS[key] ?? key.replace(/[_-]/g, " ").toUpperCase();
}

function formatSourceLabel(key: string): string {
  return SOURCE_LABELS[key] ?? key.toUpperCase();
}

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

  const sev: Record<PostureKey, number> = {
    critical: summary.bySeverity.critical ?? 0,
    high: summary.bySeverity.high ?? 0,
    medium: summary.bySeverity.medium ?? 0,
    low: summary.bySeverity.low ?? 0,
  };

  const sourceTotal = Object.values(summary.bySource).reduce((a, b) => a + b, 0);
  const gateRatePct = Math.round(summary.gateStats.rate * 100);
  const resolvedPct =
    totalFindings > 0
      ? Math.round(((totalFindings - unresolvedTotal) / totalFindings) * 100)
      : 0;

  const statusEntries = Object.entries(summary.byStatus);
  const statusTotal = statusEntries.reduce((a, [, v]) => a + v, 0);

  const isEmpty =
    totalFindings === 0 && recentRuns.length === 0 && summary.trend.length === 0;

  if (isEmpty) {
    return (
      <div className="page-shell overall-status-shell" data-chore>
        <div className="overall-status-controls chore c-1">
          <span className="overall-status-controls__label">PERIOD</span>
          <PeriodSelector value={period} onChange={onPeriodChange} />
        </div>

        <section className="chore c-2" aria-labelledby="overall-empty-head">
          <div className="section-head">
            <h2 id="overall-empty-head">전체 현황 없음</h2>
            <span className="hint">AWAITING FIRST RUN</span>
          </div>
          <div className="panel latest-analysis-empty">
            <div className="latest-analysis-empty__body">
              <div className="latest-analysis-empty__copy">
                <span className="panel-empty__eyebrow">NOTHING YET</span>
                <p className="latest-analysis-empty__headline">
                  이 기간에 집계할 지표가 없습니다.
                </p>
                <p className="latest-analysis-empty__caption">
                  분석을 실행하면 Gate 통과율 · 미해결 · 심각도 분포 · 트렌드가 이 탭에 채워집니다.
                </p>
              </div>
            </div>
            <dl className="latest-analysis-empty__preview" aria-label="나타날 지표 미리보기">
              <div className="latest-analysis-empty__preview-cell">
                <dt>Gate</dt>
                <dd>통과율 · 실패 · 오버라이드</dd>
              </div>
              <div className="latest-analysis-empty__preview-cell">
                <dt>미해결</dt>
                <dd>OPEN · REVIEW · REVAL. · SANDBOX</dd>
              </div>
              <div className="latest-analysis-empty__preview-cell">
                <dt>분포</dt>
                <dd>심각도 · 출처 · 상태</dd>
              </div>
              <div className="latest-analysis-empty__preview-cell">
                <dt>트렌드</dt>
                <dd>일별 Finding · Gate</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell overall-status-shell" data-chore>
      <header className="overall-status-kpi-strip chore c-1" aria-label="기간 KPI">
        <div className="overall-status-period">
          <span className="overall-status-period__label">PERIOD</span>
          <PeriodSelector value={period} onChange={onPeriodChange} />
        </div>
        <dl className="overall-status-kpi" aria-label="기간 요약 지표">
          <div className="kpi">
            <dt>GATE PASS</dt>
            <dd>
              <span className="kpi__value">{gateRatePct}</span>
              <span className="kpi__unit">%</span>
            </dd>
            <span className="kpi__hint">
              {summary.gateStats.passed}/{summary.gateStats.total}
            </span>
          </div>
          <div className="kpi">
            <dt>UNRESOLVED</dt>
            <dd className={cn(unresolvedTotal > 0 && "is-warn")}>
              <span className="kpi__value">{unresolvedTotal}</span>
            </dd>
            <span className="kpi__hint">해결률 {resolvedPct}%</span>
          </div>
          <div className="kpi">
            <dt>FINDINGS</dt>
            <dd>
              <span className="kpi__value">{totalFindings}</span>
            </dd>
            <span className="kpi__hint">기간 내 누적</span>
          </div>
          <div className="kpi">
            <dt>RUNS</dt>
            <dd>
              <span className="kpi__value">{recentRuns.length}</span>
            </dd>
            <span className="kpi__hint">기간 내</span>
          </div>
        </dl>
      </header>

      <section className="chore c-2" aria-labelledby="overall-posture-head">
        <div className="section-head">
          <h2 id="overall-posture-head">
            보안 현황
            <span className="count">{totalFindings}</span>
          </h2>
          <span className="hint">심각도별 누적</span>
        </div>
        <div
          className="severity-tally severity-tally--row"
          role="group"
          aria-label="심각도별 누적 현황"
        >
          {POSTURE.map(({ key, label }) => (
            <div key={key} className={`severity-tally__cell severity-tally__cell--${key}`}>
              <span className={`sev-chip ${key}`}>
                <span className="sev-dot" aria-hidden="true" />
                {label}
              </span>
              <span className="severity-tally__count">{sev[key] ?? 0}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="chore c-3" aria-labelledby="overall-trend-head">
        <div className="section-head">
          <h2 id="overall-trend-head">트렌드</h2>
          <span className="hint">기간 추이</span>
        </div>
        <div className="panel">
          <div className="panel-head">
            <h3>일별 Finding · Gate 통과</h3>
            <div className="panel-tools">
              <span className="trend-legend">
                <span className="trend-legend__dot trend-legend__dot--bar" aria-hidden="true" />
                Finding
              </span>
              <span className="trend-legend">
                <span className="trend-legend__dot trend-legend__dot--line" aria-hidden="true" />
                Gate 통과
              </span>
            </div>
          </div>
          <div className="panel-body panel-body--chart">
            <TrendChart data={summary.trend} />
          </div>
        </div>
      </section>

      <section className="chore c-4" aria-labelledby="overall-distribution-head">
        <div className="section-head">
          <h2 id="overall-distribution-head">분포</h2>
        </div>
        <div className="overall-status-split">
          <div className="panel">
            <div className="panel-head">
              <h3>심각도</h3>
              <div className="panel-tools">
                <span className="sub-caps">TOTAL</span>
                <b>{totalFindings}</b>
              </div>
            </div>
            {totalFindings === 0 ? (
              <div className="panel-body">
                <div className="panel-empty">
                  <span className="panel-empty__eyebrow">NO DATA</span>
                  <p className="panel-empty__copy">기간 내 심각도 분포가 없습니다.</p>
                </div>
              </div>
            ) : (
              <div className="panel-body">
                <div className="severity-proportion" aria-hidden="true">
                  {POSTURE.map(({ key }) => {
                    const v = sev[key];
                    if (v === 0) return null;
                    return (
                      <span
                        key={key}
                        className={`severity-proportion__seg severity-proportion__seg--${key}`}
                        style={{ flexGrow: v }}
                      />
                    );
                  })}
                </div>
                <div className="distribution-list">
                  {POSTURE.map(({ key, label }) => {
                    const v = sev[key];
                    const pct = totalFindings > 0 ? (v / totalFindings) * 100 : 0;
                    return (
                      <div key={key} className="distribution-row">
                        <div className="distribution-meta">
                          <span className={`sev-chip ${key}`}>
                            <span className="sev-dot" aria-hidden="true" />
                            {label}
                          </span>
                          <span className="distribution-count">
                            {v} · {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="distribution-bar">
                          <div
                            className={`distribution-fill distribution-fill--sev distribution-fill--sev-${key}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>출처</h3>
              <div className="panel-tools">
                <span className="sub-caps">TOTAL</span>
                <b>{sourceTotal}</b>
              </div>
            </div>
            {sourceTotal === 0 ? (
              <div className="panel-body">
                <div className="panel-empty">
                  <span className="panel-empty__eyebrow">NO DATA</span>
                  <p className="panel-empty__copy">기간 내 출처 데이터가 없습니다.</p>
                </div>
              </div>
            ) : (
              <div className="panel-body">
                <div className="distribution-list">
                  {Object.entries(summary.bySource).map(([key, val]) => {
                    const pct = (val / sourceTotal) * 100;
                    return (
                      <div key={key} className="distribution-row">
                        <div className="distribution-meta">
                          <span className="distribution-label">{formatSourceLabel(key)}</span>
                          <span className="distribution-count">
                            {val} · {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="distribution-bar">
                          <div
                            className={cn(
                              "distribution-fill",
                              key === "rule-engine" && "distribution-fill--rule",
                              key === "llm-assist" && "distribution-fill--ai",
                              key === "both" && "distribution-fill--hybrid",
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {statusEntries.length > 0 && (
        <section className="chore c-5" aria-labelledby="overall-status-head">
          <div className="section-head">
            <h2 id="overall-status-head">
              상태 분포
              <span className="count">{statusTotal}</span>
            </h2>
          </div>
          <div className="panel">
            <div className="panel-body">
              <div className="status-chips">
                {statusEntries.map(([key, v]) => (
                  <div key={key} className="status-chip">
                    <span className="status-chip__label">{formatStatus(key)}</span>
                    <span className="status-chip__count">{v}</span>
                  </div>
                ))}
              </div>
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
            <span>최근 Run</span>
            <span className="count">{recentRuns.length}</span>
          </h2>
        </div>
        <RecentRunsList runs={recentRuns} onClickRun={onViewRun} />
      </section>
    </div>
  );
};
