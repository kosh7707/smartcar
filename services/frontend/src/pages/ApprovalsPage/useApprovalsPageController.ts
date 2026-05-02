import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApprovalRequest } from "@/common/api/approval";
import { decideApproval, fetchProjectApprovals } from "@/common/api/approval";
import { logError } from "@/common/api/core";

export type ApprovalFilterStatus = "all" | "pending" | "approved" | "rejected" | "expired";
export type ApprovalDecisionAction = "approved" | "rejected";

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

export function useApprovalsPageController(projectId: string | undefined, toast: ToastApi) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ApprovalFilterStatus>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

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

  const submitDecision = useCallback(
    async (approvalId: string, action: ApprovalDecisionAction, comment: string) => {
      const trimmed = comment.trim() || undefined;
      setDecidingId(approvalId);
      try {
        await decideApproval(approvalId, action, undefined, trimmed);
        toast.success(action === "approved" ? "승인 완료" : "거부 완료");
        await loadApprovals();
      } catch (error) {
        logError("Decide approval", error);
        toast.error("처리에 실패했습니다.");
      } finally {
        setDecidingId(null);
      }
    },
    [loadApprovals, toast],
  );

  const filteredApprovals = useMemo(() => {
    const base = filter === "all" ? approvals : approvals.filter((approval) => approval.status === filter);
    return [...base].sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      if (a.status === "pending" && b.status === "pending") {
        return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [approvals, filter]);

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
    submitDecision,
    loadApprovals,
    selectedId,
    setSelectedId,
    sevenDayStats,
    imminentCount,
    oldestPendingAge,
  };
}
