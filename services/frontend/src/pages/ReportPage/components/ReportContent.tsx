import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CustomReportModal } from "./CustomReportModal";
import { ReportApprovalsSection } from "./ReportApprovalsSection";
import { ReportAuditLogSection } from "./ReportAuditLogSection";
import { ReportAuditTimelineCard } from "./ReportAuditTimelineCard";
import { ReportExecutiveSummary } from "./ReportExecutiveSummary";
import { ReportFiltersPanel } from "./ReportFiltersPanel";
import { ReportFindingsSection } from "./ReportFindingsSection";
import { ReportHeader } from "./ReportHeader";
import { ReportModuleBreakdown } from "./ReportModuleBreakdown";
import { ReportRunsSection } from "./ReportRunsSection";
import { MODULE_TAB_LABELS, type ModuleTab, type ReportModuleEntry } from "../reportPresentation";
import type { ReportFilters } from "../../../api/client";

type ReportContentProps = {
  projectId?: string;
  report: ProjectReport;
  activeTab: ModuleTab;
  setActiveTab: (tab: ModuleTab) => void;
  showFilters: boolean;
  setShowFilters: (value: boolean) => void;
  showCustomReport: boolean;
  setShowCustomReport: (value: boolean) => void;
  pendingFilters: ReportFilters;
  setPendingFilters: (filters: ReportFilters) => void;
  hasActiveFilters: boolean;
  handleApplyFilters: () => void;
  handleClearFilters: () => void;
  moduleEntries: ReportModuleEntry[];
  allFindings: ProjectReport["modules"][keyof ProjectReport["modules"]]["findings"];
  allRuns: Array<{ gate?: { status?: string | null } | null }>;
  sevCounts: { critical: number; high: number; medium: number; low: number };
  sevMax: number;
};

export function ReportContent({
  projectId,
  report,
  activeTab,
  setActiveTab,
  showFilters,
  setShowFilters,
  showCustomReport,
  setShowCustomReport,
  pendingFilters,
  setPendingFilters,
  hasActiveFilters,
  handleApplyFilters,
  handleClearFilters,
  moduleEntries,
  allFindings,
  allRuns,
  sevCounts,
  sevMax,
}: ReportContentProps) {
  return (
    <div className="page-enter report-page">
      <ReportHeader
        generatedAt={report.generatedAt}
        hasActiveFilters={hasActiveFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onOpenCustomReport={() => setShowCustomReport(true)}
        onPrint={() => window.print()}
      />

      {showFilters && (
        <ReportFiltersPanel
          pendingFilters={pendingFilters}
          setPendingFilters={setPendingFilters}
          hasActiveFilters={hasActiveFilters}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
        />
      )}

      <div className="report-tabs print-hide">
        {(Object.keys(MODULE_TAB_LABELS) as ModuleTab[]).map((tab) => (
          <Button
            key={tab}
            type="button"
            variant={activeTab === tab ? "default" : "outline"}
            className={cn("report-tabs__item", activeTab === tab && "report-tabs__item--active")}
            onClick={() => setActiveTab(tab)}
          >
            {MODULE_TAB_LABELS[tab]}
          </Button>
        ))}
      </div>

      <div className="report-bento">
        <ReportExecutiveSummary
          report={report}
          allRuns={allRuns}
          summary={activeTab === "all" ? report.totalSummary : moduleEntries[0]?.mod.summary ?? report.totalSummary}
          sevCounts={sevCounts}
          sevMax={sevMax}
        />
        <ReportAuditTimelineCard auditTrail={report.auditTrail} />
      </div>

      {activeTab === "all" && (
        <ReportModuleBreakdown moduleEntries={moduleEntries} />
      )}

      <ReportFindingsSection findings={allFindings} />
      <ReportRunsSection runs={allRuns as never} />

      {activeTab === "all" && report.approvals.length > 0 && (
        <ReportApprovalsSection approvals={report.approvals} />
      )}

      {activeTab === "all" && report.auditTrail.length > 0 && (
        <ReportAuditLogSection auditTrail={report.auditTrail} />
      )}

      {showCustomReport && projectId && (
        <CustomReportModal projectId={projectId} onClose={() => setShowCustomReport(false)} />
      )}
    </div>
  );
}
