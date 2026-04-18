import React from "react";
import type { ProjectReport } from "@aegis/shared";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <div className="page-enter space-y-6">
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

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ModuleTab)}
        className="print-hide"
      >
        <TabsList
          variant="line"
          className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-border p-0"
        >
          {(Object.keys(MODULE_TAB_LABELS) as ModuleTab[]).map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-active:border-primary data-active:text-foreground"
            >
              {MODULE_TAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.95fr)]">
        <ReportExecutiveSummary
          report={report}
          allRuns={allRuns}
          summary={activeTab === "all" ? report.totalSummary : moduleEntries[0]?.mod.summary ?? report.totalSummary}
          sevCounts={sevCounts}
          sevMax={sevMax}
        />
        <ReportAuditTimelineCard auditTrail={report.auditTrail} />
      </div>

      {activeTab === "all" && <ReportModuleBreakdown moduleEntries={moduleEntries} />}

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
