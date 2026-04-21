import { useCallback, useEffect, useState } from "react";
import type { RegistrationRequest, UserRole } from "@aegis/shared";
import {
  approveRegistrationRequest,
  listRegistrationRequests,
  rejectRegistrationRequest,
} from "../../../api/auth";

type BusyMap = Record<string, "approve" | "reject" | undefined>;

export function useAdminRegistrations() {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyMap>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listRegistrationRequests();
      setRequests(data);
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : "가입 요청 목록을 불러오지 못했습니다.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "AEGIS — 관리자 · 가입 요청";
    void refresh();
  }, [refresh]);

  const approve = useCallback(async (id: string, role: UserRole) => {
    setActionError(null);
    setBusy((prev) => ({ ...prev, [id]: "approve" }));
    try {
      const updated = await approveRegistrationRequest(id, role);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : "승인 처리에 실패했습니다.";
      setActionError(message);
    } finally {
      setBusy((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, []);

  const reject = useCallback(async (id: string, reason: string) => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setActionError("반려 사유를 입력해 주세요.");
      return false;
    }
    setActionError(null);
    setBusy((prev) => ({ ...prev, [id]: "reject" }));
    try {
      const updated = await rejectRegistrationRequest(id, trimmed);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      return true;
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : "반려 처리에 실패했습니다.";
      setActionError(message);
      return false;
    } finally {
      setBusy((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, []);

  const counts = {
    pending: requests.filter((r) => r.status === "pending_admin_review").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  return {
    requests,
    counts,
    loading,
    loadError,
    actionError,
    busy,
    refresh,
    approve,
    reject,
    clearActionError: () => setActionError(null),
  };
}
