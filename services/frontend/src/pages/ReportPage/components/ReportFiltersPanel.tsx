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
  <Card className="print-hide border-border/80 bg-card/95 shadow-none">
    <CardHeader className="border-b border-border/70">
      <CardTitle className="text-base">필터</CardTitle>
    </CardHeader>
    <CardContent className="space-y-5 pt-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar size={12} /> 시작일
          </Label>
          <Input
            type="date"
            value={pendingFilters.from ?? ""}
            onChange={(e) => setPendingFilters({ ...pendingFilters, from: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar size={12} /> 종료일
          </Label>
          <Input
            type="date"
            value={pendingFilters.to ?? ""}
            onChange={(e) => setPendingFilters({ ...pendingFilters, to: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">심각도</Label>
          <Select
            value={pendingFilters.severity ?? ALL_SEVERITIES_VALUE}
            onValueChange={(value) =>
              setPendingFilters({
                ...pendingFilters,
                severity: value === ALL_SEVERITIES_VALUE ? undefined : value,
              })
            }
          >
            <SelectTrigger className="w-full">
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
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">상태</Label>
          <Select
            value={pendingFilters.status ?? ALL_STATUSES_VALUE}
            onValueChange={(value) =>
              setPendingFilters({
                ...pendingFilters,
                status: value === ALL_STATUSES_VALUE ? undefined : value,
              })
            }
          >
            <SelectTrigger className="w-full">
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
      <div className="flex flex-wrap items-center justify-end gap-2">
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
