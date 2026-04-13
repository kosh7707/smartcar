import React from "react";
import { Download, FileText, Filter, Settings2 } from "lucide-react";
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
    icon={<FileText size={20} />}
    subtitle={`생성: ${formatDateTime(generatedAt)}`}
    action={
      <div className="report-page__actions">
        <button
          className={`btn btn-secondary btn-sm${hasActiveFilters ? " report-page__filter-active" : ""}`}
          onClick={onToggleFilters}
        >
          <Filter size={14} />
          필터{hasActiveFilters ? " (적용됨)" : ""}
        </button>
        <button className="btn btn-secondary btn-sm print-hide" onClick={onOpenCustomReport}>
          <Settings2 size={14} />
          커스텀 보고서
        </button>
        <button className="btn btn-sm print-hide" onClick={onPrint}>
          <Download size={14} />
          PDF 내보내기
        </button>
      </div>
    }
  />
);
