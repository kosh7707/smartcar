import React from "react";
import {
  ANALYSIS_HISTORY_FILTER_OPTIONS,
  type AnalysisHistoryFilter,
} from "../hooks/useAnalysisHistoryPage";

interface AnalysisHistoryToolbarProps {
  filter: AnalysisHistoryFilter;
  onFilterChange: (value: AnalysisHistoryFilter) => void;
  totalCount: number;
  completedCount: number;
  failedCount: number;
}

export const AnalysisHistoryToolbar: React.FC<AnalysisHistoryToolbarProps> = ({
  filter,
  onFilterChange,
  totalCount,
  completedCount,
  failedCount,
}) => (
  <section className="history-toolbar" aria-label="분석 이력 필터와 요약">
    <div className="history-filter" role="tablist" aria-label="Analysis module filters">
      {ANALYSIS_HISTORY_FILTER_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`history-filter__btn${filter === option.value ? " active" : ""}`}
          onClick={() => onFilterChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>

    <div className="history-kpi-strip">
      <div className="history-kpi">
        <span className="history-kpi__label">전체 실행</span>
        <span className="history-kpi__value">{totalCount}</span>
      </div>
      <div className="history-kpi">
        <span className="history-kpi__label">완료</span>
        <span className="history-kpi__value history-kpi__value--success">{completedCount}</span>
      </div>
      <div className="history-kpi">
        <span className="history-kpi__label">실패</span>
        <span className="history-kpi__value history-kpi__value--error">{failedCount}</span>
      </div>
    </div>
  </section>
);
