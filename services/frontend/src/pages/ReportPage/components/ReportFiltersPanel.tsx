import React from "react";
import { Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReportFilters } from "../../../api/client";
import { FINDING_STATUS_LABELS } from "../../../constants/finding";

interface ReportFiltersPanelProps {
  pendingFilters: ReportFilters;
  setPendingFilters: React.Dispatch<React.SetStateAction<ReportFilters>>;
  hasActiveFilters: boolean;
  onApply: () => void;
  onClear: () => void;
}

const ALL_SEVERITIES_VALUE = "all-severities";
const ALL_STATUSES_VALUE = "all-statuses";

export const ReportFiltersPanel: React.FC<ReportFiltersPanelProps> = ({
  pendingFilters,
  setPendingFilters,
  hasActiveFilters,
  onApply,
  onClear,
}) => (
  <Card className="print-hide report-filters-card">
    <CardHeader className="report-filters-card__head">
      <CardTitle className="report-filters-card__title">필터</CardTitle>
    </CardHeader>
    <CardContent className="report-filters-card__body">
      <div className="report-filters-card__grid">
        <div className="report-filters-card__field">
          <Label className="report-filters-card__label">
            <Calendar size={12} /> 시작일
          </Label>
          <Input
            type="date"
            value={pendingFilters.from ?? ""}
            onChange={(e) => setPendingFilters({ ...pendingFilters, from: e.target.value || undefined })}
          />
        </div>
        <div className="report-filters-card__field">
          <Label className="report-filters-card__label">
            <Calendar size={12} /> 종료일
          </Label>
          <Input
            type="date"
            value={pendingFilters.to ?? ""}
            onChange={(e) => setPendingFilters({ ...pendingFilters, to: e.target.value || undefined })}
          />
        </div>
        <div className="report-filters-card__field">
          <Label className="report-filters-card__label">심각도</Label>
          <Select
            value={pendingFilters.severity ?? ALL_SEVERITIES_VALUE}
            onValueChange={(value) =>
              setPendingFilters({
                ...pendingFilters,
                severity: value === ALL_SEVERITIES_VALUE ? undefined : value,
              })
            }
          >
            <SelectTrigger className="report-filters-card__select">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SEVERITIES_VALUE}>전체</SelectItem>
              <SelectItem value="critical">치명</SelectItem>
              <SelectItem value="high">높음</SelectItem>
              <SelectItem value="medium">보통</SelectItem>
              <SelectItem value="low">낮음</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="report-filters-card__field">
          <Label className="report-filters-card__label">상태</Label>
          <Select
            value={pendingFilters.status ?? ALL_STATUSES_VALUE}
            onValueChange={(value) =>
              setPendingFilters({
                ...pendingFilters,
                status: value === ALL_STATUSES_VALUE ? undefined : value,
              })
            }
          >
            <SelectTrigger className="report-filters-card__select">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES_VALUE}>전체</SelectItem>
              {Object.entries(FINDING_STATUS_LABELS).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="report-filters-card__actions">
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={onClear}>
            <X size={12} /> 초기화
          </Button>
        )}
        <Button size="sm" onClick={onApply}>적용</Button>
      </div>
    </CardContent>
  </Card>
);
