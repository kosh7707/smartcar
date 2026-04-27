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
  <section
    className="history-toolbar"
    aria-label="분석 이력 필터와 요약"
    role="region"
  >
    {/* Module filter — canonical .filter-pills.filter-pills--tabs */}
    <div className="filter-pills filter-pills--tabs" role="tablist" aria-label="모듈 범위 필터">
      {ANALYSIS_HISTORY_FILTER_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={filter === option.value}
          className={`pill${filter === option.value ? " active" : ""}`}
          onClick={() => onFilterChange(option.value)}
        >
          {option.value === "static_analysis" && (
            <span className="dot running" aria-hidden="true" />
          )}
          {option.label}
        </button>
      ))}
    </div>

    {/* Summary counts — canonical .status-chips */}
    <div className="status-chips">
      <span className="status-chip">
        <span className="status-chip__label">전체 실행</span>
        <span className="status-chip__count">{totalCount}</span>
      </span>
      <span className="status-chip">
        <span className="status-chip__label">완료</span>
        <span className="status-chip__count">{completedCount}</span>
      </span>
      <span className="status-chip status-chip--failed">
        <span className="status-chip__label">실패</span>
        <span className="status-chip__count">{failedCount}</span>
      </span>
    </div>
  </section>
);
