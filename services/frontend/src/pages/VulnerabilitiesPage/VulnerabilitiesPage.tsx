import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type { Severity } from "@aegis/shared";
import { useToast } from "../../contexts/ToastContext";
import { FindingDetailView } from "../../shared/findings/FindingDetailView";
import { Spinner } from "../../shared/ui";
import { VulnerabilitiesHeader } from "./components/VulnerabilitiesHeader";
import { VulnerabilityGroups } from "./components/VulnerabilityGroups";
import { VulnerabilityKeyboardHint } from "./components/VulnerabilityKeyboardHint";
import { VulnerabilityList } from "./components/VulnerabilityList";
import { VulnerabilitiesToolbar } from "./components/VulnerabilitiesToolbar";
import { useVulnerabilitiesPage } from "./hooks/useVulnerabilitiesPage";
import { SEVERITY_KO_LABELS } from "./vulnerabilitiesPresentation";
import "./VulnerabilitiesPage.css";

export const VulnerabilitiesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const activeSeverity = (searchParams.get("severity") as Severity | "all") || "all";
  const state = useVulnerabilitiesPage(
    projectId,
    activeSeverity,
    (severity) => setSearchParams(severity === "all" ? {} : { severity }),
    toast,
  );

  if (state.selectedFindingId) {
    return (
      <FindingDetailView
        findingId={state.selectedFindingId}
        projectId={projectId ?? ""}
        onBack={() => {
          state.setSelectedFindingId(null);
          state.loadFindings();
        }}
      />
    );
  }

  if (state.loading) {
    return (
      <div className="page-loading-shell">
        <Spinner size={36} label="탐지 항목 로딩 중..." />
      </div>
    );
  }

  const showGrouped = state.groupBy !== "none" && state.groups.length > 0;
  const showEmpty = !showGrouped && state.filtered.length === 0;
  const emptyTitle = activeSeverity === "all"
    ? "조건에 맞는 탐지 항목이 없습니다"
    : `${SEVERITY_KO_LABELS[activeSeverity]} 수준의 탐지 항목이 없습니다`;
  const emptyNote = state.hasActiveFilters
    ? "필터를 해제하면 더 많은 항목이 보일 수 있습니다."
    : "분석이 완료되면 이곳에 기록됩니다.";

  return (
    <div className="page-shell vuln-page">
      <VulnerabilitiesHeader
        totalActiveFindings={state.counts.total}
        counts={state.counts}
      />

      <VulnerabilitiesToolbar
        counts={state.counts}
        activeSeverity={activeSeverity}
        sourceTypeFilter={state.sourceTypeFilter}
        statusFilter={state.statusFilter}
        searchQuery={state.searchQuery}
        sortBy={state.sortBy}
        sortOrder={state.sortOrder}
        groupBy={state.groupBy}
        hasActiveFilters={state.hasActiveFilters}
        filteredCount={state.filtered.length}
        totalCount={state.findings.length}
        showShortcutHelp={state.showShortcutHelp}
        selectedCount={state.selectedIds.size}
        bulkStatus={state.bulkStatus}
        bulkReason={state.bulkReason}
        bulkProcessing={state.bulkProcessing}
        setFilter={state.setFilter}
        setSourceTypeFilter={state.setSourceTypeFilter}
        setStatusFilter={state.setStatusFilter}
        setSearchQuery={state.setSearchQuery}
        setSortBy={state.setSortBy}
        setSortOrder={state.setSortOrder}
        setGroupBy={state.setGroupBy}
        setShowShortcutHelp={state.setShowShortcutHelp}
        setBulkStatus={state.setBulkStatus}
        setBulkReason={state.setBulkReason}
        clearSelection={state.clearSelection}
        onBulkAction={state.handleBulkAction}
      />

      {showGrouped ? (
        <VulnerabilityGroups
          groups={state.groups}
          findings={state.findings}
          groupsLoading={state.groupsLoading}
          expandedGroups={state.expandedGroups}
          onToggleGroup={state.toggleGroup}
          onOpenFinding={state.setSelectedFindingId}
        />
      ) : showEmpty ? (
        <div className="vuln-empty" role="status">
          <span className="vuln-empty__stamp" aria-hidden="true">NO ENTRIES</span>
          <p className="vuln-empty__title">{emptyTitle}</p>
          <p className="vuln-empty__note">{emptyNote}</p>
        </div>
      ) : (
        <VulnerabilityList
          findings={state.filtered}
          selectedIds={state.selectedIds}
          highlightIndex={state.highlightIndex}
          onOpenFinding={state.setSelectedFindingId}
          onToggleSelect={state.toggleSelect}
        />
      )}

      <VulnerabilityKeyboardHint />
    </div>
  );
};
