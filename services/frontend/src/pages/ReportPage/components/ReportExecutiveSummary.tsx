import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { SeveritySummary } from "../../../shared/ui";
import { FINDING_STATUS_LABELS } from "../../../constants/finding";
import { formatDateTime } from "../../../utils/format";

type ReportExecutiveSummaryProps = {
  report: ProjectReport;
  allRuns: Array<{ gate?: { status?: string | null } | null }>;
  summary: ProjectReport["totalSummary"];
  sevCounts: { critical: number; high: number; medium: number; low: number };
  sevMax: number;
};

export function ReportExecutiveSummary({ report, allRuns, summary, sevCounts, sevMax }: ReportExecutiveSummaryProps) {
  return (
    <div className="card report-exec-card">
      <div className="report-exec-card__accent" />
      <div className="card-title">Executive Summary</div>

      <div className="report-exec-card__meta-grid">
        <div className="report-exec-meta-item">
          <span className="report-exec-meta-item__label">분석 날짜</span>
          <span className="report-exec-meta-item__value">{formatDateTime(report.generatedAt).split(" ")[0]}</span>
        </div>
        <div className="report-exec-meta-item">
          <span className="report-exec-meta-item__label">컴플라이언스</span>
          <span className={`report-compliance-badge ${allRuns.some((run) => run.gate?.status === "fail") ? "report-compliance-badge--fail" : "report-compliance-badge--pass"}`}>
            {allRuns.some((run) => run.gate?.status === "fail") ? "FAIL" : "PASS"}
          </span>
        </div>
        <div className="report-exec-meta-item">
          <span className="report-exec-meta-item__label">분석 실행</span>
          <span className="report-exec-meta-item__value">{allRuns.length}</span>
        </div>
        <div className="report-exec-meta-item">
          <span className="report-exec-meta-item__label">총 Finding</span>
          <span className="report-exec-meta-item__value--large">{summary.totalFindings}</span>
        </div>
      </div>

      <div className="report-severity-chart">
        <span className="report-severity-chart__label">심각도 분포</span>
        <div className="report-severity-chart__bars">
          {(["critical", "high", "medium", "low"] as const).map((severity) => (
            <div key={severity} className="report-severity-bar">
              <span className="report-severity-bar__value">{sevCounts[severity]}</span>
              <div
                className={`report-severity-bar__fill report-severity-bar__fill--${severity}`}
                style={{ height: `${Math.max(5, (sevCounts[severity] / sevMax) * 72)}px` }}
              />
              <span className="report-severity-bar__name">{severity.charAt(0).toUpperCase() + severity.slice(1)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="report-summary__breakdown">
        <div className="report-summary__section">
          <span className="report-summary__section-label">심각도별</span>
          <SeveritySummary summary={{
            critical: summary.bySeverity.critical ?? 0,
            high: summary.bySeverity.high ?? 0,
            medium: summary.bySeverity.medium ?? 0,
            low: summary.bySeverity.low ?? 0,
            info: summary.bySeverity.info ?? 0,
          }} />
        </div>
        <div className="report-summary__section">
          <span className="report-summary__section-label">상태별</span>
          <div className="report-summary__status-list">
            {Object.entries(summary.byStatus)
              .filter(([, count]) => count > 0)
              .map(([status, count]) => (
                <span key={status} className="report-summary__status-item">
                  {FINDING_STATUS_LABELS[status as keyof typeof FINDING_STATUS_LABELS] ?? status}: {count}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
