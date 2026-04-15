import React from "react";
import { Download, Filter, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
      <div className="report-page__actions">
        <Button
          variant="outline"
          size="sm"
          className={cn(hasActiveFilters && "report-page__filter-active")}
          onClick={onToggleFilters}
        >
          <Filter size={14} />
          필터{hasActiveFilters ? " (적용됨)" : ""}
        </Button>
        <Button variant="outline" size="sm" className="print-hide" onClick={onOpenCustomReport}>
          <Settings2 size={14} />
          커스텀 보고서
        </Button>
        <Button size="sm" className="print-hide" onClick={onPrint}>
          <Download size={14} />
          PDF 내보내기
        </Button>
      </div>
    }
  />
);
