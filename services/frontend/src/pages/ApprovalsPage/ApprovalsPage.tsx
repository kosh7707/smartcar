import React, { useCallback, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ApprovalRequest } from "../../api/approval";
import { Spinner } from "../../shared/ui";
import { useToast } from "../../contexts/ToastContext";
import { ApprovalDecisionDialog } from "./components/ApprovalDecisionDialog";
import { ApprovalEmptyState } from "./components/ApprovalEmptyState";
import { ApprovalHero } from "./components/ApprovalHero";
import { ApprovalPanelLayout } from "./components/ApprovalPanelLayout";
import { ApprovalRequestList } from "./components/ApprovalRequestList";
import { ApprovalToolbar } from "./components/ApprovalToolbar";
import { useApprovalsPage } from "./hooks/useApprovalsPage";
import "./ApprovalsPage.css";

export const ApprovalsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    approvals,
    loading,
    filter,
    setFilter,
    filteredApprovals,
    statusCounts,
    pendingCount,
    decidingId,
    decidingAction,
    comment,
    setComment,
    processing,
    openDecisionDialog,
    closeDecisionDialog,
    submitDecision,
    view,
    setView,
    selectedId,
    setSelectedId,
    sortMode,
    setSortMode,
    sevenDayStats,
    imminentCount,
    oldestPendingAge,
  } = useApprovalsPage(projectId, toast);

  useEffect(() => {
    document.title = "AEGIS — 승인 큐";
  }, []);

  // URL → state hydration (?view=panel&selected=APR-XXXX). Runs only when the
  // search params change (e.g. back/refresh) so internal state changes don't
  // ping-pong with the URL writer below.
  useEffect(() => {
    const urlView = searchParams.get("view");
    if ((urlView === "panel" || urlView === "list") && urlView !== view) {
      setView(urlView);
    }
    const urlSelected = searchParams.get("selected");
    if (urlSelected && urlSelected !== selectedId) {
      setSelectedId(urlSelected);
    } else if (!urlSelected && selectedId) {
      // selection cleared via URL (e.g. user removed param manually)
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // state → URL writer (canonical: omit `?view=list` since it's the default).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (view === "panel") {
      next.set("view", "panel");
    } else {
      next.delete("view");
    }
    if (view === "panel" && selectedId) {
      next.set("selected", selectedId);
    } else {
      next.delete("selected");
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedId]);

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

  const decidingApproval = useMemo(
    () => (decidingId ? approvals.find((approval) => approval.id === decidingId) ?? null : null),
    [approvals, decidingId],
  );

  if (loading) {
    return (
      <div className="page-loading-shell">
        <Spinner size={36} label="승인 요청 로딩 중..." />
      </div>
    );
  }

  const isEmpty = filteredApprovals.length === 0;
  const hasProject = Boolean(projectId);

  return (
    <div className="page-shell approvals-page" data-view={view}>
      <header className="page-head approvals-page__head">
        <div className="approvals-page__head-copy">
          <h1>승인 큐</h1>
          <p className="page-head__subtitle">
            Quality Gate 오버라이드 · Finding 위험 수용 요청을 검토하고 결정 이력을 기록합니다.
          </p>
        </div>
        <ApprovalHero
          pendingCount={pendingCount}
          imminentCount={imminentCount}
          oldestPendingAge={oldestPendingAge}
          sevenDayStats={sevenDayStats}
          isEmpty={pendingCount === 0}
        />
      </header>

      <section className="panel approvals-page__queue" aria-label="승인 요청 목록">
        <div className="panel-head approvals-page__panel-head">
          <h3>
            요청 목록 <span className="count">{filteredApprovals.length}</span>
          </h3>
        </div>
        <ApprovalToolbar
          filter={filter}
          onChangeFilter={setFilter}
          statusCounts={statusCounts}
          view={view}
          onChangeView={setView}
          sortMode={sortMode}
          onChangeSort={setSortMode}
        />

        {view === "panel" ? (
          <ApprovalPanelLayout
            approvals={filteredApprovals}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpenTarget={handleTargetOpen}
            onStartDecision={openDecisionDialog}
            emptyHint={sevenDayStats}
          />
        ) : isEmpty ? (
          <ApprovalEmptyState filter={filter} sevenDayStats={sevenDayStats} hasProject={hasProject} />
        ) : (
          <>
            <div className="section-divider">
              <span className="lab">{filter === "pending" ? "작업 필요" : "결정 이력"}</span>
              <span className="line" aria-hidden="true" />
              <span className="count">{filteredApprovals.length}건</span>
            </div>
            <ApprovalRequestList
              approvals={filteredApprovals}
              onOpenTarget={handleTargetOpen}
              onStartDecision={openDecisionDialog}
            />
          </>
        )}
      </section>

      {decidingId && decidingAction && (
        <ApprovalDecisionDialog
          action={decidingAction}
          comment={comment}
          processing={processing}
          approval={decidingApproval}
          onClose={closeDecisionDialog}
          onCommentChange={setComment}
          onConfirm={submitDecision}
        />
      )}
    </div>
  );
};
