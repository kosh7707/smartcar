import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Project } from "@aegis/shared";
import type { RegisteredSdk, SdkRegistryStatus } from "../../../api/sdk";
import { deleteProject, fetchProject, updateProjectSettings } from "../../../api/projects";
import { deleteSdk, fetchProjectSdks } from "../../../api/sdk";
import { logError } from "../../../api/core";
import { useSdkProgress, type SdkProgressDetails } from "../../../hooks/useSdkProgress";
import type { SettingsSection } from "../components/ProjectSettingsSidebar";

type ToastApi = {
  error: (message: string) => void;
  success: (message: string) => void;
};

const VALID_SECTIONS: SettingsSection[] = ["general", "sdk", "build-targets", "notifications", "adapters", "danger"];

function parseSection(value: string | null): SettingsSection {
  if (value && (VALID_SECTIONS as string[]).includes(value)) return value as SettingsSection;
  return "general";
}

export function useProjectSettingsPage(projectId: string | undefined, toast: ToastApi) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = parseSection(searchParams.get("section"));
  const setActiveSection = useCallback((next: SettingsSection) => {
    setSearchParams((prev) => {
      const copy = new URLSearchParams(prev);
      if (next === "general") copy.delete("section");
      else copy.set("section", next);
      return copy;
    }, { replace: true });
  }, [setSearchParams]);
  const [registered, setRegistered] = useState<RegisteredSdk[]>([]);
  const [sdkProgressById, setSdkProgressById] = useState<Record<string, SdkProgressDetails>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RegisteredSdk | null>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [storedName, setStoredName] = useState("");
  const [storedDescription, setStoredDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDeleteProject, setShowDeleteProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

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
    if (!projectId) {
      setRegistered([]);
      setProject(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [sdks, fetched] = await Promise.allSettled([
        fetchProjectSdks(projectId),
        fetchProject(projectId),
      ]);
      if (sdks.status === "fulfilled") {
        setRegistered(sdks.value.registered);
      } else {
        logError("Load SDKs", sdks.reason);
        toast.error("SDK 목록을 불러올 수 없습니다.");
      }
      if (fetched.status === "fulfilled") {
        setProject(fetched.value);
        const nextName = fetched.value.name ?? "";
        const nextDesc = fetched.value.description ?? "";
        setName(nextName);
        setDescription(nextDesc);
        setStoredName(nextName);
        setStoredDescription(nextDesc);
      } else {
        logError("Load project metadata", fetched.reason);
      }
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

  const dirty = useMemo(
    () => name !== storedName || description !== storedDescription,
    [name, storedName, description, storedDescription],
  );

  const handleNameChange = useCallback((value: string) => setName(value), []);
  const handleDescriptionChange = useCallback((value: string) => setDescription(value), []);

  const handleCancel = useCallback(() => {
    setName(storedName);
    setDescription(storedDescription);
  }, [storedName, storedDescription]);

  const handleSave = useCallback(async () => {
    if (!projectId || !dirty || saving) return;
    setSaving(true);
    try {
      await updateProjectSettings(projectId, { name: name.trim(), description: description.trim() });
      setStoredName(name.trim());
      setStoredDescription(description.trim());
      setName(name.trim());
      setDescription(description.trim());
      toast.success("프로젝트 정보를 저장했습니다.");
    } catch (error) {
      logError("Save project settings", error);
      toast.error("프로젝트 정보를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }, [projectId, dirty, saving, name, description, toast]);

  const handleConfirmDeleteProject = useCallback(async () => {
    if (!projectId) return;
    setDeletingProject(true);
    try {
      await deleteProject(projectId);
      toast.success("프로젝트를 삭제했습니다.");
      setShowDeleteProject(false);
      navigate("/");
    } catch (error) {
      logError("Delete project", error);
      toast.error("프로젝트 삭제에 실패했습니다.");
    } finally {
      setDeletingProject(false);
    }
  }, [projectId, toast, navigate]);

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

    project,
    name,
    description,
    storedName,
    storedDescription,
    dirty,
    saving,
    handleNameChange,
    handleDescriptionChange,
    handleCancel,
    handleSave,

    showDeleteProject,
    setShowDeleteProject,
    deletingProject,
    handleConfirmDeleteProject,
  };
}
