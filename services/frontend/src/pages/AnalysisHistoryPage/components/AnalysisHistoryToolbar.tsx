import React from "react";
import { cn } from "@/lib/utils";
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
  <section className="analysis-history-toolbar" aria-label="분석 이력 필터와 요약">
    <div className="analysis-history-toolbar__filters" role="tablist" aria-label="Analysis module filters">
      {ANALYSIS_HISTORY_FILTER_OPTIONS.map((option) => (
        <button className={cn("btn btn-primary btn-sm", "analysis-history-toolbar__filter-button", filter === option.value && "is-active",)} type="button" key={option.value} variant={filter === option.value ? "default" : "outline"} onClick={() => onFilterChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>

    <div className="analysis-history-toolbar__stats">
      <div className="panel analysis-history-toolbar__stat-card">
        <div className="panel-body analysis-history-toolbar__stat-body">
          <span className="analysis-history-toolbar__stat-label">전체 실행</span>
          <span className="analysis-history-toolbar__stat-value">{totalCount}</span>
        </div>
      </div>
      <div className="panel analysis-history-toolbar__stat-card">
        <div className="panel-body analysis-history-toolbar__stat-body">
          <span className="analysis-history-toolbar__stat-label">완료</span>
          <span className="analysis-history-toolbar__stat-value analysis-history-toolbar__stat-value--success">{completedCount}</span>
        </div>
      </div>
      <div className="panel analysis-history-toolbar__stat-card">
        <div className="panel-body analysis-history-toolbar__stat-body">
          <span className="analysis-history-toolbar__stat-label">실패</span>
          <span className="analysis-history-toolbar__stat-value analysis-history-toolbar__stat-value--danger">{failedCount}</span>
        </div>
      </div>
    </div>
  </section>
);
