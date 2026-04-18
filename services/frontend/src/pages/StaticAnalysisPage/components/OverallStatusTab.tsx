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
  if (key === "rule-engine") return "bg-[var(--aegis-source-rule)]";
  if (key === "llm-assist") return "bg-[var(--aegis-source-ai)]";
  return "bg-[var(--aegis-source-both)]";
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
    <>
      <div className="mb-5">
        <PeriodSelector value={period} onChange={onPeriodChange} />
      </div>

      <div className="stagger mb-5 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
        <StatCard label="총 탐지 항목" value={totalFindings} accent />
        <StatCard
          label="미해결"
          value={unresolvedTotal}
          color="var(--aegis-severity-high)"
          detail={
            <span className="text-sm text-muted-foreground">
              해결률 {totalFindings > 0 ? Math.round(((totalFindings - unresolvedTotal) / totalFindings) * 100) : 0}%
            </span>
          }
        />
        <StatCard
          label="Gate 통과율"
          value={`${Math.round(summary.gateStats.rate * 100)}%`}
          detail={
            <span className="text-sm text-muted-foreground">
              {summary.gateStats.passed}/{summary.gateStats.total}
            </span>
          }
        />
        <StatCard label="최근 Run" value={recentRuns.length} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-5">
            <CardTitle>심각도 분포</CardTitle>
            <DonutChart summary={severitySummary} size={140} />
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-5">
            <CardTitle>출처 분포</CardTitle>
            {sourceTotal === 0 ? (
              <p className="text-sm text-muted-foreground">데이터 없음</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(summary.bySource).map(([key, val]) => (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {key === "rule-engine"
                          ? "룰 엔진"
                          : key === "llm-assist"
                            ? "AI"
                            : key === "both"
                              ? "룰 + AI"
                              : key}
                      </span>
                      <span className="font-mono text-sm text-muted-foreground">{val}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-border/70">
                      <div
                        className={`h-full rounded-full ${selectBarFillClass(key)}`}
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

      <div className="mb-5">
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-5">
            <CardTitle>트렌드</CardTitle>
            <TrendChart data={summary.trend} />
          </CardContent>
        </Card>
      </div>

      {Object.keys(summary.byStatus).length > 0 && (
        <Card className="mb-5 shadow-none">
          <CardContent className="space-y-3 p-5">
            <CardTitle>상태 분포</CardTitle>
            <FindingSummary byStatus={summary.byStatus} />
          </CardContent>
        </Card>
      )}

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <TopFilesCard topFiles={summary.topFiles} onFileClick={onFileClick} />
        <TopRulesCard topRules={summary.topRules} />
      </div>

      <RecentRunsList runs={recentRuns} onClickRun={onViewRun} />
    </>
  );
};
