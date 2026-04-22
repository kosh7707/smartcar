import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { cn } from "@/lib/utils";
import { FINDING_STATUS_LABELS } from "../../../constants/finding";
import { formatDateTime } from "../../../utils/format";

type ReportExecutiveSummaryProps = {
  report: ProjectReport;
  allRuns: Array<{ gate?: { status?: string | null } | null }>;
  summary: ProjectReport["totalSummary"];
  sevCounts: { critical: number; high: number; medium: number; low: number };
  sevMax: number;
};

const severityMeta = {
  critical: { label: "치명", barClassName: "report-summary-bar-fill--critical", badgeClassName: "report-summary-tag report-summary-tag--critical" },
  high: { label: "높음", barClassName: "report-summary-bar-fill--high", badgeClassName: "report-summary-tag report-summary-tag--high" },
  medium: { label: "보통", barClassName: "report-summary-bar-fill--medium", badgeClassName: "report-summary-tag report-summary-tag--medium" },
  low: { label: "낮음", barClassName: "report-summary-bar-fill--low", badgeClassName: "report-summary-tag report-summary-tag--low" },
} as const;

export function ReportExecutiveSummary({ report, allRuns, summary, sevCounts, sevMax }: ReportExecutiveSummaryProps) {
  const hasGateFailure = allRuns.some((run) => run.gate?.status === "fail");
  const statusEntries = Object.entries(summary.byStatus).filter(([, count]) => count > 0);

  return (
    <div className="panel report-summary-card">
      <div className="panel-head report-summary-head">
        <h3 className="panel-title">요약</h3>
      </div>
      <div className="panel-body report-summary-body">
        <div className="report-summary-grid">
          <div className="report-summary-item">
            <p className="report-summary-label">분석 날짜</p>
            <p className="report-summary-value">{formatDateTime(report.generatedAt).split(" ")[0]}</p>
          </div>
          <div className="report-summary-item">
            <p className="report-summary-label">컴플라이언스</p>
            <span className={cn(hasGateFailure ? "report-summary-compliance report-summary-compliance--fail" : "report-summary-compliance report-summary-compliance--pass")}>
              {hasGateFailure ? "FAIL" : "PASS"}
            </span>
          </div>
          <div className="report-summary-item">
            <p className="report-summary-label">분석 실행</p>
            <p className="report-summary-value report-summary-value--mono">{allRuns.length}</p>
          </div>
          <div className="report-summary-item">
            <p className="report-summary-label">총 Finding</p>
            <p className="report-summary-value report-summary-value--primary">{summary.totalFindings}</p>
          </div>
        </div>

        <div className="report-summary-section">
          <div className="overview-bottom-head">
            <span className="report-summary-label">심각도 분포</span>
            <span className="report-summary-label">기준 최대값 {sevMax}</span>
          </div>
          <div className="report-summary-stack">
            {(Object.keys(severityMeta) as Array<keyof typeof severityMeta>).map((severity) => {
              const value = sevCounts[severity];
              const percent = value === 0 ? 0 : Math.max((value / sevMax) * 100, 6);
              return (
                <div key={severity} className="report-summary-row">
                  <span className="report-summary-value">{severityMeta[severity].label}</span>
                  <div className="report-summary-bar"><div className={cn("report-summary-bar-fill", severityMeta[severity].barClassName)} style={{ width: `${percent}%` }} /></div>
                  <span className="report-summary-number">{value}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="report-summary-section">
          <div className="report-summary-dual-grid">
            <div className="report-summary-stack">
              <p className="report-summary-label">심각도별</p>
              <div className="report-summary-tags">
                {(Object.keys(severityMeta) as Array<keyof typeof severityMeta>)
                  .filter((severity) => sevCounts[severity] > 0)
                  .map((severity) => (
                    <span key={severity} className={severityMeta[severity].badgeClassName}>
                      {severityMeta[severity].label} {sevCounts[severity]}
                    </span>
                  ))}
              </div>
            </div>
            <div className="report-summary-stack">
              <p className="report-summary-label">상태별</p>
              <div className="report-summary-tags">
                {statusEntries.length === 0 ? (
                  <span className="report-summary-label">표시할 상태가 없습니다.</span>
                ) : statusEntries.map(([status, count]) => (
                  <span key={status} className="report-summary-status-tag">
                    {(FINDING_STATUS_LABELS[status as keyof typeof FINDING_STATUS_LABELS] ?? status)}: {count}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
