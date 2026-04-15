import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { MODULE_META } from "../../../constants/modules";
import { formatDateTime } from "../../../utils/format";

type RunsEntry = ProjectReport["modules"][keyof ProjectReport["modules"]] extends infer T
  ? T extends { runs: infer F } ? F extends Array<infer U> ? U : never : never
  : never;

interface ReportRunsSectionProps {
  runs: RunsEntry[];
}

export const ReportRunsSection: React.FC<ReportRunsSectionProps> = ({ runs }) => {
  if (runs.length === 0) return null;

  return (
    <div className="card">
      <div className="card-title">실행 이력 ({runs.length})</div>
      <div className="report-runs">
        {runs.map(({ run, gate }) => (
          <div key={run.id} className="report-runs__row">
            <span className={`badge badge-sm badge-${run.status === "completed" ? "low" : run.status === "failed" ? "critical" : "info"}`}>
              {run.status}
            </span>
            <span className="report-runs__module">
              {MODULE_META[run.module]?.label ?? run.module}
            </span>
            <span className="report-runs__count">
              탐지 항목 {run.findingCount}건
            </span>
            {gate && (
              <span className={`badge badge-sm badge-${gate.status === "pass" ? "low" : gate.status === "fail" ? "critical" : "medium"}`}>
                게이트: {gate.status}
              </span>
            )}
            <span className="text-sm text-tertiary">
              {formatDateTime(run.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
