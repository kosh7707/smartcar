import { useCallback, useEffect, useState } from "react";
import type { RegisteredSdk, SdkRegistryStatus } from "../../../api/sdk";
import { deleteSdk, fetchProjectSdks } from "../../../api/sdk";
import { logError } from "../../../api/core";
import { useSdkProgress, type SdkProgressDetails } from "../../../hooks/useSdkProgress";
import type { SettingsSection } from "../components/ProjectSettingsSidebar";

type ToastApi = {
  error: (message: string) => void;
  success: (message: string) => void;
};

export function useProjectSettingsPage(projectId: string | undefined, toast: ToastApi) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const [registered, setRegistered] = useState<RegisteredSdk[]>([]);
  const [sdkProgressById, setSdkProgressById] = useState<Record<string, SdkProgressDetails>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RegisteredSdk | null>(null);

  const { connectionState: sdkConnectionState } = useSdkProgress({
    projectId,
    onProgress: useCallback((sdkId: string, phase: SdkRegistryStatus, details?: SdkProgressDetails) => {
      setRegistered((prev) => prev.map((sdk) => (sdk.id === sdkId ? { ...sdk, status: phase } : sdk)));
      setSdkProgressById((prev) => (
        details && Object.keys(details).length > 0
          ? { ...prev, [sdkId]: details }
          : prev
      ));
    }, []),
    onComplete: useCallback((sdkId: string, profile: RegisteredSdk["profile"]) => {
      if (!projectId) return;
      setSdkProgressById((prev) => {
        const next = { ...prev };
        delete next[sdkId];
        return next;
      });
      void fetchProjectSdks(projectId)
        .then((data) => {
          const freshSdk = data.registered.find((sdk) => sdk.id === sdkId);
          setRegistered((prev) => prev.map((sdk) => (
            sdk.id === sdkId
              ? freshSdk ?? { ...sdk, status: "ready", profile }
              : sdk
          )));
        })
        .catch((error) => {
          logError("Refresh SDK after complete", error);
          setRegistered((prev) => prev.map((sdk) => (
            sdk.id === sdkId ? { ...sdk, status: "ready", profile } : sdk
          )));
        });
    }, [projectId]),
    onError: useCallback((sdkId: string, error: string, phase?: string, logPath?: string) => {
      const errorStatus = (phase || "verify_failed") as SdkRegistryStatus;
      setRegistered((prev) => prev.map((sdk) => (
        sdk.id === sdkId ? { ...sdk, status: errorStatus, verifyError: error, installLogPath: logPath } : sdk
      )));
      setSdkProgressById((prev) => {
        const next = { ...prev };
        delete next[sdkId];
        return next;
      });
    }, []),
  });

  useEffect(() => {
    document.title = "AEGIS — Project Settings";
  }, []);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await fetchProjectSdks(projectId);
      setRegistered(data.registered);
    } catch (error) {
      logError("Load SDKs", error);
      toast.error("SDK 목록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRegistered = useCallback((sdk: RegisteredSdk) => {
    setRegistered((prev) => [...prev, sdk]);
    setShowForm(false);
  }, []);

  const handleDelete = useCallback(async (sdk: RegisteredSdk) => {
    if (!projectId) return;
    try {
      await deleteSdk(projectId, sdk.id);
      setRegistered((prev) => prev.filter((entry) => entry.id !== sdk.id));
      toast.success(`SDK "${sdk.name}" 삭제 완료`);
    } catch (error) {
      logError("Delete SDK", error);
      toast.error("SDK 삭제에 실패했습니다.");
    }
    setDeleteTarget(null);
  }, [projectId, toast]);

  return {
    activeSection,
    setActiveSection,
    registered,
    sdkProgressById,
    loading,
    showForm,
    setShowForm,
    deleteTarget,
    setDeleteTarget,
    sdkConnectionState,
    handleRegistered,
    handleDelete,
  };
}
