import React from "react";
import type { BuildTarget } from "@aegis/shared";
import { Bot } from "lucide-react";
import { Spinner } from "../../../shared/ui";

type BuildTargetSectionSummaryProps = {
  isRunning: boolean;
  targets: BuildTarget[];
  readyTargets: BuildTarget[];
  readyCount: number;
  failedCount: number;
  totalCount: number;
  canDeepAnalyzeAll: boolean;
  onDeepAnalyzeAll: (targetIds: string[]) => void;
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
      <div className="bt-progress-summary">
        <Spinner size={14} />
        <span>파이프라인 진행 중...</span>
        {totalCount > 0 && (
          <span className="bt-progress-counts">
            {readyCount}/{totalCount} 완료
            {failedCount > 0 && <span className="bt-progress-failed"> · {failedCount} 실패</span>}
          </span>
        )}
      </div>
    );
  }

  if (!isRunning && readyTargets.length > 0 && canDeepAnalyzeAll) {
    return (
      <div className="bt-ready-summary">
        <span>{readyTargets.length}개 서브 프로젝트 분석 준비 완료</span>
        <button className="btn btn-sm" onClick={() => onDeepAnalyzeAll(readyTargets.map((target) => target.id))}>
          <Bot size={14} />
          전체 심층 분석
        </button>
      </div>
    );
  }

  return null;
}
