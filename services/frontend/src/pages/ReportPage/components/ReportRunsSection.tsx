import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="report-runs-card">
      <CardHeader className="report-runs-card__head">
        <CardTitle>실행 이력 ({runs.length})</CardTitle>
      </CardHeader>
      <CardContent className="report-runs-card__body">
        {runs.map(({ run, gate }) => (
          <div key={run.id} className="report-runs-card__row">
            <div className="report-runs-card__meta">
              <Badge
                variant="outline"
                className={runStatusTone[run.status as keyof typeof runStatusTone] ?? "report-runs-card__status report-runs-card__status--idle"}
              >
                {run.status}
              </Badge>
              <span className="report-runs-card__module">{MODULE_META[run.module]?.label ?? run.module}</span>
              <span className="report-runs-card__finding-count">탐지 항목 {run.findingCount}건</span>
              {gate?.status && (
                <Badge
                  variant="outline"
                  className={gateStatusTone[gate.status as keyof typeof gateStatusTone] ?? "report-runs-card__status report-runs-card__status--idle"}
                >
                  게이트: {gate.status}
                </Badge>
              )}
            </div>
            <span className="report-runs-card__timestamp">{formatDateTime(run.createdAt)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
