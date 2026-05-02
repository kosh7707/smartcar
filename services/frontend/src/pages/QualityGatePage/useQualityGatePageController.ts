import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GateProfile } from "@aegis/shared";
import type { GateResult } from "@/common/api/gate";
import { fetchGateProfile, fetchProjectGates, overrideGate } from "@/common/api/gate";
import { logError } from "@/common/api/core";
import { sortGatesByEvaluatedAt } from "./qualityGatePresentation";

type ToastApi = {
  error: (message: string) => void;
  success: (message: string) => void;
};

export function useQualityGatePageController(projectId: string | undefined, toast: ToastApi) {
  const [gates, setGates] = useState<GateResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrideTarget, setOverrideTarget] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overriding, setOverriding] = useState(false);
  const [gateProfilesById, setGateProfilesById] = useState<Record<string, GateProfile>>({});

  // Page-lifecycle dedupe cache: same profileId resolves to one in-flight promise.
  // Discarded on unmount (cleanup below).
  const profilePromiseCacheRef = useRef<Map<string, Promise<GateProfile>>>(new Map());

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

  // Cross-fetch the GateProfile for any gate.profileId we have not seen.
  // Map cache dedupes — same profileId resolves once even with parallel demand.
  useEffect(() => {
    if (gates.length === 0) return;

    const cache = profilePromiseCacheRef.current;
    const seen = new Set<string>();
    let cancelled = false;

    for (const gate of gates) {
      const profileId = gate.profileId;
      if (!profileId || seen.has(profileId)) continue;
      seen.add(profileId);
      if (gateProfilesById[profileId]) continue;

      let pending = cache.get(profileId);
      if (!pending) {
        pending = fetchGateProfile(profileId);
        cache.set(profileId, pending);
      }

      void pending
        .then((profile) => {
          if (cancelled) return;
          setGateProfilesById((prev) =>
            prev[profileId] ? prev : { ...prev, [profileId]: profile },
          );
        })
        .catch((error) => {
          // Failure here is non-fatal — the gate card simply renders without
          // the profile name. Drop the cached promise so a future render can retry.
          cache.delete(profileId);
          logError("Load gate profile", error);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [gates, gateProfilesById]);

  // Discard the dedupe cache on unmount to avoid leaking stale promises.
  useEffect(() => {
    const cache = profilePromiseCacheRef.current;
    return () => {
      cache.clear();
    };
  }, []);

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
    gateProfilesById,
  };
}
