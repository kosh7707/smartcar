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

const runStatusTone = {
  completed: "report-status-tone report-status-tone--completed",
  failed: "report-status-tone report-status-tone--failed",
  running: "report-status-tone report-status-tone--running",
} as const;

const gateStatusTone = {
  pass: "report-status-tone report-status-tone--pass",
  fail: "report-status-tone report-status-tone--fail",
} as const;

export const ReportRunsSection: React.FC<ReportRunsSectionProps> = ({ runs }) => {
  if (runs.length === 0) return null;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>실행 이력 ({runs.length})</h3>
      </div>
      <div className="panel-body report-list-body">
        {runs.map(({ run, gate }) => (
          <div key={run.id} className="report-list-row">
            <div className="report-list-meta">
              <span
                className={
                  runStatusTone[run.status as keyof typeof runStatusTone] ??
                  "report-status-tone"
                }
              >
                {run.status}
              </span>
              <span className="report-list-primary">
                {MODULE_META[run.module]?.label ?? run.module}
              </span>
              <span className="report-list-secondary">탐지 항목 {run.findingCount}건</span>
              {gate?.status && (
                <span
                  className={
                    gateStatusTone[gate.status as keyof typeof gateStatusTone] ??
                    "report-status-tone"
                  }
                >
                  게이트: {gate.status}
                </span>
              )}
            </div>
            <span className="report-list-timestamp">{formatDateTime(run.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
