import { useCallback, useEffect, useMemo, useState } from "react";
import type { GateResult } from "../../../api/gate";
import { fetchProjectGates, overrideGate } from "../../../api/gate";
import { logError } from "../../../api/core";
import { sortGatesByEvaluatedAt } from "../qualityGatePresentation";

type ToastApi = {
  error: (message: string) => void;
  success: (message: string) => void;
};

export function useQualityGatePage(projectId: string | undefined, toast: ToastApi) {
  const [gates, setGates] = useState<GateResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrideTarget, setOverrideTarget] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overriding, setOverriding] = useState(false);

  const loadGates = useCallback(async () => {
    if (!projectId) {
      setGates([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const data = await fetchProjectGates(projectId);
      setGates(data.sort(sortGatesByEvaluatedAt));
    } catch (error) {
      logError("Load quality gates", error);
      toast.error("품질 게이트 결과를 불러올 수 없습니다.");
      setGates([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    void loadGates();
  }, [loadGates]);

  const resetOverrideDraft = useCallback(() => {
    setOverrideTarget(null);
    setOverrideReason("");
  }, []);

  const handleOverride = useCallback(async () => {
    if (!overrideTarget || !overrideReason.trim()) return;

    setOverriding(true);

    try {
      await overrideGate(overrideTarget, overrideReason.trim());
      toast.success("품질 게이트 오버라이드 완료");
      resetOverrideDraft();
      await loadGates();
    } catch (error) {
      logError("Override gate", error);
      toast.error("오버라이드에 실패했습니다.");
    } finally {
      setOverriding(false);
    }
  }, [loadGates, overrideReason, overrideTarget, resetOverrideDraft, toast]);

  const latestGate = useMemo(() => gates[0] ?? null, [gates]);

  return {
    gates,
    latestGate,
    loading,
    overrideTarget,
    setOverrideTarget,
    overrideReason,
    setOverrideReason,
    overriding,
    resetOverrideDraft,
    handleOverride,
  };
}
