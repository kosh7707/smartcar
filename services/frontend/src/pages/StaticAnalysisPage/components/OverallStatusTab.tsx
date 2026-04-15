import React from "react";
import type { StaticAnalysisDashboardSummary, Run } from "@aegis/shared";
import type { DashboardPeriod } from "../../../shared/ui/PeriodSelector";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  StatCard,
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

export const OverallStatusTab: React.FC<Props> = ({
  summary,
  recentRuns,
  period,
  onPeriodChange,
  onViewRun,
  onFileClick,
}) => {
  const totalFindings = Object.values(summary.bySeverity).reduce(
    (a, b) => a + b,
    0,
  );
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

  const sourceTotal = Object.values(summary.bySource).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <>
      {/* Period Selector */}
      <div className="overall-tab__period">
        <PeriodSelector value={period} onChange={onPeriodChange} />
      </div>

      {/* KPI Cards */}
      <div className="stagger mb-5 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
        <StatCard label="총 탐지 항목" value={totalFindings} accent />
        <StatCard
          label="미해결"
          value={unresolvedTotal}
          color="var(--aegis-severity-high)"
          detail={
            <span className="overall-tab__stat-detail">
              해결률{" "}
              {totalFindings > 0
                ? Math.round(
                    ((totalFindings - unresolvedTotal) / totalFindings) * 100,
                  )
                : 0}
              %
            </span>
          }
        />
        <StatCard
          label="Gate 통과율"
          value={`${Math.round(summary.gateStats.rate * 100)}%`}
          detail={
            <span className="overall-tab__stat-detail">
              {summary.gateStats.passed}/{summary.gateStats.total}
            </span>
          }
        />
        <StatCard label="최근 Run" value={recentRuns.length} />
      </div>

      {/* Charts 2-column */}
      <div className="static-dashboard__charts">
        <Card className="chart-card--donut shadow-none">
          <CardContent className="space-y-3">
            <CardTitle>심각도 분포</CardTitle>
            <DonutChart summary={severitySummary} size={140} />
          </CardContent>
        </Card>
        <Card className="chart-card shadow-none">
          <CardContent className="space-y-3">
            <CardTitle>출처 분포</CardTitle>
            {sourceTotal === 0 ? (
              <p className="source-dist__empty">데이터 없음</p>
            ) : (
              <div className="source-dist">
                {Object.entries(summary.bySource).map(([key, val]) => (
                  <div key={key} className="source-dist__row">
                    <span className="source-dist__label">
                      {key === "rule-engine"
                        ? "룰 엔진"
                        : key === "llm-assist"
                          ? "AI"
                          : key === "both"
                            ? "룰 + AI"
                            : key}
                    </span>
                    <div className="source-dist__bar-track">
                      <div
                        className={`source-dist__bar-fill source-dist__bar-fill--${key}`}
                        style={{ width: `${(val / sourceTotal) * 100}%` }}
                      />
                    </div>
                    <span className="source-dist__value">{val}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <div className="static-dashboard__charts-full">
        <Card className="chart-card shadow-none">
          <CardContent className="space-y-3">
            <CardTitle>트렌드</CardTitle>
            <TrendChart data={summary.trend} />
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution */}
      {Object.keys(summary.byStatus).length > 0 && (
        <Card className="status-dist-card shadow-none">
          <CardContent className="space-y-3">
            <CardTitle>상태 분포</CardTitle>
            <FindingSummary byStatus={summary.byStatus} />
          </CardContent>
        </Card>
      )}

      {/* Rankings 2-column */}
      <div className="static-dashboard__rankings">
        <TopFilesCard topFiles={summary.topFiles} onFileClick={onFileClick} />
        <TopRulesCard topRules={summary.topRules} />
      </div>

      {/* Recent Runs */}
      <RecentRunsList runs={recentRuns} onClickRun={onViewRun} />
    </>
  );
};
