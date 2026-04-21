import React, { useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ApprovalRequest } from "../../api/approval";
import { Spinner } from "../../shared/ui";
import { cn } from "@/lib/utils";
import { useToast } from "../../contexts/ToastContext";
import { ApprovalDecisionDialog } from "./components/ApprovalDecisionDialog";
import { ApprovalFilters } from "./components/ApprovalFilters";
import { ApprovalRequestList } from "./components/ApprovalRequestList";
import { useApprovalsPage } from "./hooks/useApprovalsPage";

export const ApprovalsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
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
  } = useApprovalsPage(projectId, toast);

  useEffect(() => {
    document.title = "AEGIS — 승인 큐";
  }, []);

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

  const totalCount = approvals.length;

  return (
    <div className="page-shell approvals-shell" data-chore>
      <header className="page-head chore c-1">
        <div>
          <h1>승인 큐</h1>
          <div className="sub">
            <span className="sub-caps">TOTAL</span>
            <b>{totalCount}</b>
            <span className="sep" aria-hidden="true">·</span>
            <span className="sub-caps">PENDING</span>
            <b className={cn(pendingCount > 0 && "is-warn")}>{pendingCount}</b>
            {statusCounts.approved > 0 && (
              <>
                <span className="sep" aria-hidden="true">·</span>
                <span className="sub-caps">APPROVED</span>
                <b>{statusCounts.approved}</b>
              </>
            )}
            {statusCounts.rejected > 0 && (
              <>
                <span className="sep" aria-hidden="true">·</span>
                <span className="sub-caps">REJECTED</span>
                <b>{statusCounts.rejected}</b>
              </>
            )}
            {statusCounts.expired > 0 && (
              <>
                <span className="sep" aria-hidden="true">·</span>
                <span className="sub-caps">EXPIRED</span>
                <b>{statusCounts.expired}</b>
              </>
            )}
          </div>
        </div>
      </header>

      <ApprovalFilters filter={filter} onChange={setFilter} statusCounts={statusCounts} />

      <ApprovalRequestList
        approvals={filteredApprovals}
        filter={filter}
        onOpenTarget={handleTargetOpen}
        onStartDecision={openDecisionDialog}
      />

      {decidingId && decidingAction && (
        <ApprovalDecisionDialog
          action={decidingAction}
          comment={comment}
          processing={processing}
          onClose={closeDecisionDialog}
          onCommentChange={setComment}
          onConfirm={submitDecision}
        />
      )}
    </div>
  );
};
