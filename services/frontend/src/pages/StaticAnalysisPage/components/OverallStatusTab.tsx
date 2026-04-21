import React from "react";
import type { StaticAnalysisDashboardSummary, Run, Severity } from "@aegis/shared";
import type { DashboardPeriod } from "../../../shared/ui/PeriodSelector";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  StatCard,
  DonutChart,
  PeriodSelector,
  TrendChart,
  FindingSummary,
} from "../../../shared/ui";
import { OverviewSectionHeader } from "../../OverviewPage/components/OverviewSectionHeader";
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

const SEVERITY_CARDS: Array<{ key: Exclude<Severity, "info">; label: string }> = [
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
  const resolvedPct = totalFindings > 0 ? Math.round(((totalFindings - unresolvedTotal) / totalFindings) * 100) : 0;

  return (
    <div className="overall-status-tab">
      <div className="overall-status-tab__controls">
        <span className="overall-status-tab__controls-label">PERIOD</span>
        <PeriodSelector value={period} onChange={onPeriodChange} />
      </div>

      <section className="overall-status-tab__section">
        <OverviewSectionHeader title="보안 현황" />
        <div className="overview-security-posture__grid overall-status-tab__severity-grid">
          <Card className="overview-security-posture__card overview-security-posture__card--total">
            <span className="overview-security-posture__eyebrow">총 Finding</span>
            <span className="overview-security-posture__value">{totalFindings}</span>
            <span className="overview-security-posture__copy">기간 내 전체</span>
          </Card>
          {SEVERITY_CARDS.map((card) => (
            <Card
              key={card.key}
              className={cn(
                "overview-security-posture__card overview-security-posture__card--severity",
                `overview-security-posture__card--${card.key}`,
              )}
            >
              <span
                className={cn(
                  "overview-security-posture__eyebrow",
                  `overview-security-posture__eyebrow--${card.key}`,
                )}
              >
                {card.label}
              </span>
              <span className="overview-security-posture__value">{severitySummary[card.key] ?? 0}</span>
              <span className="overview-security-posture__copy">누적 건수</span>
            </Card>
          ))}
        </div>
        <div className="overall-status-tab__stats">
          <StatCard
            label="미해결"
            value={unresolvedTotal}
            color="var(--aegis-severity-high)"
            detail={
              <span className="overall-status-tab__stat-detail">해결률 {resolvedPct}%</span>
            }
          />
          <StatCard
            label="Gate 통과율"
            value={`${gateRatePct}%`}
            detail={
              <span className="overall-status-tab__stat-detail">
                {summary.gateStats.passed}/{summary.gateStats.total}
              </span>
            }
          />
          <StatCard label="최근 Run" value={recentRuns.length} />
        </div>
      </section>

      <section className="overall-status-tab__section">
        <OverviewSectionHeader title="분포" />
        <div className="overall-status-tab__split-grid">
          <Card className="overall-status-tab__card">
            <CardContent className="overall-status-tab__card-body">
              <CardTitle>심각도</CardTitle>
              <DonutChart summary={severitySummary} size={140} />
            </CardContent>
          </Card>
          <Card className="overall-status-tab__card">
            <CardContent className="overall-status-tab__card-body">
              <CardTitle>출처</CardTitle>
              {sourceTotal === 0 ? (
                <p className="overall-status-tab__empty-copy">기간 내 데이터 없음.</p>
              ) : (
                <div className="overall-status-tab__distribution-list">
                  {Object.entries(summary.bySource).map(([key, val]) => (
                    <div key={key} className="overall-status-tab__distribution-row">
                      <div className="overall-status-tab__distribution-meta">
                        <span className="overall-status-tab__distribution-label">
                          {key === "rule-engine"
                            ? "RULE ENGINE"
                            : key === "llm-assist"
                              ? "LLM ASSIST"
                              : key === "both"
                                ? "RULE + LLM"
                                : key.toUpperCase()}
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
      </section>

      <section className="overall-status-tab__section">
        <OverviewSectionHeader title="트렌드" />
        <Card className="overall-status-tab__card">
          <CardContent className="overall-status-tab__card-body">
            <TrendChart data={summary.trend} />
          </CardContent>
        </Card>
      </section>

      {Object.keys(summary.byStatus).length > 0 && (
        <section className="overall-status-tab__section">
          <OverviewSectionHeader title="상태 분포" />
          <Card className="overall-status-tab__card">
            <CardContent className="overall-status-tab__card-body">
              <FindingSummary byStatus={summary.byStatus} />
            </CardContent>
          </Card>
        </section>
      )}

      <section className="overall-status-tab__section">
        <OverviewSectionHeader title="Top 파일 · 룰" />
        <div className="overall-status-tab__split-grid">
          <TopFilesCard topFiles={summary.topFiles} onFileClick={onFileClick} />
          <TopRulesCard topRules={summary.topRules} />
        </div>
      </section>

      <section className="overall-status-tab__section">
        <OverviewSectionHeader title="최근 Run" />
        <RecentRunsList runs={recentRuns} onClickRun={onViewRun} />
      </section>
    </div>
  );
};
