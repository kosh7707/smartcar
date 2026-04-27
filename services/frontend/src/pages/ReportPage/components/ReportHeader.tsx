import React from "react";
import { Download, Filter, Settings2 } from "lucide-react";
import { PageHeader } from "../../../shared/ui";

interface ReportHeaderProps {
  hasActiveFilters: boolean;
  onToggleFilters: () => void;
  onOpenCustomReport: () => void;
  onPrint: () => void;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({
  hasActiveFilters,
  onToggleFilters,
  onOpenCustomReport,
  onPrint,
}) => (
  <PageHeader
    title="보고서"
    action={
      <div className="report-header-actions">
        <button
          type="button"
          className={hasActiveFilters ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
          onClick={onToggleFilters}
        >
          <Filter size={14} aria-hidden="true" />
          필터{hasActiveFilters ? " (적용됨)" : ""}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm print-hide"
          onClick={onOpenCustomReport}
        >
          <Settings2 size={14} aria-hidden="true" />
          커스텀 보고서
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm print-hide"
          onClick={onPrint}
        >
          <Download size={14} aria-hidden="true" />
          PDF 내보내기
        </button>
      </div>
    }
  />
);
