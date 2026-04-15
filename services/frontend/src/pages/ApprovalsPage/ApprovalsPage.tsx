import React, { useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ApprovalRequest } from "../../api/approval";
import { PageHeader, Spinner } from "../../shared/ui";
import { useToast } from "../../contexts/ToastContext";
import { ApprovalDecisionDialog } from "./components/ApprovalDecisionDialog";
import { ApprovalFilters } from "./components/ApprovalFilters";
import { ApprovalRequestList } from "./components/ApprovalRequestList";
import { useApprovalsPage } from "./hooks/useApprovalsPage";
import "./ApprovalsPage.css";

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
    document.title = "AEGIS — Approvals";
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
      <div className="page-enter centered-loader">
        <Spinner size={36} label="승인 요청 로딩 중..." />
      </div>
    );
  }

  return (
    <div className="page-enter approvals-page">
      <PageHeader
        surface="plain"
        title="승인 큐"
        subtitle={pendingCount > 0 ? `${pendingCount}건의 승인 요청이 대기 중입니다` : "현재 승인 상태를 검토합니다."}
      />

      <ApprovalFilters
        filter={filter}
        onChange={setFilter}
        pendingCount={pendingCount}
        totalCount={approvals.length}
      />

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
