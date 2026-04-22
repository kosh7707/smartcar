import React from "react";
import { useParams } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { Spinner } from "../../shared/ui";
import { ReportContent } from "./components/ReportContent";
import { ReportUnavailableState } from "./components/ReportUnavailableState";
import { useReportPage } from "./hooks/useReportPage";
import "./ReportPage.css";

export const ReportPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const toast = useToast();
  const {
    report,
    loading,
    loadError,
    activeTab,
    setActiveTab,
    showFilters,
    setShowFilters,
    showCustomReport,
    setShowCustomReport,
    pendingFilters,
    setPendingFilters,
    hasActiveFilters,
    loadReport,
    handleApplyFilters,
    handleClearFilters,
    moduleEntries,
    allFindings,
    allRuns,
    summary,
    sevCounts,
    sevMax,
  } = useReportPage(projectId, toast);

  if (loading) {
    return (
      <div className="page-loading-shell">
        <Spinner label="보고서 생성 중..." />
      </div>
    );
  }

  if (!report) {
    return (
      <ReportUnavailableState
        loadError={loadError}
        hasActiveFilters={hasActiveFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onOpenCustomReport={() => setShowCustomReport(true)}
        onRetry={loadReport}
      />
    );
  }

  return (
    <ReportContent
      projectId={projectId}
      report={report}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      showFilters={showFilters}
      setShowFilters={setShowFilters}
      showCustomReport={showCustomReport}
      setShowCustomReport={setShowCustomReport}
      pendingFilters={pendingFilters}
      setPendingFilters={setPendingFilters}
      hasActiveFilters={hasActiveFilters}
      handleApplyFilters={handleApplyFilters}
      handleClearFilters={handleClearFilters}
      moduleEntries={moduleEntries}
      allFindings={allFindings}
      allRuns={allRuns}
      sevCounts={sevCounts}
      sevMax={sevMax}
    />
  );
};
