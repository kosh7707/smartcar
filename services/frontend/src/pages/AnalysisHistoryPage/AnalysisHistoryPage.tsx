import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Spinner } from "../../shared/ui";
import { useToast } from "../../contexts/ToastContext";
import { getModuleRoute } from "../../constants/modules";
import { AnalysisHistoryToolbar } from "./components/AnalysisHistoryToolbar";
import { AnalysisHistoryRunsTable } from "./components/AnalysisHistoryRunsTable";
import { useAnalysisHistoryPage } from "./hooks/useAnalysisHistoryPage";
import "./AnalysisHistoryPage.css";

export const AnalysisHistoryPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const {
    loading,
    runs,
    filter,
    setFilter,
    filteredRuns,
    completedCount,
    failedCount,
  } = useAnalysisHistoryPage(projectId, toast);

  useEffect(() => {
    document.title = "AEGIS — 분석 이력";
  }, []);

  if (loading) {
    return (
      <div className="page-shell history-page history-loading-shell">
        <Spinner size={36} label="분석 이력 로딩 중..." />
      </div>
    );
  }

  return (
    <div className="page-shell history-page">
      {/* Page-level panel: heading + toolbar in panel-head */}
      <div className="panel">
        <div className="panel-head">
          <h3>
            분석 이력
            <span className="count" aria-hidden="true">{runs.length}</span>
          </h3>
          <div className="panel-tools">
            <AnalysisHistoryToolbar
              filter={filter}
              onFilterChange={setFilter}
              totalCount={runs.length}
              completedCount={completedCount}
              failedCount={failedCount}
            />
          </div>
        </div>
      </div>

      {/* Runs table panel */}
      <AnalysisHistoryRunsTable
        filter={filter}
        runs={filteredRuns}
        onOpenRun={(run) => {
          if (!projectId) {
            return;
          }
          navigate(getModuleRoute(run.module, projectId, run.analysisResultId));
        }}
      />
    </div>
  );
};
