import React from "react";
import { Download, Filter, Settings2 } from "lucide-react";
import { PageHeader } from "../../../shared/ui";
import { formatDateTime } from "../../../utils/format";

interface ReportHeaderProps {
  generatedAt: string;
  hasActiveFilters: boolean;
  onToggleFilters: () => void;
  onOpenCustomReport: () => void;
  onPrint: () => void;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({
  generatedAt,
  hasActiveFilters,
  onToggleFilters,
  onOpenCustomReport,
  onPrint,
}) => (
  <PageHeader
    title="보고서"
    subtitle={`생성: ${formatDateTime(generatedAt)}`}
    action={
      <div className="report-header-actions">
        <button type="button" className="btn btn-primary btn-sm" variant={hasActiveFilters ? "default" : "outline"} onClick={onToggleFilters}>
          <Filter size={14} />
          필터{hasActiveFilters ? " (적용됨)" : ""}
        </button>
        <button type="button" className="btn btn-outline btn-sm print-hide" onClick={onOpenCustomReport}>
          <Settings2 size={14} />
          커스텀 보고서
        </button>
        <button type="button" className="btn btn-primary btn-sm print-hide" onClick={onPrint}>
          <Download size={14} />
          PDF 내보내기
        </button>
      </div>
    }
  />
);
