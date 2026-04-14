import { useCallback, useEffect, useState } from "react";
import type { BuildProfile, BuildTarget } from "@aegis/shared";
import { fetchSourceFiles, logError } from "../../../api/client";
import type { SourceFileEntry } from "../../../api/client";
import { fetchProjectSdks } from "../../../api/sdk";
import type { RegisteredSdk } from "../../../api/sdk";
import { useToast } from "../../../contexts/ToastContext";
import { useBuildTargets } from "../../../hooks/useBuildTargets";
import { usePipelineProgress } from "../../../hooks/usePipelineProgress";

export const INCLUDED_PATHS_EDIT_GUARD_TEXT = "현재 백엔드 계약상 includedPaths는 수정 API에서 지원되지 않습니다. 이름과 빌드 프로필만 변경할 수 있으며, 파일 구성을 바꾸려면 새 BuildTarget을 생성해야 합니다.";

export const DEFAULT_PROFILE: BuildProfile = {
  sdkId: "none",
  compiler: "gcc",
  targetArch: "x86_64",
  languageStandard: "c17",
  headerLanguage: "auto",
};

export const POST_BUILD_STATUSES = new Set(["built", "scanning", "scanned", "scan_failed", "graphing", "graphed", "graph_failed", "ready"]);

export function useBuildTargetSection(projectId: string, onStartDeepAnalysis?: (buildTargetIds: string[]) => void) {
  const toast = useToast();
  const buildTargets = useBuildTargets(projectId);
  const pipeline = usePipelineProgress();
  const [registeredSdks, setRegisteredSdks] = useState<RegisteredSdk[]>([]);
  const [sourceFiles, setSourceFiles] = useState<SourceFileEntry[]>([]);
  const [formMode, setFormMode] = useState<"add" | null>(null);
  const [formName, setFormName] = useState("");
  const [formPath, setFormPath] = useState("");
  const [formProfile, setFormProfile] = useState<BuildProfile>(DEFAULT_PROFILE);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BuildTarget | null>(null);
  const [logTarget, setLogTarget] = useState<{ id: string; name: string } | null>(null);
  const [editingTarget, setEditingTarget] = useState<BuildTarget | null>(null);

  useEffect(() => {
    fetchProjectSdks(projectId)
      .then((data) => setRegisteredSdks(data.registered))
      .catch(() => setRegisteredSdks([]));
    fetchSourceFiles(projectId)
      .then(setSourceFiles)
      .catch(() => setSourceFiles([]));
  }, [projectId]);

  const openAddForm = useCallback(() => {
    setEditingTarget(null);
    setFormMode("add");
    setFormName("");
    setFormPath("");
    setFormProfile(DEFAULT_PROFILE);
  }, []);

  const closeForm = useCallback(() => {
    setFormMode(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formName.trim()) {
      toast.error("타겟 이름을 입력해주세요.");
      return;
    }
    if (formMode === "add" && !formPath.trim()) {
      toast.error("상대 경로를 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      if (formMode === "add") {
        await buildTargets.add(formName.trim(), formPath.trim(), formProfile);
        toast.success(`타겟 "${formName.trim()}" 추가됨`);
      }
      closeForm();
    } catch (error) {
      logError("Save build target", error);
      toast.error("타겟 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [buildTargets, closeForm, formMode, formName, formPath, formProfile, toast]);

  const handleDelete = useCallback(async (target: BuildTarget) => {
    try {
      await buildTargets.remove(target.id);
      toast.success(`타겟 "${target.name}" 삭제됨`);
    } catch (error) {
      logError("Delete build target", error);
      toast.error("타겟 삭제에 실패했습니다.");
    }
    setDeleteTarget(null);
  }, [buildTargets, toast]);

  const handleDiscover = useCallback(async () => {
    try {
      const discovered = await buildTargets.discover();
      toast.success(`${discovered.length}개 빌드 타겟 발견`);
    } catch {
      toast.error("타겟 탐색에 실패했습니다.");
    }
  }, [buildTargets, toast]);

  const handleRunPipeline = useCallback(async () => {
    try {
      await pipeline.startPipeline(projectId);
      toast.success("빌드 & 분석 파이프라인 시작");
    } catch {
      toast.error("파이프라인 실행에 실패했습니다.");
    }
  }, [pipeline, projectId, toast]);

  const handleRetryTarget = useCallback(async (targetId: string) => {
    try {
      await pipeline.retryTarget(projectId, targetId);
      toast.success("재실행 시작");
    } catch {
      toast.error("재실행에 실패했습니다.");
    }
  }, [pipeline, projectId, toast]);

  const handleDeepAnalysis = useCallback((targetId: string) => {
    onStartDeepAnalysis?.([targetId]);
  }, [onStartDeepAnalysis]);

  const getTargetStatus = useCallback((target: BuildTarget) => {
    const wsState = pipeline.targets.get(target.id);
    return wsState?.status ?? target.status ?? "discovered";
  }, [pipeline.targets]);

  const getTargetMessage = useCallback((target: BuildTarget) => {
    return pipeline.targets.get(target.id)?.message;
  }, [pipeline.targets]);

  const getTargetError = useCallback((target: BuildTarget) => {
    return pipeline.targets.get(target.id)?.error;
  }, [pipeline.targets]);

  const readyTargets = buildTargets.targets.filter((target) => getTargetStatus(target) === "ready");
  const configuredCount = buildTargets.targets.filter((target) => getTargetStatus(target) !== "discovered").length;

  const handleEditSubmit = useCallback(async ({ name, profile }: { name: string; profile: BuildProfile }) => {
    if (!editingTarget) return;
    setSaving(true);
    try {
      await buildTargets.update(editingTarget.id, { name, buildProfile: profile });
      toast.success(`타겟 "${name}" 수정됨`);
      setEditingTarget(null);
    } catch (error) {
      logError("Save build target", error);
      toast.error("타겟 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }, [buildTargets, editingTarget, toast]);

  return {
    buildTargets,
    pipeline,
    registeredSdks,
    sourceFiles,
    formMode,
    formName,
    setFormName,
    formPath,
    setFormPath,
    formProfile,
    setFormProfile,
    saving,
    deleteTarget,
    setDeleteTarget,
    logTarget,
    setLogTarget,
    editingTarget,
    setEditingTarget,
    readyTargets,
    configuredCount,
    openAddForm,
    closeForm,
    handleSave,
    handleDelete,
    handleDiscover,
    handleRunPipeline,
    handleRetryTarget,
    handleDeepAnalysis,
    getTargetStatus,
    getTargetMessage,
    getTargetError,
    handleEditSubmit,
  };
}
