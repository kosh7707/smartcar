import React from "react";
import type { AnalysisResult, ProjectReport } from "@aegis/shared";
import { FINDING_STATUS_LABELS } from "../../../constants/finding";
import { formatDateTime } from "../../../utils/format";
import { OutcomeChip } from "@/shared/ui/OutcomeChip";
import { RecoveryTracePanel } from "@/shared/analysis/RecoveryTracePanel";
import { deriveCleanPass } from "@/shared/analysis/deepOutcome";

type ReportExecutiveSummaryProps = {
  report: ProjectReport;
  allRuns: Array<{ gate?: { status?: string | null } | null }>;
  summary: ProjectReport["totalSummary"];
  sevCounts: { critical: number; high: number; medium: number; low: number };
  sevMax: number;
  deepResult?: AnalysisResult | null;
};

const severityMeta = {
  critical: { label: "치명", fillClass: "distribution-fill--sev-critical", tagClass: "report-sev-tag--critical" },
  high:     { label: "높음", fillClass: "distribution-fill--sev-high",     tagClass: "report-sev-tag--high"     },
  medium:   { label: "보통", fillClass: "distribution-fill--sev-medium",   tagClass: "report-sev-tag--medium"   },
  low:      { label: "낮음", fillClass: "distribution-fill--sev-low",      tagClass: "report-sev-tag--low"      },
} as const;

export function ReportExecutiveSummary({ report, allRuns, summary, sevCounts, sevMax, deepResult }: ReportExecutiveSummaryProps) {
  const hasGateFailure = allRuns.some((run) => run.gate?.status === "fail");
  const statusEntries = Object.entries(summary.byStatus).filter(([, count]) => count > 0);

  const cleanPass = deepResult ? deriveCleanPass(deepResult) : null;
  const caveats = deepResult?.caveats ?? [];
  const showCaveats = deepResult?.qualityOutcome === "accepted_with_caveats" && caveats.length > 0;
  const recoveryTrace = deepResult?.recoveryTrace ?? [];

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>요약</h3>
      </div>
      <div className="panel-body report-panel-body--flex-col">

        {/* Deep outcome chips — Deep result 가 있을 때만 */}
        {deepResult && (
          <div className="report-summary-outcomes">
            <OutcomeChip kind="cleanPass" value={cleanPass} size="sm" />
            {deepResult.qualityOutcome && (
              <OutcomeChip kind="quality" value={deepResult.qualityOutcome} size="sm" />
            )}
            {deepResult.analysisOutcome && (
              <OutcomeChip kind="analysis" value={deepResult.analysisOutcome} size="sm" />
            )}
            {deepResult.pocOutcome && deepResult.pocOutcome !== "poc_not_requested" && (
              <OutcomeChip kind="poc" value={deepResult.pocOutcome} size="sm" />
            )}
          </div>
        )}

        {/* Caveats summary — qualityOutcome=accepted_with_caveats */}
        {showCaveats && (
          <div className="report-summary-caveats">
            <span className="report-summary-caveats__label">분석 한계 ({caveats.length})</span>
            <ul className="report-summary-caveats__list">
              {caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* RecoveryTrace compact inline */}
        {recoveryTrace.length > 0 && (
          <div className="report-summary-recovery">
            <RecoveryTracePanel trace={recoveryTrace} variant="compact" />
          </div>
        )}

        {/* KPI grid */}
        <div className="report-summary-kpi-grid">
          <div className="report-summary-kpi-cell">
            <span className="report-summary-kpi-label">분석 날짜</span>
            <span className="report-summary-kpi-value report-summary-kpi-value--date">
              {formatDateTime(report.generatedAt).split(" ")[0]}
            </span>
          </div>
          <div className="report-summary-kpi-cell">
            <span className="report-summary-kpi-label">컴플라이언스</span>
            <span className={hasGateFailure ? "report-comp-badge report-comp-badge--fail" : "report-comp-badge report-comp-badge--pass"}>
              {hasGateFailure ? "FAIL" : "PASS"}
            </span>
          </div>
          <div className="report-summary-kpi-cell">
            <span className="report-summary-kpi-label">분석 실행</span>
            <span className="report-summary-kpi-value">{allRuns.length}</span>
          </div>
          <div className="report-summary-kpi-cell">
            <span className="report-summary-kpi-label">총 Finding</span>
            {/* severity-bound numeral exception: bare integer is the finding count signal */}
            <span className="report-summary-kpi-value">{summary.totalFindings}</span>
          </div>
        </div>

        {/* Severity distribution — canonical distribution-* vocab */}
        <div className="report-sev-section">
          <div className="report-sev-section-head">
            <span className="lbl">심각도 분포</span>
            <span className="lbl">기준 최대값 {sevMax}</span>
          </div>
          <div className="distribution-list report-distribution-list--flush">
            {(Object.keys(severityMeta) as Array<keyof typeof severityMeta>).map((severity) => {
              const value = sevCounts[severity];
              const percent = value === 0 ? 0 : Math.max((value / sevMax) * 100, 6);
              return (
                <div key={severity} className="distribution-row">
                  <div className="distribution-meta">
                    <span className="distribution-label">{severityMeta[severity].label}</span>
                    <span className="distribution-count">{value}</span>
                  </div>
                  <div className="distribution-bar">
                    <div
                      className={`distribution-fill ${severityMeta[severity].fillClass}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Severity tags + status tags */}
        <div className="report-summary-dual">
          <div className="report-summary-col">
            <span className="report-summary-col-label">심각도별</span>
            <div className="report-summary-tags">
              {(Object.keys(severityMeta) as Array<keyof typeof severityMeta>)
                .filter((severity) => sevCounts[severity] > 0)
                .map((severity) => (
                  <span key={severity} className={`report-sev-tag ${severityMeta[severity].tagClass}`}>
                    {`${severityMeta[severity].label} ${sevCounts[severity]}`}
                  </span>
                ))}
            </div>
          </div>
          <div className="report-summary-col">
            <span className="report-summary-col-label">상태별</span>
            <div className="report-summary-tags">
              {statusEntries.length === 0 ? (
                <span className="report-summary-col-label">표시할 상태가 없습니다.</span>
              ) : statusEntries.map(([status, count]) => (
                <span key={status} className="report-status-tag">
                  {(FINDING_STATUS_LABELS[status as keyof typeof FINDING_STATUS_LABELS] ?? status)}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
