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

const selectBarFillClass = (key: string) => {
  if (key === "rule-engine") return "overall-status-tab__distribution-fill overall-status-tab__distribution-fill--rule";
  if (key === "llm-assist") return "overall-status-tab__distribution-fill overall-status-tab__distribution-fill--ai";
  return "overall-status-tab__distribution-fill overall-status-tab__distribution-fill--both";
};

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

  return (
    <div className="overall-status-tab">
      <div className="overall-status-tab__period">
        <PeriodSelector value={period} onChange={onPeriodChange} />
      </div>

      <div className="overall-status-tab__stats">
        <StatCard label="총 탐지 항목" value={totalFindings} accent />
        <StatCard
          label="미해결"
          value={unresolvedTotal}
          color="var(--aegis-severity-high)"
          detail={
            <span className="overall-status-tab__stat-detail">
              해결률 {totalFindings > 0 ? Math.round(((totalFindings - unresolvedTotal) / totalFindings) * 100) : 0}%
            </span>
          }
        />
        <StatCard
          label="Gate 통과율"
          value={`${Math.round(summary.gateStats.rate * 100)}%`}
          detail={
            <span className="overall-status-tab__stat-detail">
              {summary.gateStats.passed}/{summary.gateStats.total}
            </span>
          }
        />
        <StatCard label="최근 Run" value={recentRuns.length} />
      </div>

      <div className="overall-status-tab__split-grid">
        <Card className="overall-status-tab__card">
          <CardContent className="overall-status-tab__card-body">
            <CardTitle>심각도 분포</CardTitle>
            <DonutChart summary={severitySummary} size={140} />
          </CardContent>
        </Card>
        <Card className="overall-status-tab__card">
          <CardContent className="overall-status-tab__card-body">
            <CardTitle>출처 분포</CardTitle>
            {sourceTotal === 0 ? (
              <p className="overall-status-tab__empty-copy">데이터 없음</p>
            ) : (
              <div className="overall-status-tab__distribution-list">
                {Object.entries(summary.bySource).map(([key, val]) => (
                  <div key={key} className="overall-status-tab__distribution-row">
                    <div className="overall-status-tab__distribution-meta">
                      <span className="overall-status-tab__distribution-label">
                        {key === "rule-engine"
                          ? "룰 엔진"
                          : key === "llm-assist"
                            ? "AI"
                            : key === "both"
                              ? "룰 + AI"
                              : key}
                      </span>
                      <span className="overall-status-tab__distribution-count">{val}</span>
                    </div>
                    <div className="overall-status-tab__distribution-bar">
                      <div
                        className={selectBarFillClass(key)}
                        style={{ width: `${(val / sourceTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="overall-status-tab__section">
        <Card className="overall-status-tab__card">
          <CardContent className="overall-status-tab__card-body">
            <CardTitle>트렌드</CardTitle>
            <TrendChart data={summary.trend} />
          </CardContent>
        </Card>
      </div>

      {Object.keys(summary.byStatus).length > 0 && (
        <Card className="overall-status-tab__card overall-status-tab__section">
          <CardContent className="overall-status-tab__card-body">
            <CardTitle>상태 분포</CardTitle>
            <FindingSummary byStatus={summary.byStatus} />
          </CardContent>
        </Card>
      )}

      <div className="overall-status-tab__split-grid">
        <TopFilesCard topFiles={summary.topFiles} onFileClick={onFileClick} />
        <TopRulesCard topRules={summary.topRules} />
      </div>

      <RecentRunsList runs={recentRuns} onClickRun={onViewRun} />
    </div>
  );
};
