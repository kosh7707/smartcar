import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
        <Button
          key={option.value}
          type="button"
          variant={filter === option.value ? "default" : "outline"}
          className={cn(
            "analysis-history-toolbar__filter-button",
            filter === option.value && "is-active",
          )}
          onClick={() => onFilterChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>

    <div className="analysis-history-toolbar__stats">
      <Card className="analysis-history-toolbar__stat-card">
        <CardContent className="analysis-history-toolbar__stat-body">
          <span className="analysis-history-toolbar__stat-label">전체 실행</span>
          <span className="analysis-history-toolbar__stat-value">{totalCount}</span>
        </CardContent>
      </Card>
      <Card className="analysis-history-toolbar__stat-card">
        <CardContent className="analysis-history-toolbar__stat-body">
          <span className="analysis-history-toolbar__stat-label">완료</span>
          <span className="analysis-history-toolbar__stat-value analysis-history-toolbar__stat-value--success">{completedCount}</span>
        </CardContent>
      </Card>
      <Card className="analysis-history-toolbar__stat-card">
        <CardContent className="analysis-history-toolbar__stat-body">
          <span className="analysis-history-toolbar__stat-label">실패</span>
          <span className="analysis-history-toolbar__stat-value analysis-history-toolbar__stat-value--danger">{failedCount}</span>
        </CardContent>
      </Card>
    </div>
  </section>
);
