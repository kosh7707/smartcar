import React from "react";
import type { BuildTarget } from "@aegis/shared";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "../../../shared/ui";

type BuildTargetSectionSummaryProps = {
  isRunning: boolean;
  targets: BuildTarget[];
  readyTargets: BuildTarget[];
  readyCount: number;
  failedCount: number;
  totalCount: number;
  canDeepAnalyzeAll: boolean;
  onDeepAnalyzeAll: (buildTargetIds: string[]) => void;
};

export function BuildTargetSectionSummary({
  isRunning,
  targets,
  readyTargets,
  readyCount,
  failedCount,
  totalCount,
  canDeepAnalyzeAll,
  onDeepAnalyzeAll,
}: BuildTargetSectionSummaryProps) {
  if (isRunning && targets.length > 0) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <Spinner size={14} />
        <span>파이프라인 진행 중...</span>
        {totalCount > 0 && (
          <span className="ml-auto font-semibold tabular-nums">
            {readyCount}/{totalCount} 완료
            {failedCount > 0 && <span className="text-destructive"> · {failedCount} 실패</span>}
          </span>
        )}
      </div>
    );
  }

  if (!isRunning && readyTargets.length > 0 && canDeepAnalyzeAll) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
        <span>{readyTargets.length}개 BuildTarget 분석 준비 완료</span>
        <Button size="sm" onClick={() => onDeepAnalyzeAll(readyTargets.map((target) => target.id))}>
          <Bot size={14} />
          전체 심층 분석
        </Button>
      </div>
    );
  }

  return null;
}
