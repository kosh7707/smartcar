import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type { Severity } from "@aegis/shared";
import { useToast } from "../../contexts/ToastContext";
import { FindingDetailView } from "../../shared/findings/FindingDetailView";
import { EmptyState, Spinner } from "../../shared/ui";
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

  return (
    <div className="page-shell">
      <VulnerabilitiesHeader totalActiveFindings={state.counts.total} />

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

      {state.groupBy !== "none" && state.groups.length > 0 && (
        <VulnerabilityGroups
          groups={state.groups}
          findings={state.findings}
          groupsLoading={state.groupsLoading}
          expandedGroups={state.expandedGroups}
          onToggleGroup={state.toggleGroup}
          onOpenFinding={state.setSelectedFindingId}
        />
      )}

      {state.groupBy !== "none" && state.groups.length > 0 ? null : state.filtered.length === 0 ? (
        <EmptyState
          className="empty-state--workspace"
          title={
            activeSeverity === "all"
              ? "조건에 맞는 탐지 항목이 없습니다"
              : `${SEVERITY_KO_LABELS[activeSeverity]} 수준의 탐지 항목이 없습니다`
          }
        />
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
