import React from "react";
import { Calendar, X } from "lucide-react";
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
  <div className="card report-filters animate-fade-in print-hide">
    <div className="report-filters__row">
      <div className="report-filters__field">
        <label className="report-filters__label"><Calendar size={12} /> 시작일</label>
        <input
          type="date"
          className="form-input"
          value={pendingFilters.from ?? ""}
          onChange={(e) => setPendingFilters({ ...pendingFilters, from: e.target.value || undefined })}
        />
      </div>
      <div className="report-filters__field">
        <label className="report-filters__label"><Calendar size={12} /> 종료일</label>
        <input
          type="date"
          className="form-input"
          value={pendingFilters.to ?? ""}
          onChange={(e) => setPendingFilters({ ...pendingFilters, to: e.target.value || undefined })}
        />
      </div>
      <div className="report-filters__field">
        <label className="report-filters__label">심각도</label>
        <select
          className="form-input"
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
        <label className="report-filters__label">상태</label>
        <select
          className="form-input"
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
      <button className="btn btn-sm" onClick={onApply}>적용</button>
      {hasActiveFilters && (
        <button className="btn btn-secondary btn-sm" onClick={onClear}>
          <X size={12} /> 초기화
        </button>
      )}
    </div>
  </div>
);
