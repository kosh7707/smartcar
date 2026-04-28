import React, { useCallback, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ApprovalRequest } from "../../api/approval";
import { Spinner } from "../../shared/ui";
import { useToast } from "../../contexts/ToastContext";
import { ApprovalHero } from "./components/ApprovalHero";
import { ApprovalPanelLayout } from "./components/ApprovalPanelLayout";
import { ApprovalToolbar } from "./components/ApprovalToolbar";
import { useApprovalsPage } from "./hooks/useApprovalsPage";
import "./ApprovalsPage.css";

export const ApprovalsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    loading,
    filter,
    setFilter,
    filteredApprovals,
    statusCounts,
    pendingCount,
    decidingId,
    submitDecision,
    selectedId,
    setSelectedId,
    sevenDayStats,
    imminentCount,
    oldestPendingAge,
  } = useApprovalsPage(projectId, toast);

  useEffect(() => {
    document.title = "AEGIS — 승인 큐";
  }, []);

  // URL ↔ selected sync (?selected=APR-XXXX)
  useEffect(() => {
    const urlSelected = searchParams.get("selected");
    if (urlSelected && urlSelected !== selectedId) {
      setSelectedId(urlSelected);
    } else if (!urlSelected && selectedId) {
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedId) {
      next.set("selected", selectedId);
    } else {
      next.delete("selected");
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleTargetOpen = useCallback(
    (approval: ApprovalRequest) => {
      if (!projectId) return;
      navigate(
        approval.actionType === "gate.override"
          ? `/projects/${projectId}/quality-gate`
          : `/projects/${projectId}/vulnerabilities`,
      );
    },
    [navigate, projectId],
  );

  if (loading) {
    return (
      <div className="page-loading-shell">
        <Spinner size={36} label="승인 요청 로딩 중..." />
      </div>
    );
  }

  const hasProject = Boolean(projectId);

  return (
    <div className="page-shell approvals-page">
      <header className="page-head approvals-page__head">
        <h1>승인 큐</h1>
        <ApprovalHero
          pendingCount={pendingCount}
          imminentCount={imminentCount}
          oldestPendingAge={oldestPendingAge}
          sevenDayStats={sevenDayStats}
          isEmpty={pendingCount === 0}
        />
      </header>

      <ApprovalToolbar
        filter={filter}
        onChangeFilter={setFilter}
        statusCounts={statusCounts}
      />

      <div className="approvals-body">
        <ApprovalPanelLayout
          approvals={filteredApprovals}
          filter={filter}
          selectedId={selectedId}
          decidingId={decidingId}
          hasProject={hasProject}
          sevenDayStats={sevenDayStats}
          onSelect={setSelectedId}
          onOpenTarget={handleTargetOpen}
          onDecide={submitDecision}
        />
      </div>
    </div>
  );
};
