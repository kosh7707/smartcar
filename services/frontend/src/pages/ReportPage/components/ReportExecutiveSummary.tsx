import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  critical: { label: "치명", barClassName: "bg-red-500", badgeClassName: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300" },
  high: { label: "높음", barClassName: "bg-orange-500", badgeClassName: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  medium: { label: "보통", barClassName: "bg-amber-500", badgeClassName: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  low: { label: "낮음", barClassName: "bg-emerald-500", badgeClassName: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
} as const;

export function ReportExecutiveSummary({
  report,
  allRuns,
  summary,
  sevCounts,
  sevMax,
}: ReportExecutiveSummaryProps) {
  const hasGateFailure = allRuns.some((run) => run.gate?.status === "fail");
  const statusEntries = Object.entries(summary.byStatus).filter(([, count]) => count > 0);

  return (
    <Card className="border-border/80 bg-gradient-to-b from-card to-muted/30 shadow-none">
      <CardHeader className="border-l-4 border-l-primary">
        <CardTitle>요약</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">분석 날짜</p>
            <p className="font-medium text-foreground">{formatDateTime(report.generatedAt).split(" ")[0]}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">컴플라이언스</p>
            <Badge
              variant="outline"
              className={cn(
                "h-7 rounded-md px-2.5 text-sm",
                hasGateFailure
                  ? "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              )}
            >
              {hasGateFailure ? "FAIL" : "PASS"}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">분석 실행</p>
            <p className="font-mono text-lg font-semibold text-foreground">{allRuns.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">총 Finding</p>
            <p className="font-mono text-3xl font-semibold text-primary">{summary.totalFindings}</p>
          </div>
        </div>

        <div className="space-y-3 border-t border-border/70 pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">심각도 분포</span>
            <span className="text-xs text-muted-foreground">기준 최대값 {sevMax}</span>
          </div>
          <div className="space-y-3">
            {(Object.keys(severityMeta) as Array<keyof typeof severityMeta>).map((severity) => {
              const value = sevCounts[severity];
              const percent = value === 0 ? 0 : Math.max((value / sevMax) * 100, 6);

              return (
                <div key={severity} className="grid grid-cols-[64px_1fr_auto] items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{severityMeta[severity].label}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-[width] duration-300", severityMeta[severity].barClassName)}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="min-w-8 text-right font-mono text-sm text-muted-foreground">{value}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 border-t border-border/70 pt-4 md:grid-cols-[auto_1fr]">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">심각도별</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(severityMeta) as Array<keyof typeof severityMeta>)
                .filter((severity) => sevCounts[severity] > 0)
                .map((severity) => (
                  <Badge
                    key={severity}
                    variant="outline"
                    className={cn("rounded-md px-2 py-1 text-xs", severityMeta[severity].badgeClassName)}
                  >
                    {severityMeta[severity].label} {sevCounts[severity]}
                  </Badge>
                ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">상태별</p>
            <div className="flex flex-wrap gap-2">
              {statusEntries.length === 0 ? (
                <span className="text-sm text-muted-foreground">표시할 상태가 없습니다.</span>
              ) : (
                statusEntries.map(([status, count]) => (
                  <Badge key={status} variant="outline" className="rounded-md px-2 py-1 text-xs text-muted-foreground">
                    {(FINDING_STATUS_LABELS[status as keyof typeof FINDING_STATUS_LABELS] ?? status)}: {count}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
