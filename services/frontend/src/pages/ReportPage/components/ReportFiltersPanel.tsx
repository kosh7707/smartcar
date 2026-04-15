import React from "react";
import { Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReportFilters } from "../../../api/client";
import { FINDING_STATUS_LABELS } from "../../../constants/finding";

interface ReportFiltersPanelProps {
  pendingFilters: ReportFilters;
  setPendingFilters: React.Dispatch<React.SetStateAction<ReportFilters>>;
  hasActiveFilters: boolean;
  onApply: () => void;
  onClear: () => void;
}

export const ReportFiltersPanel: React.FC<ReportFiltersPanelProps> = ({
  pendingFilters,
  setPendingFilters,
  hasActiveFilters,
  onApply,
  onClear,
}) => (
  <Card className="report-filters animate-fade-in print-hide border-border bg-card/95 shadow-none">
    <CardContent className="space-y-4 p-4">
      <div className="report-filters__row">
        <div className="report-filters__field">
          <Label className="report-filters__label"><Calendar size={12} /> 시작일</Label>
          <Input
            type="date"
            value={pendingFilters.from ?? ""}
            onChange={(e) => setPendingFilters({ ...pendingFilters, from: e.target.value || undefined })}
          />
        </div>
        <div className="report-filters__field">
          <Label className="report-filters__label"><Calendar size={12} /> 종료일</Label>
          <Input
            type="date"
            value={pendingFilters.to ?? ""}
            onChange={(e) => setPendingFilters({ ...pendingFilters, to: e.target.value || undefined })}
          />
        </div>
        <div className="report-filters__field">
          <Label className="report-filters__label">심각도</Label>
          <select
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={pendingFilters.severity ?? ""}
            onChange={(e) => setPendingFilters({ ...pendingFilters, severity: e.target.value || undefined })}
          >
            <option value="">전체</option>
            <option value="critical">치명</option>
            <option value="high">높음</option>
            <option value="medium">보통</option>
            <option value="low">낮음</option>
          </select>
        </div>
        <div className="report-filters__field">
          <Label className="report-filters__label">상태</Label>
          <select
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={pendingFilters.status ?? ""}
            onChange={(e) => setPendingFilters({ ...pendingFilters, status: e.target.value || undefined })}
          >
            <option value="">전체</option>
            {Object.entries(FINDING_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="report-filters__actions">
        <Button size="sm" onClick={onApply}>적용</Button>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={onClear}>
            <X size={12} /> 초기화
          </Button>
        )}
      </div>
    </CardContent>
  </Card>
);
