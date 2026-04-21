import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApprovalRequest } from "../../../api/approval";
import { decideApproval, fetchProjectApprovals } from "../../../api/approval";
import { logError } from "../../../api/core";

export type ApprovalFilterStatus = "all" | "pending" | "approved" | "rejected" | "expired";
export type ApprovalDecisionAction = "approved" | "rejected";

type ToastApi = {
  error: (message: string) => void;
  success: (message: string) => void;
};

export function useApprovalsPage(projectId: string | undefined, toast: ToastApi) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ApprovalFilterStatus>("all");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decidingAction, setDecidingAction] = useState<ApprovalDecisionAction | null>(null);
  const [comment, setComment] = useState("");
  const [processing, setProcessing] = useState(false);

  const loadApprovals = useCallback(async () => {
    if (!projectId) {
      setApprovals([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const data = await fetchProjectApprovals(projectId);
      setApprovals(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      logError("Load approvals", error);
      toast.error("승인 요청 목록을 불러올 수 없습니다.");
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  const closeDecisionDialog = useCallback(() => {
    setDecidingId(null);
    setDecidingAction(null);
    setComment("");
  }, []);

  const openDecisionDialog = useCallback((approvalId: string, action: ApprovalDecisionAction) => {
    setDecidingId(approvalId);
    setDecidingAction(action);
  }, []);

  const submitDecision = useCallback(async () => {
    if (!decidingId || !decidingAction) return;

    setProcessing(true);

    try {
      await decideApproval(decidingId, decidingAction, undefined, comment.trim() || undefined);
      toast.success(decidingAction === "approved" ? "승인 완료" : "거부 완료");
      closeDecisionDialog();
      await loadApprovals();
    } catch (error) {
      logError("Decide approval", error);
      toast.error("처리에 실패했습니다.");
    } finally {
      setProcessing(false);
    }
  }, [closeDecisionDialog, comment, decidingAction, decidingId, loadApprovals, toast]);

  const filteredApprovals = useMemo(
    () => (filter === "all" ? approvals : approvals.filter((approval) => approval.status === filter)),
    [approvals, filter],
  );

  const pendingCount = useMemo(
    () => approvals.filter((approval) => approval.status === "pending").length,
    [approvals],
  );

  const statusCounts = useMemo(
    () => ({
      all: approvals.length,
      pending: approvals.filter((approval) => approval.status === "pending").length,
      approved: approvals.filter((approval) => approval.status === "approved").length,
      rejected: approvals.filter((approval) => approval.status === "rejected").length,
      expired: approvals.filter((approval) => approval.status === "expired").length,
    }),
    [approvals],
  );

  return {
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
    loadApprovals,
    openDecisionDialog,
    closeDecisionDialog,
    submitDecision,
  };
}
