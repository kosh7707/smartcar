import React from "react";
import { Download, Filter, Settings2 } from "lucide-react";
import type { ProjectReport } from "@aegis/shared";
import { PageHeader } from "../../../shared/ui";
import { formatDateTime } from "../../../utils/format";

interface ReportHeaderProps {
  report?: ProjectReport;
  projectId?: string;
  hasActiveFilters: boolean;
  onToggleFilters: () => void;
  onOpenCustomReport: () => void;
  onPrint: () => void;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({
  report,
  projectId,
  hasActiveFilters,
  onToggleFilters,
  onOpenCustomReport,
  onPrint,
}) => {
  const subtitle = report ? (
    <span className="report-page__sub" aria-label="보고서 메타">
      <span className="item">
        <span className="lbl">생성</span>{" "}
        <span className="v">{formatDateTime(report.generatedAt)}</span>
      </span>
      {projectId ? (
        <>
          <span className="sep" aria-hidden="true">·</span>
          <span className="item">
            <span className="lbl">프로젝트</span>{" "}
            <span className="v mono">{projectId}</span>
          </span>
        </>
      ) : null}
      <span className="sep" aria-hidden="true">·</span>
      <span className="item">
        <span className="lbl">필터</span>{" "}
        <span className="v">{hasActiveFilters ? "적용됨" : "없음"}</span>
      </span>
    </span>
  ) : undefined;

  return (
    <PageHeader
      title="보고서"
      subtitle={subtitle}
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
};
