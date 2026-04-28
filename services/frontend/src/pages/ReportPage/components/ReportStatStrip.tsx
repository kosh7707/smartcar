import React from "react";
import type { ProjectReport } from "@aegis/shared";

interface Props {
  totalFindings: number;
  critHigh: number;
  openCount: number;
  runCount: number;
  pendingApprovals: number;
  hasGateFailure: boolean;
  scopeLabel: string;
}

interface CellProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  warn?: boolean;
  muted?: boolean;
}

function Cell({ label, value, sub, warn, muted }: CellProps) {
  return (
    <div className="report-stat-strip__cell">
      <span className="report-stat-strip__lbl">{label}</span>
      <span className={`report-stat-strip__val${muted ? " is-muted" : ""}`}>{value}</span>
      {sub ? (
        <span className={`report-stat-strip__sub${warn ? " is-warn" : ""}`}>{sub}</span>
      ) : null}
    </div>
  );
}

export const ReportStatStrip: React.FC<Props> = ({
  totalFindings,
  critHigh,
  openCount,
  runCount,
  pendingApprovals,
  hasGateFailure,
  scopeLabel,
}) => (
  <div className="report-stat-strip" aria-label="보고서 요약 지표">
    <div className="report-stat-strip__cell">
      <span className="report-stat-strip__lbl">컴플라이언스</span>
      <span
        className={`report-comp-badge ${hasGateFailure ? "is-fail" : "is-pass"}`}
      >
        {hasGateFailure ? "FAIL" : "PASS"}
      </span>
      <span className={`report-stat-strip__sub${hasGateFailure ? " is-warn" : ""}`}>
        {hasGateFailure ? "게이트 실패 1건 이상" : "게이트 모두 통과"}
      </span>
    </div>
    <Cell
      label="총 Finding"
      value={totalFindings}
      sub={scopeLabel}
      muted={totalFindings === 0}
    />
    <Cell
      label="치명+높음"
      value={critHigh}
      sub={critHigh > 0 ? "우선 검토 필요" : "없음"}
      warn={critHigh > 0}
      muted={critHigh === 0}
    />
    <Cell
      label="미해결"
      value={openCount}
      sub="미해결 + 검토 중"
      muted={openCount === 0}
    />
    <Cell
      label="실행 횟수"
      value={runCount}
      sub={scopeLabel}
      muted={runCount === 0}
    />
    <Cell
      label="보류 승인"
      value={pendingApprovals}
      sub={pendingApprovals > 0 ? "대기 중" : "없음"}
      warn={pendingApprovals > 0}
      muted={pendingApprovals === 0}
    />
  </div>
);

export function computeStatStripInputs(
  summary: ProjectReport["totalSummary"],
  allRuns: Array<{ gate?: { status?: string | null } | null }>,
  approvals: ProjectReport["approvals"],
  sevCounts: { critical: number; high: number; medium: number; low: number },
) {
  const byStatus = summary.byStatus ?? {};
  return {
    totalFindings: summary.totalFindings,
    critHigh: sevCounts.critical + sevCounts.high,
    openCount: (byStatus.open ?? 0) + (byStatus.in_review ?? 0),
    runCount: allRuns.length,
    pendingApprovals: approvals.filter((a) => a.status === "pending").length,
    hasGateFailure: allRuns.some((run) => run.gate?.status === "fail"),
  };
}
