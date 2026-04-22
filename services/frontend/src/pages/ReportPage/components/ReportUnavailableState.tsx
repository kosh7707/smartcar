import React from "react";
import { EmptyState } from "../../../shared/ui";
import { ReportHeader } from "./ReportHeader";

type ReportUnavailableStateProps = {
  loadError: boolean;
  hasActiveFilters: boolean;
  onToggleFilters: () => void;
  onOpenCustomReport: () => void;
  onRetry: () => void;
};

export function ReportUnavailableState({
  loadError,
  hasActiveFilters,
  onToggleFilters,
  onOpenCustomReport,
  onRetry,
}: ReportUnavailableStateProps) {
  return (
    <div className="page-enter">
      <ReportHeader
        generatedAt={new Date().toISOString()}
        hasActiveFilters={hasActiveFilters}
        onToggleFilters={onToggleFilters}
        onOpenCustomReport={onOpenCustomReport}
        onPrint={() => window.print()}
      />
      <EmptyState
        className="empty-state--workspace"
        title={loadError ? "보고서를 불러올 수 없습니다" : "보고서를 생성할 수 없습니다"}
        description={loadError ? "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." : "분석을 먼저 실행해주세요"}
        action={loadError ? (
          <button type="button" className="btn btn-outline" onClick={onRetry}>다시 시도</button>
        ) : undefined}
      />
    </div>
  );
}
