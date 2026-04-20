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
    completed: "analysis-history-runs__status analysis-history-runs__status--completed",
    failed: "analysis-history-runs__status analysis-history-runs__status--failed",
    running: "analysis-history-runs__status analysis-history-runs__status--running",
    queued: "analysis-history-runs__status analysis-history-runs__status--queued",
  })[status] ?? "analysis-history-runs__status analysis-history-runs__status--queued";

const getSeverityClass = (tone: "critical" | "high" | "medium" | "low", value?: number) =>
  !value
    ? "analysis-history-runs__severity-value analysis-history-runs__severity-value--muted"
    : {
        critical: "analysis-history-runs__severity-value analysis-history-runs__severity-value--critical",
        high: "analysis-history-runs__severity-value analysis-history-runs__severity-value--high",
        medium: "analysis-history-runs__severity-value analysis-history-runs__severity-value--medium",
        low: "analysis-history-runs__severity-value analysis-history-runs__severity-value--low",
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
      <section className="analysis-history-runs__empty-shell">
        <EmptyState
          className="empty-state--workspace"
          title={EMPTY_TITLES[filter]}
          description="분석이 실행되면 이력, 심각도 분포, 소요 시간 정보를 이곳에서 확인할 수 있습니다."
        />
      </section>
    );
  }

  return (
    <Card className="analysis-history-runs">
      <CardHeader className="analysis-history-runs__head">
        <CardTitle>최근 실행</CardTitle>
        <p className="analysis-history-runs__head-copy">분석 시점, 심각도 요약, 소요 시간을 한 번에 검토합니다.</p>
      </CardHeader>

      <CardContent className="analysis-history-runs__body">
        <Table>
          <TableHeader>
            <TableRow className="analysis-history-runs__header-row">
              <TableHead className="analysis-history-runs__cell-head">실행</TableHead>
              <TableHead className="analysis-history-runs__cell-head">시각</TableHead>
              <TableHead className="analysis-history-runs__cell-head">모듈</TableHead>
              <TableHead className="analysis-history-runs__cell-head">상태</TableHead>
              <TableHead className="analysis-history-runs__cell-head analysis-history-runs__cell-head--center">탐지 요약</TableHead>
              <TableHead className="analysis-history-runs__cell-head">소요 시간</TableHead>
              <TableHead className="analysis-history-runs__cell-head analysis-history-runs__cell-head--icon" />
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
                  className="analysis-history-runs__row"
                  onClick={() => onOpenRun(run)}
                >
                  <TableCell className="analysis-history-runs__cell analysis-history-runs__cell--run">#{index + 1}</TableCell>
                  <TableCell className="analysis-history-runs__cell analysis-history-runs__cell--meta">{formatDateTime(run.createdAt)}</TableCell>
                  <TableCell className="analysis-history-runs__cell">
                    <span className="analysis-history-runs__module">
                      <span className="analysis-history-runs__module-icon">{meta.icon}</span>
                      {meta.label}
                    </span>
                  </TableCell>
                  <TableCell className="analysis-history-runs__cell">
                    <Badge variant="outline" className={cn(getStatusClass(run.status))}>
                      {STATUS_LABELS[run.status] ?? run.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="analysis-history-runs__cell analysis-history-runs__cell--center analysis-history-runs__cell--mono">
                    {severity ? (
                      <span className="analysis-history-runs__severity-summary">
                        <span className={cn(getSeverityClass("critical", severity.critical))}>{severity.critical ?? 0}</span>
                        <span className="analysis-history-runs__severity-sep">/</span>
                        <span className={cn(getSeverityClass("high", severity.high))}>{severity.high ?? 0}</span>
                        <span className="analysis-history-runs__severity-sep">/</span>
                        <span className={cn(getSeverityClass("medium", severity.medium))}>{severity.medium ?? 0}</span>
                        <span className="analysis-history-runs__severity-sep">/</span>
                        <span className={cn(getSeverityClass("low", severity.low))}>{severity.low ?? 0}</span>
                      </span>
                    ) : run.findingCount > 0 ? (
                      <span className="analysis-history-runs__cell--meta">{run.findingCount}</span>
                    ) : (
                      <span className="analysis-history-runs__cell--meta">—</span>
                    )}
                  </TableCell>
                  <TableCell className="analysis-history-runs__cell analysis-history-runs__cell--meta">
                    {durationSec > 0 ? formatUptime(durationSec) : "—"}
                  </TableCell>
                  <TableCell className="analysis-history-runs__cell analysis-history-runs__cell--icon-cell">
                    <ChevronRight size={16} className="analysis-history-runs__chevron" />
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
