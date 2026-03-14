import React from "react";
import type { StaticAnalysisDashboardSummary, Run, AnalysisProgress } from "@smartcar/shared";
import type { DashboardPeriod } from "../ui/PeriodSelector";
import { PageHeader, StatCard, DonutChart, PeriodSelector, TrendChart, FindingSummary } from "../ui";
import { FileSearch, Shield, AlertTriangle, ShieldCheck, PlayCircle, Plus } from "lucide-react";
import { ActiveAnalysisBanner } from "./ActiveAnalysisBanner";
import { TopFilesCard } from "./TopFilesCard";
import { TopRulesCard } from "./TopRulesCard";
import { RecentRunsList } from "./RecentRunsList";

interface Props {
  projectId: string;
  summary: StaticAnalysisDashboardSummary;
  recentRuns: Run[];
  activeAnalysis: AnalysisProgress | null;
  period: DashboardPeriod;
  onPeriodChange: (p: DashboardPeriod) => void;
  onNewAnalysis: () => void;
  onViewRun: (runId: string) => void;
  onResumeAnalysis: () => void;
  onAbortAnalysis: () => void;
}

export const StaticDashboard: React.FC<Props> = ({
  summary,
  recentRuns,
  activeAnalysis,
  period,
  onPeriodChange,
  onNewAnalysis,
  onViewRun,
  onResumeAnalysis,
  onAbortAnalysis,
}) => {
  const totalFindings =
    Object.values(summary.bySeverity).reduce((a, b) => a + b, 0);
  const unresolvedTotal =
    summary.unresolvedCount.open +
    summary.unresolvedCount.needsReview +
    summary.unresolvedCount.needsRevalidation +
    summary.unresolvedCount.sandbox;

  // Build AnalysisSummary for DonutChart
  const severitySummary = {
    total: totalFindings,
    critical: summary.bySeverity["critical"] ?? 0,
    high: summary.bySeverity["high"] ?? 0,
    medium: summary.bySeverity["medium"] ?? 0,
    low: summary.bySeverity["low"] ?? 0,
    info: summary.bySeverity["info"] ?? 0,
  };

  // Source donut data — reuse DonutChart with mapped keys
  const sourceTotal = Object.values(summary.bySource).reduce((a, b) => a + b, 0);

  return (
    <div className="page-enter">
      <PageHeader
        title="정적 분석"
        icon={<FileSearch size={20} />}
        action={
          <div className="page-header__action-group">
            <PeriodSelector value={period} onChange={onPeriodChange} />
            <button className="btn" onClick={onNewAnalysis}>
              <Plus size={16} />
              새 분석
            </button>
          </div>
        }
      />

      {/* Active Analysis Banner */}
      {activeAnalysis && (
        <ActiveAnalysisBanner
          progress={activeAnalysis}
          onView={onResumeAnalysis}
          onAbort={onAbortAnalysis}
        />
      )}

      {/* KPI Cards */}
      <div className="stat-cards stagger">
        <StatCard icon={<Shield size={16} />} label="총 Finding" value={totalFindings} accent />
        <StatCard icon={<AlertTriangle size={16} />} label="미해결" value={unresolvedTotal} color="var(--severity-high)" />
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
        <TopFilesCard topFiles={summary.topFiles} />
        <TopRulesCard topRules={summary.topRules} />
      </div>

      {/* Recent Runs */}
      <RecentRunsList runs={recentRuns} onClickRun={onViewRun} />
    </div>
  );
};
