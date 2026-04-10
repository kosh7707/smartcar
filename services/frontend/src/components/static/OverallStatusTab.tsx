import React from "react";
import type { StaticAnalysisDashboardSummary, Run } from "@aegis/shared";
import type { DashboardPeriod } from "../ui/PeriodSelector";
import { StatCard, DonutChart, PeriodSelector, TrendChart, FindingSummary } from "../ui";
import { Shield, AlertTriangle, ShieldCheck, PlayCircle } from "lucide-react";
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
  const totalFindings =
    Object.values(summary.bySeverity).reduce((a, b) => a + b, 0);
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
    <>
      {/* Period Selector */}
      <div className="overall-tab__period">
        <PeriodSelector value={period} onChange={onPeriodChange} />
      </div>

      {/* KPI Cards */}
      <div className="stat-cards stagger">
        <StatCard icon={<Shield size={16} />} label="총 Finding" value={totalFindings} accent />
        <StatCard
          icon={<AlertTriangle size={16} />}
          label="미해결"
          value={unresolvedTotal}
          color="var(--aegis-severity-high)"
          detail={<span className="text-xs text-tertiary">해결률 {totalFindings > 0 ? Math.round(((totalFindings - unresolvedTotal) / totalFindings) * 100) : 0}%</span>}
        />
        <StatCard
          icon={<ShieldCheck size={16} />}
          label="Gate 통과율"
          value={`${Math.round(summary.gateStats.rate * 100)}%`}
          detail={<span className="text-xs text-tertiary">{summary.gateStats.passed}/{summary.gateStats.total}</span>}
        />
        <StatCard icon={<PlayCircle size={16} />} label="최근 Run" value={recentRuns.length} />
      </div>

      {/* Charts 2-column */}
      <div className="static-dashboard__charts">
        <div className="card chart-card--donut">
          <div className="card-title">심각도 분포</div>
          <DonutChart summary={severitySummary} size={140} />
        </div>
        <div className="card chart-card">
          <div className="card-title">출처 분포</div>
          {sourceTotal === 0 ? (
            <p className="text-tertiary text-sm">데이터 없음</p>
          ) : (
            <div className="source-dist">
              {Object.entries(summary.bySource).map(([key, val]) => (
                <div key={key} className="source-dist__row">
                  <span className="text-sm source-dist__label">{key === "rule-engine" ? "룰 엔진" : key === "llm-assist" ? "AI" : key === "both" ? "룰 + AI" : key}</span>
                  <div className="source-dist__bar-track">
                    <div
                      className={`source-dist__bar-fill source-dist__bar-fill--${key}`}
                      style={{ width: `${(val / sourceTotal) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-tertiary">{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trend Chart */}
      <div className="static-dashboard__charts-full">
        <div className="card chart-card">
          <div className="card-title">트렌드</div>
          <TrendChart data={summary.trend} />
        </div>
      </div>

      {/* Status Distribution */}
      {Object.keys(summary.byStatus).length > 0 && (
        <div className="card status-dist-card">
          <div className="card-title">상태 분포</div>
          <FindingSummary byStatus={summary.byStatus} />
        </div>
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
