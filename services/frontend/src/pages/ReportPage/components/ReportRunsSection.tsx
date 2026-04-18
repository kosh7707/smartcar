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
  completed: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
  running: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
} as const;

const gateStatusTone = {
  pass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  fail: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
} as const;

export const ReportRunsSection: React.FC<ReportRunsSectionProps> = ({ runs }) => {
  if (runs.length === 0) return null;

  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader className="border-b border-border/70">
        <CardTitle>실행 이력 ({runs.length})</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border px-4 py-0">
        {runs.map(({ run, gate }) => (
          <div key={run.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={runStatusTone[run.status as keyof typeof runStatusTone] ?? "text-muted-foreground"}
              >
                {run.status}
              </Badge>
              <span className="font-medium text-foreground">{MODULE_META[run.module]?.label ?? run.module}</span>
              <span className="text-sm text-muted-foreground">탐지 항목 {run.findingCount}건</span>
              {gate?.status && (
                <Badge
                  variant="outline"
                  className={gateStatusTone[gate.status as keyof typeof gateStatusTone] ?? "text-muted-foreground"}
                >
                  게이트: {gate.status}
                </Badge>
              )}
            </div>
            <span className="text-sm text-muted-foreground">{formatDateTime(run.createdAt)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
