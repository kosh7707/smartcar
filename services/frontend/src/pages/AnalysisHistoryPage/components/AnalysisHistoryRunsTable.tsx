import React from "react";
import type { Run } from "@aegis/shared";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState } from "../../../shared/ui";
import { MODULE_META } from "../../../constants/modules";
import { formatDateTime, formatUptime } from "../../../utils/format";
import type { AnalysisHistoryFilter } from "../hooks/useAnalysisHistoryPage";

type HistoryRun = Run & {
  severitySummary?: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
  };
};

const STATUS_LABELS: Record<string, string> = {
  completed: "완료",
  running: "실행 중",
  failed: "실패",
  queued: "대기",
};

const EMPTY_TITLES: Record<AnalysisHistoryFilter, string> = {
  all: "아직 분석 이력이 없습니다",
  static_analysis: "해당 모듈의 분석 이력이 없습니다",
  deep_analysis: "해당 모듈의 분석 이력이 없습니다",
};

const getStatusClass = (status: string) =>
  ({
    completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    failed: "border-destructive/20 bg-destructive/10 text-destructive",
    running: "border-primary/20 bg-primary/10 text-primary",
    queued: "border-border bg-background text-muted-foreground",
  })[status] ?? "border-border bg-background text-muted-foreground";

const getSeverityClass = (tone: "critical" | "high" | "medium" | "low", value?: number) =>
  !value
    ? "text-muted-foreground"
    : {
      critical: "text-[var(--aegis-severity-critical)]",
      high: "text-[var(--aegis-severity-high)]",
      medium: "text-[var(--aegis-severity-medium)]",
      low: "text-[var(--aegis-severity-low)]",
    }[tone];

interface AnalysisHistoryRunsTableProps {
  filter: AnalysisHistoryFilter;
  runs: HistoryRun[];
  onOpenRun: (run: HistoryRun) => void;
}

export const AnalysisHistoryRunsTable: React.FC<AnalysisHistoryRunsTableProps> = ({
  filter,
  runs,
  onOpenRun,
}) => {
  if (runs.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-background p-6">
        <EmptyState
          className="empty-state--workspace"
          title={EMPTY_TITLES[filter]}
          description="분석이 실행되면 이력, 심각도 분포, 소요 시간 정보를 이곳에서 확인할 수 있습니다."
        />
      </section>
    );
  }

  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="border-b border-border bg-gradient-to-b from-muted/80 to-background/95 p-5">
        <CardTitle>최근 실행</CardTitle>
        <p className="m-0 text-sm text-muted-foreground">분석 시점, 심각도 요약, 소요 시간을 한 번에 검토합니다.</p>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/70">
              <TableHead className="px-5 py-4 font-semibold text-muted-foreground">실행</TableHead>
              <TableHead className="px-5 py-4 font-semibold text-muted-foreground">시각</TableHead>
              <TableHead className="px-5 py-4 font-semibold text-muted-foreground">모듈</TableHead>
              <TableHead className="px-5 py-4 font-semibold text-muted-foreground">상태</TableHead>
              <TableHead className="px-5 py-4 text-center font-semibold text-muted-foreground">탐지 요약</TableHead>
              <TableHead className="px-5 py-4 font-semibold text-muted-foreground">소요 시간</TableHead>
              <TableHead className="w-11 px-5 py-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run, index) => {
              const meta = MODULE_META[run.module] ?? { label: run.module, icon: null };
              const durationSec = run.startedAt && run.endedAt
                ? (new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
                : 0;
              const severity = run.severitySummary;
              return (
                <TableRow
                  key={run.id}
                  className="cursor-pointer hover:bg-muted/80"
                  onClick={() => onOpenRun(run)}
                >
                  <TableCell className="px-5 py-5 font-mono font-semibold text-foreground">#{index + 1}</TableCell>
                  <TableCell className="px-5 py-5 font-mono text-muted-foreground">{formatDateTime(run.createdAt)}</TableCell>
                  <TableCell className="px-5 py-5">
                    <span className="inline-flex items-center gap-3 text-sm font-medium text-foreground">
                      <span className="flex items-center text-muted-foreground">{meta.icon}</span>
                      {meta.label}
                    </span>
                  </TableCell>
                  <TableCell className="px-5 py-5">
                    <Badge variant="outline" className={cn("rounded-full px-2.5 py-1 text-sm font-medium", getStatusClass(run.status))}>
                      {STATUS_LABELS[run.status] ?? run.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-5 py-5 text-center font-mono">
                    {severity ? (
                      <span className="inline-flex items-center">
                        <span className={cn("text-sm font-medium", getSeverityClass("critical", severity.critical))}>{severity.critical ?? 0}</span>
                        <span className="mx-2 text-sm text-border">/</span>
                        <span className={cn("text-sm font-medium", getSeverityClass("high", severity.high))}>{severity.high ?? 0}</span>
                        <span className="mx-2 text-sm text-border">/</span>
                        <span className={cn("text-sm font-medium", getSeverityClass("medium", severity.medium))}>{severity.medium ?? 0}</span>
                        <span className="mx-2 text-sm text-border">/</span>
                        <span className={cn("text-sm font-medium", getSeverityClass("low", severity.low))}>{severity.low ?? 0}</span>
                      </span>
                    ) : run.findingCount > 0 ? (
                      <span className="font-mono text-sm text-muted-foreground">{run.findingCount}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-5 py-5 font-mono text-muted-foreground">
                    {durationSec > 0 ? formatUptime(durationSec) : "—"}
                  </TableCell>
                  <TableCell className="px-5 py-5 text-right">
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
