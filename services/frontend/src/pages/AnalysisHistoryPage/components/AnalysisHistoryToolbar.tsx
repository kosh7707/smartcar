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
  <section className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start gap-5 rounded-lg border border-border bg-gradient-to-b from-muted/80 to-background/95 p-5 max-[960px]:grid-cols-1" aria-label="분석 이력 필터와 요약">
    <div className="flex flex-wrap gap-3" role="tablist" aria-label="Analysis module filters">
      {ANALYSIS_HISTORY_FILTER_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={filter === option.value ? "default" : "outline"}
          className={cn("min-h-10 rounded-full px-5 text-sm font-medium", filter === option.value && "border-primary bg-primary/10 text-primary")}
          onClick={() => onFilterChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>

    <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-2 p-4">
          <span className="text-sm font-medium text-muted-foreground">전체 실행</span>
          <span className="font-mono text-lg font-semibold text-foreground">{totalCount}</span>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-2 p-4">
          <span className="text-sm font-medium text-muted-foreground">완료</span>
          <span className="font-mono text-lg font-semibold text-emerald-700">{completedCount}</span>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-2 p-4">
          <span className="text-sm font-medium text-muted-foreground">실패</span>
          <span className="font-mono text-lg font-semibold text-destructive">{failedCount}</span>
        </CardContent>
      </Card>
    </div>
  </section>
);
