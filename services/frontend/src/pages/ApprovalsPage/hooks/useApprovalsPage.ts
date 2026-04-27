import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApprovalRequest } from "../../../api/approval";
import { decideApproval, fetchProjectApprovals } from "../../../api/approval";
import { logError } from "../../../api/core";

export type ApprovalFilterStatus = "all" | "pending" | "approved" | "rejected" | "expired";
export type ApprovalDecisionAction = "approved" | "rejected";
export type ApprovalView = "list" | "panel";
export type ApprovalSortMode = "expires" | "created";

type ToastApi = {
  error: (message: string) => void;
  success: (message: string) => void;
};

export interface ApprovalSevenDayStats {
  resolved: number;
  avgDecisionMs: number | null;
}

const DAY_MS = 86_400_000;

function computeSevenDayStats(approvals: ApprovalRequest[]): ApprovalSevenDayStats {
  const cutoff = Date.now() - 7 * DAY_MS;
  let resolved = 0;
  let totalMs = 0;
  let withDecision = 0;
  for (const approval of approvals) {
    if (approval.status !== "approved" && approval.status !== "rejected") continue;
    if (!approval.decision) continue;
    const decidedAt = new Date(approval.decision.decidedAt).getTime();
    if (Number.isNaN(decidedAt) || decidedAt < cutoff) continue;
    resolved += 1;
    const createdAt = new Date(approval.createdAt).getTime();
    if (!Number.isNaN(createdAt)) {
      totalMs += Math.max(0, decidedAt - createdAt);
      withDecision += 1;
    }
  }
  const avgDecisionMs = withDecision > 0 ? Math.round(totalMs / withDecision) : null;
  return { resolved, avgDecisionMs };
}

export function useApprovalsPage(projectId: string | undefined, toast: ToastApi) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ApprovalFilterStatus>("pending");
  const [view, setView] = useState<ApprovalView>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<ApprovalSortMode>("expires");
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

  const filteredApprovals = useMemo(() => {
    const base = filter === "all" ? approvals : approvals.filter((approval) => approval.status === filter);
    if (sortMode !== "expires") return base;
    // imminent (lower expiresAt) first for pending; otherwise keep created-desc baseline
    return [...base].sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      const aExp = new Date(a.expiresAt).getTime();
      const bExp = new Date(b.expiresAt).getTime();
      if (a.status === "pending" && b.status === "pending") return aExp - bExp;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [approvals, filter, sortMode]);

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

  const sevenDayStats = useMemo(() => computeSevenDayStats(approvals), [approvals]);

  const imminentCount = useMemo(() => {
    const horizon = Date.now() + 24 * 60 * 60 * 1000;
    return approvals.filter(
      (approval) =>
        approval.status === "pending" && new Date(approval.expiresAt).getTime() <= horizon,
    ).length;
  }, [approvals]);

  const oldestPendingAge = useMemo(() => {
    const now = Date.now();
    let oldest: number | null = null;
    for (const approval of approvals) {
      if (approval.status !== "pending") continue;
      const created = new Date(approval.createdAt).getTime();
      if (Number.isNaN(created)) continue;
      const age = now - created;
      if (oldest === null || age > oldest) oldest = age;
    }
    return oldest;
  }, [approvals]);

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
    view,
    setView,
    selectedId,
    setSelectedId,
    sortMode,
    setSortMode,
    sevenDayStats,
    imminentCount,
    oldestPendingAge,
  };
}
