import React from "react";
import { Calendar, X } from "lucide-react";
import type { ReportFilters } from "../../../api/client";
import { FINDING_STATUS_LABELS } from "../../../constants/finding";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../shared/ui/select-primitives";

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
  <div className="panel print-hide report-filters-card">
    <div className="panel-head report-filters-card__head">
      <h3 className="panel-title report-filters-card__title">필터</h3>
    </div>
    <div className="panel-body report-filters-card__body">
      <div className="report-filters-card__grid">
        <div className="report-filters-card__field">
          <label className="form-label report-filters-card__label">
            <Calendar size={12} /> 시작일
          </label>
          <input className="form-input"
            type="date"
            value={pendingFilters.from ?? ""}
            onChange={(e) => setPendingFilters({ ...pendingFilters, from: e.target.value || undefined })}
          />
        </div>
        <div className="report-filters-card__field">
          <label className="form-label report-filters-card__label">
            <Calendar size={12} /> 종료일
          </label>
          <input className="form-input"
            type="date"
            value={pendingFilters.to ?? ""}
            onChange={(e) => setPendingFilters({ ...pendingFilters, to: e.target.value || undefined })}
          />
        </div>
        <div className="report-filters-card__field">
          <label className="form-label report-filters-card__label">심각도</label>
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
          <label className="form-label report-filters-card__label">상태</label>
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
          <button type="button" className="btn btn-outline btn-sm" onClick={onClear}>
            <X size={12} /> 초기화
          </button>
        )}
        <button type="button" className="btn btn-primary btn-sm" onClick={onApply}>적용</button>
      </div>
    </div>
  </div>
);
