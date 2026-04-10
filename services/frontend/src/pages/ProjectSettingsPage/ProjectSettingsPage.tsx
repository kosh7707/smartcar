import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Archive, Settings } from "lucide-react";
import type { RegisteredSdk, SdkRegistryStatus } from "../../api/sdk";
import { deleteSdk, fetchProjectSdks } from "../../api/sdk";
import { logError } from "../../api/core";
import { useToast } from "../../contexts/ToastContext";
import { useSdkProgress, type SdkProgressDetails } from "../../hooks/useSdkProgress";
import { ConfirmDialog, ConnectionStatusBanner, Spinner } from "../../shared/ui";
import { ProjectSettingsSidebar, type SettingsSection } from "./components/ProjectSettingsSidebar";
import { ProjectSettingsHeader } from "./components/ProjectSettingsHeader";
import { GeneralSettingsSection } from "./components/GeneralSettingsSection";
import { SdkManagementSection } from "./components/SdkManagementSection";
import { DangerZoneSection } from "./components/DangerZoneSection";
import { PlaceholderSettingsSection } from "./components/PlaceholderSettingsSection";
import "./ProjectSettingsPage.css";

export const ProjectSettingsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const toast = useToast();
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

  if (loading) {
    return (
      <div className="page-enter centered-loader">
        <Spinner size={36} label="설정 로딩 중..." />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <ConnectionStatusBanner connectionState={sdkConnectionState} />
      <ProjectSettingsHeader />

      <div className="project-settings-layout">
        <ProjectSettingsSidebar activeSection={activeSection} onSelect={setActiveSection} />

        <div className="project-settings-content">
          {activeSection === "general" && <GeneralSettingsSection />}

          {activeSection === "sdk" && projectId && (
            <SdkManagementSection
              projectId={projectId}
              registered={registered}
              sdkProgressById={sdkProgressById}
              showForm={showForm}
              onToggleForm={() => setShowForm((prev) => !prev)}
              onRegistered={handleRegistered}
              onCancelForm={() => setShowForm(false)}
              onRequestDelete={setDeleteTarget}
            />
          )}

          {activeSection === "build-targets" && (
            <PlaceholderSettingsSection
              icon={<Archive size={28} />}
              title="빌드 타겟 설정은 준비 중입니다"
              description="이 기능은 곧 제공될 예정입니다."
            />
          )}

          {activeSection === "notifications" && (
            <PlaceholderSettingsSection
              icon={<Settings size={28} />}
              title="프로젝트 알림 설정은 준비 중입니다"
              description="이 기능은 곧 제공될 예정입니다."
            />
          )}

          {activeSection === "adapters" && (
            <PlaceholderSettingsSection
              icon={<Settings size={28} />}
              title="동적 분석 어댑터 설정은 준비 중입니다"
              description="이 기능은 곧 제공될 예정입니다."
            />
          )}

          {activeSection === "danger" && <DangerZoneSection />}
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="SDK 삭제"
        message={deleteTarget ? `"${deleteTarget.name}" SDK를 삭제하시겠습니까?` : ""}
        confirmLabel="삭제"
        danger
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
