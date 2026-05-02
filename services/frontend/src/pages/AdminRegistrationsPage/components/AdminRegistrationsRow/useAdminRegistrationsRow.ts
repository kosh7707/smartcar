import { useCallback, useState } from "react";
import type { UserRole } from "@aegis/shared";

export function useAdminRegistrationsRow(
  requestId: string,
  onApprove: (id: string, role: UserRole) => void,
  onReject: (id: string, reason: string) => Promise<boolean>,
) {
  const [role, setRole] = useState<UserRole>("analyst");
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");

  const enterRejectMode = useCallback(() => setRejectMode(true), []);
  const cancelReject = useCallback(() => {
    setRejectMode(false);
    setReason("");
  }, []);

  const approve = useCallback(() => onApprove(requestId, role), [onApprove, requestId, role]);

  const confirmReject = useCallback(async () => {
    const ok = await onReject(requestId, reason);
    if (ok) {
      setRejectMode(false);
      setReason("");
    }
  }, [onReject, requestId, reason]);

  return {
    role,
    setRole,
    rejectMode,
    enterRejectMode,
    cancelReject,
    reason,
    setReason,
    approve,
    confirmReject,
  };
}
